// scripts/seedHouseVotes.js - Fixed version
// Uses name-id attribute (bioguide ID) for direct matching
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const YEAR = 2025;
const DELAY_MS = 250;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractTag(xml, tag) {
  const match = xml.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>'));
  return match ? match[1].trim() : '';
}

function extractCategory(question, desc) {
  const text = ((question || '') + ' ' + (desc || '')).toLowerCase();
  if (text.includes('health') || text.includes('medicare')) return 'Health';
  if (text.includes('defense') || text.includes('military') || text.includes('armed')) return 'Armed Forces and National Security';
  if (text.includes('immigr') || text.includes('border')) return 'Immigration';
  if (text.includes('tax') || text.includes('budget') || text.includes('appropriat')) return 'Taxation';
  if (text.includes('climate') || text.includes('environment') || text.includes('energy')) return 'Environmental Protection';
  if (text.includes('gun') || text.includes('firearm')) return 'Crime and Law Enforcement';
  if (text.includes('foreign') || text.includes('ukraine') || text.includes('israel')) return 'International Affairs';
  if (text.includes('education') || text.includes('school')) return 'Education';
  return 'Government Operations and Politics';
}

function normalizeVote(v) {
  const lower = (v || '').toLowerCase();
  if (lower === 'yea' || lower === 'aye' || lower === 'yes') return 'Yes';
  if (lower === 'nay' || lower === 'no') return 'No';
  if (lower === 'present') return 'Present';
  return 'Not Voting';
}

async function fetchVote(rollNum) {
  const padded = String(rollNum).padStart(3, '0');
  const url = 'https://clerk.house.gov/evs/' + YEAR + '/roll' + padded + '.xml';
  try {
    const { data } = await axios.get(url, { timeout: 12000 });
    return data;
  } catch (err) {
    if (err.response && err.response.status === 404) return null;
    throw err;
  }
}

async function processVote(xml, rollNum) {
  const metaMatch = xml.match(/<vote-metadata>([\s\S]*?)<\/vote-metadata>/);
  const meta = metaMatch ? metaMatch[1] : xml;

  const rollcallNum = extractTag(meta, 'rollcall-num') || String(rollNum);
  const question    = extractTag(meta, 'vote-question') || '';
  const desc        = extractTag(meta, 'vote-desc') || extractTag(meta, 'legis-num') || '';
  const actionDate  = extractTag(meta, 'action-date') || '';

  let voteDate = null;
  if (actionDate) {
    try { voteDate = new Date(actionDate).toISOString().split('T')[0]; } catch { voteDate = null; }
  }

  const voteId = 'house-119-' + rollcallNum;
  const billId = 'house-vote-119-' + rollcallNum;

  await pool.query(
    'INSERT INTO bills (id, title, short_title, primary_subject, congress) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
    [billId, desc || question || 'House Vote ' + rollcallNum, desc || null, extractCategory(question, desc), 119]
  ).catch(() => {});

  const voteDataMatch = xml.match(/<vote-data>([\s\S]*?)<\/vote-data>/);
  if (!voteDataMatch) return 0;

  const voteData = voteDataMatch[1];
  const re = /<recorded-vote><legislator\s+([^>]+)>[^<]*<\/legislator><vote>([^<]+)<\/vote><\/recorded-vote>/g;

  let saved = 0;
  let m;
  while ((m = re.exec(voteData)) !== null) {
    const attrs = m[1];
    const voteCast = m[2];
    const nameIdMatch = attrs.match(/name-id="([^"]+)"/);
    if (!nameIdMatch) continue;
    const bioguideId = nameIdMatch[1];

    await pool.query(
      'INSERT INTO votes (politician_id, bill_id, vote_id, position, question, description, vote_date, session, congress) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (politician_id, vote_id) DO NOTHING',
      [bioguideId, billId, voteId + '-' + bioguideId, normalizeVote(voteCast), question || null, desc || null, voteDate, '1', 119]
    ).catch(() => {});
    saved++;
  }
  return saved;
}

async function run() {
  console.log('\nVoteMap - House Vote Seed Script (Fixed)');
  console.log('==========================================\n');

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost')) {
    console.error('ERROR: Set DATABASE_URL to Railway public URL'); process.exit(1);
  }

  let totalSaved = 0, errors = 0, rollNum = 1, consecutive404s = 0;
  console.log('Fetching House votes...\n');

  while (consecutive404s < 10) {
    try {
      const xml = await fetchVote(rollNum);
      if (!xml) { consecutive404s++; rollNum++; await sleep(100); continue; }
      consecutive404s = 0;
      const saved = await processVote(xml, rollNum);
      totalSaved += saved;
      process.stdout.write('\rVote ' + rollNum + ' - ' + totalSaved + ' individual votes saved');
      await sleep(DELAY_MS);
    } catch (err) {
      errors++;
      await sleep(DELAY_MS * 3);
    }
    rollNum++;
  }

  console.log('\n\nUpdating vote counts...');
  await pool.query("UPDATE politicians p SET total_votes = (SELECT COUNT(*) FROM votes v WHERE v.politician_id = p.id), last_synced = NOW() WHERE chamber = 'house'");

  const { rows } = await pool.query('SELECT COUNT(*) FROM votes');
  console.log('\nDone! Total votes in DB: ' + rows[0].count + ' | House rolls processed: ' + rollNum + ' | Saved: ' + totalSaved + ' | Errors: ' + errors);
  await pool.end();
}

run().catch(e => { console.error('\nFatal:', e.message); process.exit(1); });
