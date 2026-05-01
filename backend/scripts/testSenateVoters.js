require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

async function run() {
  const url = 'https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00001.xml';
  const { data } = await axios.get(url, { timeout: 8000 });
  // Print full XML so we can see member vote structure
  console.log(data);
}
run().catch(console.error);
