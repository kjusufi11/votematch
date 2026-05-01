require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const API_KEY = process.env.CONGRESS_API_KEY;
const BASE = 'https://api.congress.gov/v3';

async function test() {
  // Test roll call votes endpoint
  console.log('Testing roll call votes for Senate, Congress 119...');
  try {
    const { data } = await axios.get(`${BASE}/vote/119/senate/1`, {
      params: { api_key: API_KEY, format: 'json', limit: 3 },
      timeout: 15000,
    });
    console.log('Keys:', Object.keys(data));
    console.log('Sample:', JSON.stringify(data).slice(0, 500));
  } catch (err) {
    console.log('Status:', err.response?.status);
    console.log('Error:', err.response?.data || err.message);
  }

  // Also test the votes list endpoint
  console.log('\nTesting votes list...');
  try {
    const { data } = await axios.get(`${BASE}/vote`, {
      params: { api_key: API_KEY, format: 'json', limit: 3, congress: 119 },
      timeout: 15000,
    });
    console.log('Keys:', Object.keys(data));
    console.log('Sample:', JSON.stringify(data).slice(0, 800));
  } catch (err) {
    console.log('Status:', err.response?.status);
    console.log('Error:', err.response?.data || err.message);
  }
}
test();
