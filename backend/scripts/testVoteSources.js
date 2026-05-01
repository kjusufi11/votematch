require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

async function test(label, url) {
  try {
    const { data, status } = await axios.get(url, { timeout: 8000 });
    const preview = typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200);
    console.log(`✓ ${label} — ${status}`);
    console.log(`  ${preview}\n`);
  } catch (err) {
    console.log(`✗ ${label} — ${err.response?.status || err.message}\n`);
  }
}

async function run() {
  // House XML votes - correct URL format
  await test('House roll call XML 2025', 'https://clerk.house.gov/evs/2025/ROLL_001.xml');
  await test('House roll call XML 2024 roll 500', 'https://clerk.house.gov/evs/2024/ROLL_500.xml');
  
  // Senate XML votes
  await test('Senate vote XML', 'https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00001.xml');
  
  // GovTrack bulk data
  await test('GovTrack votes', 'https://www.govtrack.us/api/v2/vote?congress=119&limit=3');
  
  // VoteSmart
  await test('VoteSmart', 'https://api.votesmart.org/votes.getBillsByCategoryYearState?key=&category=2&year=2024&stateId=NA&o=JSON');
}
run();
