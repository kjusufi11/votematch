require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

async function test() {
  // House clerk publishes XML votes here
  const urls = [
    'https://clerk.house.gov/evs/2024/ROLL_001.xml',
    'https://www.senate.gov/legislative/LIS/roll_call_lists/roll_call_vote_cfm.cfm?congress=119&session=1&vote=00001',
    'https://api.govinfo.gov/collections/CRECB?api_key=' + process.env.CONGRESS_API_KEY,
  ];

  for (const url of urls) {
    try {
      const { data, status } = await axios.get(url, { timeout: 8000 });
      console.log(`✓ ${url.slice(0,60)} — status ${status}, length ${JSON.stringify(data).slice(0,100)}`);
    } catch (err) {
      console.log(`✗ ${url.slice(0,60)} — ${err.response?.status || err.message}`);
    }
  }
}
test();
