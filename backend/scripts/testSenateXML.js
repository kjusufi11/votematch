require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

async function run() {
  // Test a few senate votes to understand structure
  for (let i = 1; i <= 3; i++) {
    const num = String(i).padStart(5, '0');
    const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_${num}.xml`;
    try {
      const { data } = await axios.get(url, { timeout: 8000 });
      // Show first 600 chars of XML
      console.log(`\nVote ${i}:`);
      console.log(data.slice(0, 600));
    } catch (err) {
      console.log(`Vote ${i}: ${err.response?.status || err.message}`);
    }
  }

  // Also check how many senate votes exist this congress
  console.log('\n\nChecking vote count...');
  // Try a high number to find the max
  for (const num of ['0100', '0200', '0300']) {
    const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_${num}.xml`;
    try {
      await axios.get(url, { timeout: 5000 });
      console.log(`Vote ${num}: exists`);
    } catch (err) {
      console.log(`Vote ${num}: ${err.response?.status}`);
    }
  }
}
run().catch(console.error);
