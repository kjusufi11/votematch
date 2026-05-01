require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

async function test(url) {
  try {
    const { data, status } = await axios.get(url, { timeout: 8000 });
    console.log(`✓ ${url.slice(-40)} — ${status} — ${data.slice(0,100)}`);
  } catch (err) {
    console.log(`✗ ${url.slice(-40)} — ${err.response?.status || err.message}`);
  }
}

async function run() {
  // Try different URL formats for House votes
  const urls = [
    'https://clerk.house.gov/evs/2025/ROLL_001.xml',
    'https://clerk.house.gov/evs/2025/roll001.xml',
    'https://clerk.house.gov/cgi-bin/vote.asp?year=2025&rollnumber=1',
    'https://clerk.house.gov/evs/2024/ROLL_001.xml',
    'https://clerk.house.gov/evs/2024/ROLL_100.xml',
    'https://clerk.house.gov/evs/2025/ROLL_0001.xml',
    'https://clerkpreview.house.gov/evs/2025/ROLL_001.xml',
  ];
  for (const url of urls) await test(url);
}
run();
