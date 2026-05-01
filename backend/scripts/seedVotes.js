// scripts/seedVotes.js
// Pulls vote history from Congress.gov for all politicians in the DB
// Run from your local machine: node scripts/seedVotes.js
//
// Strategy: fetch each member's recent votes via the member votes endpoint
// Saves directly to Railway DB via public connection string

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const API_KEY = process.env.CONGRESS_API_KEY;
const BASE = 'https://api.congress.gov/v3';

// How many votes to fetch per politician (250 = max per request, one page)
// Increase to 500+ for more history but takes longer
const VOTES_PER_MEMBER = 250;
const DELAY_MS = 300; // ~3 req/sec to stay under rate limit

async function getAllPoliticians() {
  const { rows } = await pool.query(
    'SELECT id, full_name, chamber FROM politicians WHERE in_office = true ORDER BY chamber, last_name'
  );
  return rows;
}

async function fetchMemberVotes(bioguideId, offset = 0) {
  try {
    const { data } = await axios.get(`${BASE}/member/${bioguideId}/votes`, {
      params: {
        api_key: API_KEY,
        format: 'json',
        limit: 250,
        offset,
      },
      timeout: 15000,
    });
    return data.votes || [];
  } catch (err) {
    if (err.response?.status === 404) return [];
    throw err;
  }
}

function normalizePosition(pos) {
  if (!pos) return 'Not Voting';
  const p = pos.toLowerCase();
  if (p === 'yea' || p === 'yes' || p === 'aye') return 'Yes';
  if (p === 'nay' || p === 'no') return 'No';
  if (p === 'present') return 'Present';
  return 'Not Voting';
}

async function saveVote(politicianId, vote) {
  // Build a unique vote ID
  const voteId = [
    vote.congress,
    vote.chamber?.toLowerCase().slice(0, 1),
    vote.sessionNumber,
    vote.rollNumber,
  ].filter(Boolean).join('-');

  if (!voteId || voteId === '') return;

  // Upsert bill if we have bill info
  let billId = null;
  if (vote.bill?.number && vote.bill?.type) {
    billId = `${vote.bill.type.toLowerCase()}${vote.bill.number}-${vote.congress}`;
    await pool.query(`
      INSERT INTO bills (id, number, title, short_title, primary_subject, congress)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING
    `, [
      billId,
      String(vote.bill.number),
      vote.description || vote.question || 'Unknown',
      vote.bill.title || null,
      vote.bill.subject || null,
      vote.congress || 119,
    ]).catch(() => {});
  }

  // Upsert vote
  await pool.query(`
    INSERT INTO votes
      (politician_id, bill_id, vote_id, position, question, description, vote_date, session, congress)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (politician_id, vote_id) DO NOTHING
  `, [
    politicianId,
    billId,
    voteId,
    normalizePosition(vote.memberVotes?.memberVote?.[0]?.votePosition || vote.votePosition || vote.position),
    vote.question || vote.voteType || null,
    vote.description || vote.title || null,
    vote.date || null,
    String(vote.sessionNumber || 1),
    vote.congress || 119,
  ]).catch(() => {});
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\nVoteMap — Vote Seed Script');
  console.log('==========================\n');

  if (!API_KEY || API_KEY.includes('your_')) {
    console.error('ERROR: CONGRESS_API_KEY not set in .env'); process.exit(1);
  }
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost')) {
    console.error('ERROR: DATABASE_URL should point to Railway, not localhost'); process.exit(1);
  }

  const politicians = await getAllPoliticians();
  console.log(`Found ${politicians.length} politicians in DB`);
  console.log(`Fetching up to ${VOTES_PER_MEMBER} votes each...\n`);

  const startTime = Date.now();
  let totalVotes = 0;
  let errors = 0;

  for (let i = 0; i < politicians.length; i++) {
    const pol = politicians[i];
    const pct = Math.round((i / politicians.length) * 100);

    try {
      const votes = await fetchMemberVotes(pol.id, 0);

      for (const vote of votes) {
        await saveVote(pol.id, vote);
        totalVotes++;
      }

      // Update politician stats
      if (votes.length > 0) {
        await pool.query(`
          UPDATE politicians SET total_votes = $1, last_synced = NOW()
          WHERE id = $2
        `, [votes.length, pol.id]).catch(() => {});
      }

      process.stdout.write(`\r[${pct}%] ${i+1}/${politicians.length} — ${pol.full_name.padEnd(30)} — ${votes.length} votes — Total: ${totalVotes}`);
      await sleep(DELAY_MS);

    } catch (err) {
      errors++;
      process.stdout.write(`\r[${pct}%] ${i+1}/${politicians.length} — ${pol.full_name.padEnd(30)} — ERROR: ${err.message.slice(0,40)}`);
      await sleep(DELAY_MS * 2);
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const { rows } = await pool.query('SELECT COUNT(*) FROM votes');

  console.log(`\n\n✅ Done in ${elapsed}s`);
  console.log(`   Total votes in DB: ${rows[0].count}`);
  console.log(`   Errors: ${errors}`);

  await pool.end();
}

run().catch(e => { console.error('\nFatal:', e.message); process.exit(1); });
