require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

async function run() {
  // Get a vote list
  const { data: list } = await axios.get('https://www.govtrack.us/api/v2/vote', {
    params: { congress: 119, limit: 3, offset: 0 },
  });
  console.log('Total votes:', list.meta.total_count);
  console.log('Sample vote object:', JSON.stringify(list.objects[0], null, 2));

  // Get voter details for that vote
  const voteId = list.objects[0].id;
  console.log('\n\nFetching voters for vote', voteId, '...');
  const { data: voters } = await axios.get('https://www.govtrack.us/api/v2/votevoter', {
    params: { vote: voteId, limit: 5 },
  });
  console.log('Total voters:', voters.meta.total_count);
  console.log('Sample voter:', JSON.stringify(voters.objects[0], null, 2));
}
run().catch(console.error);
