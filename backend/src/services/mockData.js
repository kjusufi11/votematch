// src/services/mockData.js
// Mock data for development — activated when CONGRESS_API_KEY is missing

const MOCK_POLITICIANS = {
  'S000033':{id:'S000033',full_name:'Bernie Sanders',first_name:'Bernie',last_name:'Sanders',party:'I',state:'VT',chamber:'senate',district:null,title:'Sen.',dw_nominate:-.79,next_election:'2026',twitter_handle:'SenSanders',url:'https://sanders.senate.gov',total_votes:2841,missed_votes_pct:4.2,party_loyalty_pct:86.3},
  'W000817':{id:'W000817',full_name:'Elizabeth Warren',first_name:'Elizabeth',last_name:'Warren',party:'D',state:'MA',chamber:'senate',district:null,title:'Sen.',dw_nominate:-.71,next_election:'2024',twitter_handle:'SenWarren',url:'https://warren.senate.gov',total_votes:2654,missed_votes_pct:3.3,party_loyalty_pct:95.8},
  'C001098':{id:'C001098',full_name:'Ted Cruz',first_name:'Ted',last_name:'Cruz',party:'R',state:'TX',chamber:'senate',district:null,title:'Sen.',dw_nominate:.82,next_election:'2024',twitter_handle:'SenTedCruz',url:'https://cruz.senate.gov',total_votes:2203,missed_votes_pct:14.1,party_loyalty_pct:88.6},
  'O000172':{id:'O000172',full_name:'Alexandria Ocasio-Cortez',first_name:'Alexandria',last_name:'Ocasio-Cortez',party:'D',state:'NY',chamber:'house',district:14,title:'Rep.',dw_nominate:-.88,next_election:'2024',twitter_handle:'AOC',url:'https://ocasio-cortez.house.gov',total_votes:1876,missed_votes_pct:5.1,party_loyalty_pct:97.2},
  'G000596':{id:'G000596',full_name:'Marjorie Taylor Greene',first_name:'Marjorie',last_name:'Taylor Greene',party:'R',state:'GA',chamber:'house',district:14,title:'Rep.',dw_nominate:.91,next_election:'2024',twitter_handle:'RepMTG',url:'https://greene.house.gov',total_votes:1654,missed_votes_pct:8.3,party_loyalty_pct:78.4},
  'P000197':{id:'P000197',full_name:'Nancy Pelosi',first_name:'Nancy',last_name:'Pelosi',party:'D',state:'CA',chamber:'house',district:11,title:'Rep.',dw_nominate:-.51,next_election:'2024',twitter_handle:'SpeakerPelosi',url:'https://pelosi.house.gov',total_votes:4211,missed_votes_pct:1.9,party_loyalty_pct:98.1},
  'W000779':{id:'W000779',full_name:'Ron Wyden',first_name:'Ron',last_name:'Wyden',party:'D',state:'OR',chamber:'senate',district:null,title:'Sen.',dw_nominate:-.44,next_election:'2026',twitter_handle:'RonWyden',url:'https://wyden.senate.gov',total_votes:3104,missed_votes_pct:2.1,party_loyalty_pct:93.7},
  'C000880':{id:'C000880',full_name:'Mike Crapo',first_name:'Mike',last_name:'Crapo',party:'R',state:'ID',chamber:'senate',district:null,title:'Sen.',dw_nominate:.61,next_election:'2026',twitter_handle:'MikeCrapo',url:'https://crapo.senate.gov',total_votes:2988,missed_votes_pct:3.8,party_loyalty_pct:91.2},
};

const MOCK_VOTES = {
  'O000172':[
    {id:1,position:'Yes',question:'On Passage',description:'American Rescue Plan Act',vote_date:'2021-03-06',congress:117,title:'American Rescue Plan Act',short_title:'American Rescue Plan',primary_subject:'Economics and Public Finance'},
    {id:2,position:'Yes',question:'On Passage',description:'Green New Deal Resolution',vote_date:'2021-02-11',congress:117,title:'Green New Deal Resolution',short_title:'Green New Deal',primary_subject:'Environmental Protection'},
    {id:3,position:'Yes',description:"Women's Health Protection Act",vote_date:'2022-05-11',congress:117,title:"Women's Health Protection Act",short_title:'WHPA',primary_subject:'Health'},
    {id:4,position:'No',description:'Israel Security Supplemental',vote_date:'2024-02-08',congress:118,title:'Israel Security Supplemental',short_title:'Israel Aid',primary_subject:'International Affairs'},
    {id:5,position:'Yes',description:'Bipartisan Background Checks Act',vote_date:'2023-09-20',congress:118,title:'Bipartisan Background Checks Act',primary_subject:'Crime and Law Enforcement'},
    {id:6,position:'No',description:'NDAA FY2024',vote_date:'2023-12-13',congress:118,title:'NDAA FY2024',primary_subject:'Armed Forces and National Security'},
    {id:7,position:'Yes',description:'Medicare for All Act',vote_date:'2023-05-17',congress:118,title:'Medicare for All Act',primary_subject:'Health'},
    {id:8,position:'No',description:'Bipartisan Infrastructure Act',vote_date:'2021-11-05',congress:117,title:'Bipartisan Infrastructure Act',primary_subject:'Transportation and Public Works'},
  ],
};

const ZIP_MAP = {
  '10001':{city:'New York',state:'NY',ids:['O000172','W000817']},
  '10014':{city:'New York',state:'NY',ids:['O000172','W000817']},
  '90210':{city:'Beverly Hills',state:'CA',ids:['P000197','W000779']},
  '90001':{city:'Los Angeles',state:'CA',ids:['P000197','W000779']},
  '60601':{city:'Chicago',state:'IL',ids:['W000817','C000880']},
  '77001':{city:'Houston',state:'TX',ids:['G000596','C001098']},
  '77002':{city:'Houston',state:'TX',ids:['G000596','C001098']},
  '02101':{city:'Boston',state:'MA',ids:['W000817','O000172']},
  '02108':{city:'Boston',state:'MA',ids:['W000817','O000172']},
  '83701':{city:'Boise',state:'ID',ids:['C000880','C001098']},
  '05401':{city:'Burlington',state:'VT',ids:['S000033','W000779']},
  '97201':{city:'Portland',state:'OR',ids:['W000779','O000172']},
};

const DEFAULT = {city:'United States',state:'US',ids:['W000817','C001098']};

function isMockMode() {
  const key = process.env.CONGRESS_API_KEY;
  return !key || key === 'your_congress_key_here' || key === 'your_propublica_key_here';
}

function buildRepresentativeResponse(zip) {
  const found = ZIP_MAP[zip] || DEFAULT;
  const representatives = found.ids.map(id => {
    const pol = MOCK_POLITICIANS[id];
    if (!pol) return null;
    return {
      name: pol.full_name, office: `${found.state} · ${pol.chamber === 'senate' ? 'U.S. Senate' : 'U.S. House'}`,
      level: 'federal', role: pol.chamber === 'senate' ? 'senator' : 'representative',
      party: pol.party, phone: null, url: pol.url, photoUrl: null,
      bioguideId: id,
      profile: {
        id: pol.id, fullName: pol.full_name, party: pol.party, state: pol.state,
        chamber: pol.chamber, district: pol.district, title: pol.title,
        totalVotes: pol.total_votes, missedVotesPct: pol.missed_votes_pct,
        partyLoyaltyPct: pol.party_loyalty_pct, dwNominate: pol.dw_nominate,
        nextElection: pol.next_election, twitterHandle: pol.twitter_handle,
        biasScores: [], aiAnalysis: null,
      },
      hasBiasData: false, hasVoteData: true,
    };
  }).filter(Boolean);

  return { state: found.state, city: found.city, zip, representatives, pendingAnalysis: [] };
}

function getMockVotes(politicianId, page = 0) {
  const votes = MOCK_VOTES[politicianId] || [];
  const limit = 25;
  return { votes: votes.slice(page * limit, (page + 1) * limit), total: votes.length, page, pages: Math.ceil(votes.length / limit) };
}

module.exports = { isMockMode, buildRepresentativeResponse, getMockVotes, MOCK_POLITICIANS };
