// scripts/seedSenateVotes.js
// Fetches all Senate roll call votes from senate.gov XML
// and saves individual member votes to the Railway DB
// Run: node scripts/seedSenateVotes.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CONGRESS = 119;
const SESSION = 1;
const DELAY_MS = 200; // 5 req/sec

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Parse XML manually - no external library needed
function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1].trim() : '';
}

function extractAllTags(xml, tag) {
  const matches = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
  let m;
  while ((m = re.exec(xml)) !== null) matches.push(m[1]);
  return matches;
}

function normalizeVoteCast(v) {
  const lower = (v || '').toLowerCase();
  if (lower === 'yea' || lower === 'aye' || lower === 'yes') return 'Yes';
  if (lower === 'nay' || lower === 'no') return 'No';
  if (lower === 'present') return 'Present';
  return 'Not Voting';
}

function parseDate(dateStr) {
  // "January 9, 2025,  02:54 PM" -> ISO date
  try {
    const cleaned = dateStr.replace(/,\s*\d+:\d+\s*[AP]M/, '').trim();
    return new Date(cleaned).toISOString().split('T')[0];
  } catch { return null; }
}

async function buildSenatorIndex() {
  // Build a lookup: "LastName-State" -> politician_id
  const { rows } = await pool.query(
    "SELECT id, last_name, state FROM politicians WHERE chamber = 'senate' AND in_office = true"
  );
  const index = {};
  for (const r of rows) {
    const key = `${r.last_name.toLowerCase().trim()}-${r.state}`;
    index[key] = r.id;
  }
  return index;
}

async function fetchVote(voteNum) {
  const padded = String(voteNum).padStart(5, '0');
  const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${CONGRESS}${SESSION}/vote_${CONGRESS}_${SESSION}_${padded}.xml`;
  try {
    const { data } = await axios.get(url, { timeout: 10000 });
    return data;
  } catch (err) {
    if (err.response?.status === 404) return null; // Vote doesn't exist
    throw err;
  }
}

async function processVote(xml, senatorIndex) {
  const voteNumber = extractTag(xml, 'vote_number');
  const voteDate   = parseDate(extractTag(xml, 'vote_date'));
  const question   = extractTag(xml, 'vote_question_text');
  const docText    = extractTag(xml, 'vote_document_text');
  const title      = extractTag(xml, 'vote_title');
  const result     = extractTag(xml, 'vote_result_text');

  if (!voteNumber) return 0;

  const voteId = `senate-${CONGRESS}-${SESSION}-${voteNumber}`;

  // Upsert bill record
  const billId = `senate-vote-${CONGRESS}-${voteNumber}`;
  await pool.query(`
    INSERT INTO bills (id, title, short_title, primary_subject, congress)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO NOTHING
  `, [
    billId,
    docText || title || question || 'Senate Vote',
    title || question || null,
    extractCategory(question, docText),
    CONGRESS,
  ]).catch(() => {});

  // Process each member's vote
  const memberXmls = extractAllTags(xml, 'member');
  let saved = 0;

  for (const memberXml of memberXmls) {
    const lastName  = extractTag(memberXml, 'last_name').toLowerCase().trim();
    const state     = extractTag(memberXml, 'state').trim();
    const voteCast  = extractTag(memberXml, 'vote_cast');

    const key = `${lastName}-${state}`;
    const politicianId = senatorIndex[key];

    if (!politicianId) continue; // Senator not in our DB

    await pool.query(`
      INSERT INTO votes
        (politician_id, bill_id, vote_id, position, question, description, vote_date, session, congress)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (politician_id, vote_id) DO NOTHING
    `, [
      politicianId,
      billId,
      `${voteId}-${politicianId}`,
      normalizeVoteCast(voteCast),
      question || null,
      docText || title || null,
      voteDate,
      String(SESSION),
      CONGRESS,
    ]).catch(() => {});

    saved++;
  }

  return saved;
}

function extractCategory(question, docText) {
  const text = ((question || '') + ' ' + (docText || '')).toLowerCase();
  if (text.includes('health') || text.includes('medicare') || text.includes('medicaid')) return 'Health';
  if (text.includes('defense') || text.includes('military') || text.includes('armed forces')) return 'Armed Forces and National Security';
  if (text.includes('immigr') || text.includes('border') || text.includes('alien')) return 'Immigration';
  if (text.includes('tax') || text.includes('budget') || text.includes('appropriat') || text.includes('fiscal')) return 'Taxation';
  if (text.includes('climate') || text.includes('environment') || text.includes('energy')) return 'Environmental Protection';
  if (text.includes('gun') || text.includes('firearm') || text.includes('weapon')) return 'Crime and Law Enforcement';
  if (text.includes('foreign') || text.includes('ukraine') || text.includes('israel') || text.includes('nato')) return 'International Affairs';
  if (text.includes('education') || text.includes('school') || text.includes('student')) return 'Education';
  return 'Government Operations and Politics';
}

async function findMaxVote() {
  // Binary search to find the highest vote number
  let lo = 1, hi = 600;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const xml = await fetchVote(mid);
    await sleep(100);
    if (xml) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

async function run() {
  console.log('\nVoteMap — Senate Vote Seed Script');
  console.log('==================================\n');

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost')) {
    console.error('ERROR: Set DATABASE_URL to Railway public URL'); process.exit(1);
  }

  console.log('Building senator index...');
  const senatorIndex = await buildSenatorIndex();
  console.log(`  Found ${Object.keys(senatorIndex).length} senators in DB\n`);

  console.log('Finding total Senate votes this Congress...');
  const maxVote = await findMaxVote();
  console.log(`  Found ${maxVote} votes\n`);

  console.log(`Fetching all ${maxVote} Senate votes...\n`);

  let totalSaved = 0;
  let errors = 0;
  let missing = 0;

  for (let i = 1; i <= maxVote; i++) {
    const pct = Math.round((i / maxVote) * 100);
    try {
      const xml = await fetchVote(i);
      if (!xml) { missing++; continue; }

      const saved = await processVote(xml, senatorIndex);
      totalSaved += saved;

      process.stdout.write(`\r[${pct}%] Vote ${i}/${maxVote} — ${totalSaved} individual votes saved`);
      await sleep(DELAY_MS);
    } catch (err) {
      errors++;
      await sleep(DELAY_MS * 3);
    }
  }

  // Update senator vote counts
  console.log('\n\nUpdating vote counts...');
  await pool.query(`
    UPDATE politicians p SET
      total_votes = (SELECT COUNT(*) FROM votes v WHERE v.politician_id = p.id)
    WHERE chamber = 'senate'
  `);

  const { rows } = await pool.query('SELECT COUNT(*) FROM votes');
  console.log(`\n✅ Done!`);
  console.log(`   Total votes in DB: ${rows[0].count}`);
  console.log(`   Errors: ${errors}`);

  await pool.end();
}

run().catch(e => { console.error('\nFatal:', e.message); process.exit(1); });
