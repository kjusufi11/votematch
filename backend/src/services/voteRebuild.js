// Rebuilds the votes table from official congressional clerk XML feeds.
// Congress.gov API v3 has no working vote-listing endpoints; these XML feeds
// are the authoritative sources used by academic and government tools.
//
// Senate: senate.gov LIS XML  — vote_menu per session + individual vote XMLs
// House:  clerk.house.gov EVS — roll{NNN}.xml per year, stop at 404
//
// Senate XML has no bioguide ID; members matched by (last_name, state) against DB.
// House XML has name-id attribute which IS the bioguide ID.
//
// Trigger: POST /api/admin/rebuild-votes
// Monitor: GET  /api/admin/rebuild-status

const axios = require('axios');
const db    = require('../db');

const CONGRESS   = 119;
const SESSIONS   = [1, 2];
const DELAY_MS   = 400; // ~2.5 req/sec — respectful of both clerk servers

// ── Progress singleton ────────────────────────────────────────────────────────

const progress = {
  running: false,
  phase: 'idle',
  startedAt: null,
  finishedAt: null,
  totalRollCalls: 0,
  processedRollCalls: 0,
  votesInserted: 0,
  errors: 0,
  skipped: 0,
  currentTarget: '',
  recentLog: [],
  error: null,
};

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  progress.recentLog.push(line);
  if (progress.recentLog.length > 300) progress.recentLog.shift();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── XML helpers (no external library — Senate/House XML is very regular) ──────

// Extract first text content of a named tag (not nested)
function tag(xml, t) {
  const m = xml.match(new RegExp(`<${t}[^>]*>([^<]*)<\\/${t}>`));
  return m ? decodeXml(m[1].trim()) : '';
}

// Extract all top-level blocks of a named tag (may be multi-line)
function blocks(xml, t) {
  const re = new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${t}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[0]);
  return out;
}

// Extract an attribute value from a tag string
function attr(str, a) {
  const m = str.match(new RegExp(`${a}="([^"]*)"`));
  return m ? m[1] : '';
}

function pad(n, len) { return String(n).padStart(len, '0'); }

function decodeXml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseDate(str) {
  if (!str) return null;
  // Senate format: "December 18, 2025, 12:02 PM" — strip time
  const cleaned = str.replace(/,?\s*\d{1,2}:\d{2}\s*(AM|PM)(\s+\w+)?$/i, '').trim();
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function normalizePos(pos) {
  const p = (pos || '').toLowerCase();
  if (p === 'yea' || p === 'yes' || p === 'aye') return 'Yes';
  if (p === 'nay' || p === 'no') return 'No';
  if (p === 'present') return 'Present';
  return 'Not Voting';
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

async function fetchText(url) {
  const { data } = await axios.get(url, { timeout: 20000, responseType: 'text' });
  return typeof data === 'string' ? data : JSON.stringify(data);
}

// ── Senator name → bioguide map ───────────────────────────────────────────────
// Senate XML has no bioguide ID; we match on (last_name, state).
// Also builds a first-initial fallback for rare same-last-name-same-state pairs.

async function buildSenatorMap() {
  const { rows } = await db.query(
    `SELECT id, last_name, first_name, state FROM politicians WHERE chamber = 'senate'`
  );
  const map = {};
  for (const r of rows) {
    const k1 = `${r.last_name.toLowerCase()}|${r.state}`;
    map[k1] = r.id;
    if (r.first_name) {
      const k2 = `${r.first_name[0].toLowerCase()}|${r.last_name.toLowerCase()}|${r.state}`;
      map[k2] = r.id;
    }
  }
  return map;
}

// ── Senate processing ─────────────────────────────────────────────────────────

async function senateVoteNums(session) {
  const url = `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_119_${session}.xml`;
  try {
    const xml = await fetchText(url);
    return blocks(xml, 'vote')
      .map(b => parseInt(tag(b, 'vote_number'), 10))
      .filter(n => !isNaN(n));
  } catch (e) {
    log(`Senate session ${session} menu failed: ${e.message}`);
    return [];
  }
}

async function processSenateVote(session, num, senatorMap) {
  const padded = pad(num, 5);
  const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote119${session}/vote_119_${session}_${padded}.xml`;

  let xml;
  try { xml = await fetchText(url); }
  catch (e) {
    log(`  Senate ${session}/${num} fetch error: ${e.message}`);
    progress.errors++;
    return;
  }

  const question    = tag(xml, 'vote_question_text') || 'Vote';
  const description = tag(xml, 'vote_document_text') || null;
  const voteDate    = parseDate(tag(xml, 'vote_date'));
  const voteId      = `senate-${CONGRESS}-${session}-${num}`;
  const sessionStr  = String(session);

  let inserted = 0;
  for (const mb of blocks(xml, 'member')) {
    const lastName  = tag(mb, 'last_name');
    const firstName = tag(mb, 'first_name');
    const state     = tag(mb, 'state');
    const voteCast  = tag(mb, 'vote_cast');
    if (!lastName || !state) continue;

    let bioguideId = senatorMap[`${lastName.toLowerCase()}|${state}`];
    if (!bioguideId && firstName) {
      bioguideId = senatorMap[`${firstName[0].toLowerCase()}|${lastName.toLowerCase()}|${state}`];
    }
    if (!bioguideId) continue;

    const r = await db.query(
      `INSERT INTO votes (politician_id, bill_id, vote_id, position, question, description, vote_date, session, congress)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (politician_id, vote_id) DO NOTHING`,
      [bioguideId, null, voteId, normalizePos(voteCast), question, description, voteDate, sessionStr, CONGRESS]
    ).catch(() => null);
    if (r?.rowCount > 0) inserted++;
  }
  progress.votesInserted += inserted;
}

// ── House processing ──────────────────────────────────────────────────────────
// Returns false when 404 is hit (caller should stop iterating).

async function processHouseRoll(year, rollNum) {
  const padded = pad(rollNum, 3);
  const url    = `https://clerk.house.gov/evs/${year}/roll${padded}.xml`;

  let xml;
  try { xml = await fetchText(url); }
  catch (e) {
    if (e.response?.status === 404) return false;
    log(`  House ${year}/roll${padded} error: ${e.message}`);
    progress.errors++;
    return true;
  }

  const question    = tag(xml, 'vote-question') || 'Vote';
  const description = tag(xml, 'vote-desc')     || null;
  const voteDate    = parseDate(tag(xml, 'action-date'));
  const sessionStr  = tag(xml, 'session') || (year <= 2025 ? '1' : '2');
  const voteId      = `house-${CONGRESS}-${sessionStr}-${rollNum}`;

  let inserted = 0;
  for (const vb of blocks(xml, 'recorded-vote')) {
    const legTag    = vb.match(/<legislator\s[^>]+>/)?.[0] || '';
    const bioguideId = attr(legTag, 'name-id');
    const voteCast   = tag(vb, 'vote');
    if (!bioguideId) continue;

    const r = await db.query(
      `INSERT INTO votes (politician_id, bill_id, vote_id, position, question, description, vote_date, session, congress)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (politician_id, vote_id) DO NOTHING`,
      [bioguideId, null, voteId, normalizePos(voteCast), question, description, voteDate, sessionStr, CONGRESS]
    ).catch(() => null);
    if (r?.rowCount > 0) inserted++;
  }
  progress.votesInserted += inserted;
  return true;
}

// ── Main rebuild ───────────────────────────────────────────────────────────────

async function rebuildVotes() {
  if (progress.running) throw new Error('Rebuild already in progress');

  Object.assign(progress, {
    running: true,
    phase: 'init',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    totalRollCalls: 0,
    processedRollCalls: 0,
    votesInserted: 0,
    errors: 0,
    skipped: 0,
    currentTarget: '',
    recentLog: [],
    error: null,
  });

  try {
    // ── Build senator lookup ──────────────────────────────────────────────────
    log('Building senator name → bioguide map from politicians table...');
    const senatorMap = await buildSenatorMap();
    const senCount = Math.round(Object.keys(senatorMap).length / 2);
    log(`  Map built: ${senCount} senators`);

    // ── Senate ────────────────────────────────────────────────────────────────
    progress.phase = 'senate';
    log('=== Senate votes (senate.gov LIS XML) ===');

    for (const session of SESSIONS) {
      log(`Senate session ${session}: fetching vote list...`);
      const nums = await senateVoteNums(session);
      log(`  ${nums.length} votes found`);
      progress.totalRollCalls += nums.length;
      await sleep(DELAY_MS);

      for (const num of nums) {
        progress.currentTarget = `senate/${session}/${num}`;
        await processSenateVote(session, num, senatorMap);
        progress.processedRollCalls++;
        if (progress.processedRollCalls % 50 === 0) {
          log(`  ${progress.processedRollCalls} senate roll calls done — ${progress.votesInserted} votes inserted`);
        }
        await sleep(DELAY_MS);
      }
      log(`Session ${session} complete. Running total: ${progress.votesInserted} votes`);
    }

    // ── House ─────────────────────────────────────────────────────────────────
    progress.phase = 'house';
    log('=== House votes (clerk.house.gov EVS XML) ===');

    for (const { year, session } of [{ year: 2025, session: 1 }, { year: 2026, session: 2 }]) {
      log(`House ${year} (session ${session}): iterating rolls...`);
      let roll = 1;
      let houseCount = 0;

      while (roll <= 1000) {
        progress.currentTarget = `house/${year}/roll${pad(roll, 3)}`;
        const ok = await processHouseRoll(year, roll);
        if (!ok) {
          log(`  House ${year}: 404 at roll ${roll} — ${houseCount} rolls processed`);
          progress.totalRollCalls    += houseCount;
          progress.processedRollCalls += houseCount;
          break;
        }
        houseCount++;
        if (houseCount % 50 === 0) {
          log(`  House ${year}: roll ${roll} done — ${progress.votesInserted} votes total`);
        }
        roll++;
        await sleep(DELAY_MS);
      }
    }

    // ── Politician stats ──────────────────────────────────────────────────────
    progress.phase = 'stats';
    log('=== Updating politician stats ===');
    const { rows } = await db.query(`SELECT DISTINCT politician_id FROM votes`);
    log(`  ${rows.length} politicians to update...`);
    const sync = require('./sync');
    for (const { politician_id } of rows) {
      await sync.updatePoliticianStats(politician_id).catch(() => {});
    }

    // ── Done ──────────────────────────────────────────────────────────────────
    progress.phase = 'done';
    progress.finishedAt = new Date().toISOString();
    log('=== REBUILD COMPLETE ===');
    log(`  Roll calls processed : ${progress.processedRollCalls}`);
    log(`  Votes inserted       : ${progress.votesInserted}`);
    log(`  Errors               : ${progress.errors}`);

  } catch (err) {
    progress.phase = 'failed';
    progress.error = err.message;
    log(`FATAL: ${err.message}`);
  } finally {
    progress.running = false;
  }
}

// Sync Senate votes for a single politician (targeted re-run, no full rebuild needed).
// lastName and state must match exactly what appears in the Senate clerk XML.
async function syncSingleSenatorVotes(bioguideId, lastName, state) {
  const singleMap = {};
  const ln = lastName.toLowerCase();
  const st = state.toUpperCase();
  singleMap[`${ln}|${st}`] = bioguideId;
  // First-initial fallback key not needed for targeted single-person sync

  log(`Syncing Senate votes for ${bioguideId} (${lastName}, ${st})...`);
  let inserted = 0;

  for (const session of SESSIONS) {
    const nums = await senateVoteNums(session);
    log(`  Session ${session}: ${nums.length} roll calls`);
    for (const num of nums) {
      const before = progress.votesInserted;
      await processSenateVote(session, num, singleMap);
      inserted += progress.votesInserted - before;
      await sleep(DELAY_MS);
    }
  }

  log(`  Done. Inserted ${inserted} votes for ${bioguideId}`);
  const sync = require('./sync');
  await sync.updatePoliticianStats(bioguideId);
  return inserted;
}

module.exports = { rebuildVotes, syncSingleSenatorVotes, progress };
