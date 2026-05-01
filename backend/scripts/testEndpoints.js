require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const API_KEY = process.env.CONGRESS_API_KEY;
const BASE = 'https://api.congress.gov/v3';

async function test(path) {
  try {
    const { data } = await axios.get(`${BASE}${path}`, {
      params: { api_key: API_KEY, format: 'json', limit: 2 },
      timeout: 10000,
    });
    console.log(`✓ ${path} — keys: ${Object.keys(data).join(', ')}`);
    return data;
  } catch (err) {
    console.log(`✗ ${path} — ${err.response?.status}: ${JSON.stringify(err.response?.data)}`);
    return null;
  }
}

async function run() {
  console.log('Testing Congress.gov API endpoints...\n');
  await test('/');
  await test('/member/S000148');
  await test('/member/S000148/sponsored-legislation');
  await test('/member/S000148/cosponsored-legislation');
  await test('/bill/119/s');
  await test('/bill/119/hr');
  await test('/nomination');
  await test('/treaty');
  await test('/committee');
  await test('/congress');
}
run();
