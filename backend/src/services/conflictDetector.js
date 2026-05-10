// src/services/conflictDetector.js
// Cross-references employer donor data with a politician's voting record to
// flag potential conflicts of interest. Results cached in fec_conflicts for 7 days.
//
// FEC donor data is fetched browser-side (api.fec.gov may not resolve from
// the server) and posted to POST /api/politicians/:id/conflicts.
// GET /api/politicians/:id/conflicts returns the cached result only.

const db = require('../db');
const { classifyVote, effectivePosition } = require('./domainClassifier');

const MIN_DONATION       = 500;
const MIN_VOTES          = 2;
const CONFLICT_THRESHOLD = 50;
const CACHE_DAYS         = 7;

const SECTOR_MAP = [
  {
    industry: 'Oil, Gas & Coal',
    domain: 'climate',
    keywords: [
      // Generic terms
      'oil', 'petroleum', 'fossil fuel', 'coal', 'refin', 'natural gas', 'lng',
      'midstream', 'oilfield', 'frack', 'shale', 'pipeline',
      // Major integrated companies
      'exxon', 'chevron', 'conoco', 'conocophillips', 'shell', 'mobil', 'bp ',
      'total energies', 'equinor', 'eni ',
      // US independents (esp. TX/OK/WY)
      'pioneer natural', 'occidental', 'devon energy', 'apache corp', 'apa corp',
      'coterra', 'diamondback', 'ovintiv', 'encana', 'callon petroleum',
      'continental resources', 'range resources', 'southwestern energy',
      'antero resources', 'cabot oil', 'sm energy', 'civitas', 'denbury',
      'laramie', 'whiting petroleum', 'oasis petroleum', 'laredo petroleum',
      // Oilfield services
      'halliburton', 'schlumberger', 'slb ', 'baker hughes', 'weatherford',
      'archrock', 'newpark', 'cactus inc', 'patterson-uti', 'nabors',
      // Pipelines & midstream
      'enterprise products', 'energy transfer', 'kinder morgan', 'oneok',
      'williams companies', 'targa resources', 'magellan midstream', 'plains all',
      // Refining & marketing
      'valero', 'phillips 66', 'marathon', 'sunoco', 'hf sinclair', 'holly frontier',
      'par pacific', 'pbf energy',
      // Coal
      'peabody', 'arch coal', 'consol energy', 'foresight energy', 'alpha natural',
    ],
  },
  {
    industry: 'Defense & Aerospace',
    domain: 'defense',
    keywords: [
      'lockheed', 'raytheon', 'boeing', 'northrop', 'general dynamics', 'l3harris',
      'bae systems', 'huntington ingalls', 'leidos', 'saic', 'booz allen', 'textron',
      'general atomics', 'sierra nevada', 'caci ', 'mpri ', 'drs technologies',
      'orbital sciences', 'aerojet', 'heico', 'transdigm',
    ],
  },
  {
    industry: 'Pharmaceutical',
    domain: 'healthcare',
    keywords: [
      'pharma', 'pfizer', 'merck', 'abbvie', 'johnson &', 'eli lilly', 'bristol',
      'novartis', 'amgen', 'biogen', 'gilead', 'astrazeneca', 'genentech', 'sanofi',
      'regeneron', 'moderna', 'bayer', 'biotechnology', 'biopharmaceutical',
      'allergan', 'celgene', 'mylan', 'teva ', 'viatris', 'bausch', 'shire',
      'alexion', 'vertex pharma', 'incyte',
    ],
  },
  {
    industry: 'Health Insurance',
    domain: 'healthcare',
    keywords: [
      'unitedhealth', 'anthem', 'cigna', 'aetna', 'humana', 'centene', 'molina',
      'managed care', 'wellpoint', 'elevance', 'bcbs', 'blue cross', 'blue shield',
      'carefirst', 'health net', 'oscar health',
    ],
  },
  {
    industry: 'Finance & Banking',
    domain: 'economy',
    keywords: [
      // Major banks & brokerages
      'goldman sachs', 'jpmorgan', 'jp morgan', 'morgan stanley', 'wells fargo',
      'citigroup', 'citibank', 'bank of america', 'merrill lynch', 'deutsche bank',
      'barclays', 'ubs ', 'credit suisse', 'hsbc', 'pnc bank', 'us bank', 'truist',
      'regions bank', 'fifth third', 'keycorp', 'suntrust',
      // Asset management & PE
      'blackstone', 'blackrock', 'carlyle', 'kkr', 'apollo global', 'bain capital',
      'tpg capital', 'warburg pincus', 'advent international', 'cerberus',
      'fortress investment', 'lone star', 'silver lake', 'vista equity',
      // Hedge funds
      'citadel', 'bridgewater', 'two sigma', 'renaissance technologies', 'point72',
      'millennium management', 'd.e. shaw', 'elliott management', 'soros fund',
      // Generic
      'private equity', 'hedge fund', 'asset management', 'investment bank',
      'financial group', 'financial services', 'securities', 'capital management',
      'venture capital',
    ],
  },
  {
    industry: 'Firearms & NRA',
    domain: 'gun_policy',
    keywords: [
      'national rifle association', 'nra ', 'firearm', 'smith & wesson',
      'american outdoor brands', 'ruger', 'sig sauer', 'winchester', 'ammunition',
      'sturm ruger', 'taurus', 'glock', 'beretta',
    ],
  },
  {
    industry: 'Tobacco & Vaping',
    domain: 'healthcare',
    keywords: [
      'altria', 'philip morris', 'reynolds american', 'tobacco', 'lorillard', 'juul',
      'vector group', 'standard commercial',
    ],
  },
];

const PROGRESSIVE_IS_YES = {
  healthcare: true, climate: true, immigration: false, gun_policy: true,
  economy: true, defense: false, reproductive_rights: true, education: true,
  safety_net: true, criminal_justice: false, voting_rights: true, infrastructure: true,
};

const NOISE = new Set([
  'SELF-EMPLOYED', 'SELF EMPLOYED', 'RETIRED', 'NONE', 'NOT EMPLOYED',
  'UNEMPLOYED', 'HOMEMAKER', 'STUDENT', 'N/A', 'NA', 'INFORMATION REQUESTED',
  'INFORMATION REQUESTED PER BEST EFFORTS', 'NOT EMPLOYED/RETIRED',
]);

// Returns cached conflicts or null if not cached / stale
async function getCachedConflicts(politicianId) {
  const result = await db.query(`
    SELECT conflicts, fec_candidate_id, top_donors
    FROM fec_conflicts
    WHERE politician_id = $1
      AND computed_at > NOW() - INTERVAL '${CACHE_DAYS} days'
  `, [politicianId]);
  if (!result.rows.length) return null;
  return {
    conflicts:      result.rows[0].conflicts,
    topDonors:      result.rows[0].top_donors,
    fecCandidateId: result.rows[0].fec_candidate_id,
    fromCache:      true,
  };
}

// Cross-references a pre-supplied employer list against the politician's votes.
// Called after the browser fetches employer data from FEC directly.
async function detectConflictsFromEmployers(politicianId, employers, fecCandidateId = null) {
  const significant = employers.filter(e =>
    !NOISE.has((e.employer || '').trim().toUpperCase()) && (e.total || 0) >= MIN_DONATION
  );

  // Get politician's votes classified by domain
  const votesResult = await db.query(`
    SELECT v.position, v.description, v.question,
           b.title, b.short_title, b.primary_subject, b.categories
    FROM votes v
    LEFT JOIN bills b ON v.bill_id = b.id
    WHERE v.politician_id = $1 AND v.position IN ('Yes', 'No')
  `, [politicianId]);

  const domainVotes = {};
  for (const vote of votesResult.rows) {
    const domain = classifyVote(vote);
    if (!domain) continue;
    if (!domainVotes[domain]) domainVotes[domain] = { yes: 0, no: 0, total: 0 };
    const pos = effectivePosition(vote);
    if (pos === 'Yes') domainVotes[domain].yes++;
    else               domainVotes[domain].no++;
    domainVotes[domain].total++;
  }

  const conflicts = [];
  const seenKey = new Set();

  for (const emp of significant) {
    const sector = classifyEmployer(emp.employer);
    if (!sector) continue;

    const key = `${sector.industry}:${sector.domain}`;
    if (seenKey.has(key)) continue;

    const dv = domainVotes[sector.domain];
    if (!dv || dv.total < MIN_VOTES) continue;

    const progressiveIsYes = PROGRESSIVE_IS_YES[sector.domain] ?? true;
    const progressiveVotes = progressiveIsYes ? dv.yes : dv.no;
    const progressivePct   = Math.round((progressiveVotes / dv.total) * 100);
    const conflictScore    = 100 - progressivePct;

    if (conflictScore >= CONFLICT_THRESHOLD) {
      seenKey.add(key);
      conflicts.push({
        donor_org:          toTitleCase(emp.employer),
        industry:           sector.industry,
        domain:             sector.domain,
        donor_amount:       Math.round(emp.total),
        vote_alignment_pct: conflictScore,
        vote_count:         dv.total,
      });
    }
  }

  conflicts.sort((a, b) =>
    b.vote_alignment_pct - a.vote_alignment_pct || b.donor_amount - a.donor_amount
  );

  const topDonors = significant.slice(0, 10).map(e => ({
    employer: toTitleCase(e.employer),
    total: Math.round(e.total),
  }));

  await save(politicianId, fecCandidateId, topDonors, conflicts);
  return { conflicts, topDonors, fecCandidateId };
}

function classifyEmployer(name) {
  const n = (name || '').toLowerCase();
  for (const sector of SECTOR_MAP) {
    if (sector.keywords.some(kw => n.includes(kw))) return sector;
  }
  return null;
}

function toTitleCase(str) {
  return (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

async function save(politicianId, fecCandidateId, topDonors, conflicts) {
  await db.query(`
    INSERT INTO fec_conflicts (politician_id, fec_candidate_id, top_donors, conflicts)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (politician_id) DO UPDATE SET
      fec_candidate_id = $2, top_donors = $3, conflicts = $4, computed_at = NOW()
  `, [politicianId, fecCandidateId, JSON.stringify(topDonors), JSON.stringify(conflicts)]);
}

module.exports = { getCachedConflicts, detectConflictsFromEmployers };
