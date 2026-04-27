// scripts/seedMembers.js - Fixed version
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const API_KEY = process.env.CONGRESS_API_KEY;
const BASE = 'https://api.congress.gov/v3';

// Full state name to abbreviation
const STATE_ABBR = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
  'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
  'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS',
  'Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA',
  'Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT',
  'Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM',
  'New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK',
  'Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
  'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
  'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
  'District of Columbia':'DC','American Samoa':'AS','Guam':'GU',
  'Northern Mariana Islands':'MP','Puerto Rico':'PR','Virgin Islands':'VI',
};

async function fetchAllMembers() {
  const all = [];
  let offset = 0;
  console.log('Fetching all current members of Congress...');
  while (true) {
    const { data } = await axios.get(`${BASE}/member`, {
      params: { api_key: API_KEY, format: 'json', limit: 250, offset, currentMember: true },
    });
    const members = data.members || [];
    all.push(...members);
    console.log(`  Fetched ${all.length} so far...`);
    if (members.length < 250) break;
    offset += 250;
    await sleep(500);
  }
  return all;
}

function parseName(m) {
  // Congress.gov returns "LastName, FirstName" format
  const raw = m.name || '';
  if (raw.includes(',')) {
    const [last, first] = raw.split(',').map(s => s.trim());
    return { full: `${first} ${last}`, first, last };
  }
  const parts = raw.split(' ');
  return { full: raw, first: parts[0] || '', last: parts[parts.length - 1] || '' };
}

function normalizeState(state) {
  if (!state) return null;
  if (state.length === 2) return state.toUpperCase();
  return STATE_ABBR[state] || state;
}

function normalizeParty(p) {
  if (!p) return 'I';
  if (p === 'D') return 'D';
  if (p === 'R') return 'R';
  return 'I';
}

async function upsert(m) {
  const { full, first, last } = parseName(m);
  const terms = m.terms?.item || [];
  const lastTerm = terms[terms.length - 1] || {};
  const chamberRaw = lastTerm.chamber || '';
  const chamber = chamberRaw.toLowerCase().includes('senate') ? 'senate' : 'house';
  const state = normalizeState(m.state || lastTerm.stateCode);
  const party = normalizeParty(m.partyHistory?.[0]?.partyAbbreviation);

  await pool.query(`
    INSERT INTO politicians
      (id, full_name, first_name, last_name, party, state, chamber,
       district, title, in_office, url, total_votes, missed_votes_pct,
       party_loyalty_pct, last_synced)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,0,0,NOW())
    ON CONFLICT (id) DO UPDATE SET
      full_name=$2, first_name=$3, last_name=$4, party=$5, state=$6,
      chamber=$7, district=$8, title=$9, in_office=$10, url=$11, last_synced=NOW()
  `, [
    m.bioguideId, full, first, last, party, state, chamber,
    lastTerm.district || null,
    chamber === 'senate' ? 'Sen.' : 'Rep.',
    true,
    m.officialWebsiteUrl || null,
  ]);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\nVoteMap — Member Seed Script (Fixed)\n');

  if (!API_KEY || API_KEY.includes('your_')) {
    console.error('ERROR: CONGRESS_API_KEY not set'); process.exit(1);
  }
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost')) {
    console.error('ERROR: Set DATABASE_URL to Railway public URL'); process.exit(1);
  }

  const members = await fetchAllMembers();
  console.log(`\nGot ${members.length} — saving...`);

  let saved = 0, skipped = 0;
  for (const m of members) {
    try { await upsert(m); saved++; process.stdout.write('.'); }
    catch (e) { skipped++; process.stdout.write('x'); }
  }

  const { rows } = await pool.query("SELECT COUNT(*) FROM politicians WHERE state = 'NY'");
  console.log(`\n\nDone! Saved: ${saved}, Skipped: ${skipped}`);
  console.log(`NY politicians: ${rows[0].count}`);
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
