// Rebuilds the votes table by enumerating every roll call on Congress.gov
// and extracting per-member positions from the vote detail endpoint.
//
// Congress.gov endpoints used:
//   GET /vote/119/{chamber}/{session}?limit=250&offset=N  → list of roll calls
//   GET /vote/119/{chamber}/{session}/{rollCall}           → member positions
//
// Run via POST /api/admin/rebuild-votes. Poll GET /api/admin/rebuild-status.

const axios = require('axios');
const db = require('../db');

const BASE = 'https://api.congress.gov/v3';
const CONGRESS = 119;
const CHAMBERS = ['senate', 'house'];
const SESSIONS = [1, 2];
const DELAY_MS = 650; // ~1.5 req/sec — well within Congress.gov rate limits

const progress = {
  running: false,
  phase: 'idle',       // idle | listing | fetching | stats | done | failed
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
  if (progress.recentLog.length > 200) progress.recentLog.shift();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cget(path, params = {}) {
  const { data } = await axios.get(`${BASE}${path}`, {
    params: { api_key: process.env.CONGRESS_API_KEY, format: 'json', ...params },
    timeout: 20000,
  });
  return data;
}

function normalizePosition(pos) {
  if (!pos) return 'Not Voting';
  const p = pos.toLowerCase();
  if (p === 'yea' || p === 'yes' || p === 'aye') return 'Yes';
  if (p === 'nay' || p === 'no') return 'No';
  if (p === 'present') return 'Present';
  return 'Not Voting';
}

async function listAllRollCalls() {
  const all = [];
  for (const chamber of CHAMBERS) {
    for (const session of SESSIONS) {
      log(`Listing ${chamber} session ${session}...`);
      let offset = 0;
      const limit = 250;
      while (true) {
        let data;
        try {
          data = await cget(`/vote/${CONGRESS}/${chamber}/${session}`, { limit, offset });
        } catch (err) {
          log(`  ERROR listing ${chamber}/${session} offset ${offset}: ${err.message}`);
          progress.errors++;
          break;
        }
        const votes = data.votes || [];
        for (const v of votes) {
          // Congress.gov list items use 'number' for the roll call number
          const number = v.number ?? v.rollNumber;
          if (number != null) {
            all.push({ chamber, session, number, date: v.date, question: v.question });
          }
        }
        const total = data.pagination?.count ?? 0;
        log(`  ${chamber}/${session}: offset ${offset} got ${votes.length} (total: ${total})`);
        if (votes.length < limit || (total > 0 && offset + votes.length >= total)) break;
        offset += limit;
        await sleep(DELAY_MS);
      }
      await sleep(DELAY_MS);
    }
  }
  return all;
}

async function processRollCall({ chamber, session, number, date, question }) {
  progress.currentTarget = `${chamber}/${session}/${number}`;

  let data;
  try {
    data = await cget(`/vote/${CONGRESS}/${chamber}/${session}/${number}`);
  } catch (err) {
    log(`  ERROR fetching ${chamber}/${session}/${number}: ${err.message}`);
    progress.errors++;
    return;
  }

  const vote = data.vote;
  if (!vote) { progress.skipped++; return; }

  // Congress.gov detail uses sessionNumber and rollNumber
  const sessionStr = String(vote.sessionNumber ?? vote.session ?? session);
  const rollNum    = vote.rollNumber ?? vote.number ?? number;
  const chamberKey = chamber; // already 'senate' or 'house'
  const voteId     = `${chamberKey}-${CONGRESS}-${sessionStr}-${rollNum}`;
  const voteDate   = vote.date ?? date;
  const voteQ      = vote.question ?? question;
  const voteDesc   = vote.description ?? null;

  // Optionally upsert the associated bill
  let billId = null;
  const bill = vote.bill;
  if (bill?.number && bill?.type) {
    billId = `${bill.type.toLowerCase()}${bill.number}-${CONGRESS}`;
    await db.query(
      `INSERT INTO bills (id, number, title, primary_subject, congress)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [billId, bill.number,
       bill.title ?? voteDesc ?? voteQ ?? 'Unknown',
       bill.primarySubject ?? null, CONGRESS]
    ).catch(() => {});
  }

  // memberVotes.memberVote is an array of every member's position
  const memberVotes = vote.memberVotes?.memberVote ?? [];
  let inserted = 0;
  for (const mv of memberVotes) {
    if (!mv.bioguideId) continue;
    const result = await db.query(
      `INSERT INTO votes
         (politician_id, bill_id, vote_id, position, question, description, vote_date, session, congress)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (politician_id, vote_id) DO NOTHING`,
      [mv.bioguideId, billId, voteId,
       normalizePosition(mv.votePosition),
       voteQ, voteDesc, voteDate, sessionStr, CONGRESS]
    ).catch(() => null);
    if (result?.rowCount > 0) inserted++;
  }
  progress.votesInserted += inserted;
}

async function rebuildVotes() {
  if (progress.running) throw new Error('Rebuild already in progress');

  Object.assign(progress, {
    running: true,
    phase: 'listing',
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
    // ── Phase 1: enumerate all roll calls ───────────────────────────────────
    log('=== Phase 1: Listing all 119th Congress roll calls ===');
    const rollCalls = await listAllRollCalls();
    progress.totalRollCalls = rollCalls.length;
    log(`Found ${rollCalls.length} roll calls across senate/house sessions 1–2`);

    // ── Phase 2: fetch detail + insert member votes ─────────────────────────
    log('=== Phase 2: Fetching vote details and inserting member votes ===');
    progress.phase = 'fetching';

    for (const rc of rollCalls) {
      await processRollCall(rc);
      progress.processedRollCalls++;

      if (progress.processedRollCalls % 25 === 0) {
        const pct = Math.round(progress.processedRollCalls / progress.totalRollCalls * 100);
        log(`Progress: ${progress.processedRollCalls}/${progress.totalRollCalls} (${pct}%) — ${progress.votesInserted} votes inserted, ${progress.errors} errors`);
      }

      await sleep(DELAY_MS);
    }

    // ── Phase 3: update politician stats ────────────────────────────────────
    log('=== Phase 3: Updating politician stats ===');
    progress.phase = 'stats';

    const { rows } = await db.query(
      `SELECT DISTINCT politician_id FROM votes`
    );
    log(`Updating stats for ${rows.length} politicians...`);

    const sync = require('./sync');
    for (const { politician_id } of rows) {
      await sync.updatePoliticianStats(politician_id).catch(() => {});
    }

    progress.phase = 'done';
    progress.finishedAt = new Date().toISOString();
    log('=== REBUILD COMPLETE ===');
    log(`  Roll calls processed : ${progress.processedRollCalls}`);
    log(`  Votes inserted       : ${progress.votesInserted}`);
    log(`  Errors               : ${progress.errors}`);
    log(`  Skipped              : ${progress.skipped}`);

  } catch (err) {
    progress.phase = 'failed';
    progress.error = err.message;
    log(`FATAL: ${err.message}`);
  } finally {
    progress.running = false;
  }
}

module.exports = { rebuildVotes, progress };
