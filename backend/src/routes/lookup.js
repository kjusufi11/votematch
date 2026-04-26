// src/routes/lookup.js
// POST /api/lookup/zip — resolves ZIP to representatives via Census + Congress.gov

const express = require('express');
const router  = express.Router();
const geocode = require('../services/geocode');
const congress = require('../services/congress');
const sync    = require('../services/sync');
const db      = require('../db');
const mockData = require('../services/mockData');

router.post('/zip', async (req, res) => {
  const { zip } = req.body;

  if (!zip || !/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: 'Please provide a valid 5-digit ZIP code.' });
  }

  // Mock mode
  if (mockData.isMockMode()) {
    console.log(`[MOCK] ZIP lookup: ${zip}`);
    return res.json(mockData.buildRepresentativeResponse(zip));
  }

  try {
    // 1. Resolve ZIP to state + congressional district via Census Bureau
    const { state, district } = await geocode.getDistrictFromZip(zip);

    if (!state) {
      return res.status(404).json({ error: `Could not determine state for ZIP code ${zip}` });
    }

    // 2. Get senators for this state from Congress.gov
    const [senators, houseReps] = await Promise.all([
      congress.getMembersByState(state, 'senate').catch(() => []),
      district
        ? congress.getMembersByState(state, 'house').catch(() => [])
        : Promise.resolve([]),
    ]);

    // Filter house reps to this specific district
    const districtRep = district
      ? houseReps.filter(r => !r.district || r.district == district || String(r.district) === String(district))
      : houseReps.slice(0, 1);

    const allReps = [
      ...senators.slice(0, 2).map(s => ({ ...s, role: 'senator', level: 'federal' })),
      ...districtRep.slice(0, 1).map(r => ({ ...r, role: 'representative', level: 'federal' })),
    ];

    if (!allReps.length) {
      return res.status(404).json({ error: `No representatives found for ZIP code ${zip}` });
    }

    // 3. Extract bioguide IDs
    const bioguideIds = allReps.map(r => r.bioguideId).filter(Boolean);

    // 4. Trigger background sync for these politicians
    sync.syncRepresentatives(state, district).catch(err =>
      console.warn('Background sync failed:', err.message)
    );

    // 5. Fetch profiles from DB
    let profiles = [];
    if (bioguideIds.length > 0) {
      const result = await db.query(`
        SELECT p.*,
          COALESCE(
            json_agg(
              json_build_object(
                'category', bs.category, 'label', bs.label,
                'score', bs.score, 'direction', bs.direction,
                'confidence', bs.confidence, 'summary', bs.summary
              )
            ) FILTER (WHERE bs.category IS NOT NULL), '[]'
          ) as bias_scores
        FROM politicians p
        LEFT JOIN bias_scores bs ON bs.politician_id = p.id
        WHERE p.id = ANY($1)
        GROUP BY p.id
      `, [bioguideIds]);
      profiles = result.rows;
    }

    // 6. Build response
    const STATE_NAMES = { AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'Washington D.C.' };

    const representatives = allReps.map(rep => {
      const profile = profiles.find(p => p.id === rep.bioguideId);
      const chamber = rep.role === 'senator' ? 'senate' : 'house';
      return {
        name:       rep.name || rep.directOrderName || `${rep.firstName} ${rep.lastName}`,
        office:     rep.role === 'senator'
          ? `${STATE_NAMES[state] || state} — U.S. Senate`
          : `${STATE_NAMES[state] || state} ${district ? district + (district===1?'st':district===2?'nd':district===3?'rd':'th')+' ' : ''}Congressional District`,
        level:      'federal',
        role:       rep.role,
        party:      normalizeParty(rep.partyHistory?.[0]?.partyAbbreviation || rep.party),
        phone:      null,
        url:        rep.officialWebsiteUrl || profile?.url || null,
        photoUrl:   null,
        bioguideId: rep.bioguideId,
        profile: profile ? {
          id:              profile.id,
          fullName:        profile.full_name,
          party:           profile.party,
          state:           profile.state,
          chamber:         profile.chamber,
          district:        profile.district,
          title:           profile.title,
          totalVotes:      profile.total_votes,
          missedVotesPct:  profile.missed_votes_pct,
          partyLoyaltyPct: profile.party_loyalty_pct,
          dwNominate:      profile.dw_nominate,
          nextElection:    profile.next_election,
          twitterHandle:   profile.twitter_handle,
          biasScores:      profile.bias_scores || [],
          aiAnalysis:      null,
        } : null,
        hasBiasData: (profile?.bias_scores?.length || 0) > 0,
        hasVoteData: (profile?.total_votes || 0) > 0,
      };
    });

    res.json({
      state,
      city: STATE_NAMES[state] || state,
      zip,
      representatives,
      pendingAnalysis: [],
    });

  } catch (err) {
    console.error('ZIP lookup error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function normalizeParty(p) {
  if (!p) return null;
  if (p === 'D' || p === 'Democrat') return 'D';
  if (p === 'R' || p === 'Republican') return 'R';
  return 'I';
}

// Debug endpoint
router.get('/test-zip', async (req, res) => {
  const { zip } = req.query;
  if (!zip) return res.status(400).json({ error: 'Pass ?zip=10001' });
  try {
    const result = await geocode.getDistrictFromZip(zip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
