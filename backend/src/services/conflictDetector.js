// src/services/conflictDetector.js
// Cross-references FEC campaign donor data with a politician's voting record to
// flag potential conflicts of interest. Results cached in fec_conflicts for 7 days.

const db = require('../db');
const fec = require('./fec');
const { classifyVote } = require('./domainClassifier');

const MIN_DONATION       = 10000;  // ignore employers below this total
const MIN_VOTES          = 5;      // need at least this many votes in a domain
const CONFLICT_THRESHOLD = 80;     // % vote alignment with donor interest to flag
const CACHE_DAYS         = 7;

// Employer name keyword → industry + domain
// All entries here want politicians to vote *against* progressive legislation
// in their domain, so: conflictScore = 100 − politicianProgressivePct
const SECTOR_MAP = [
  {
    industry: 'Oil, Gas & Coal',
    domain: 'climate',
    keywords: [
      'oil', 'gas', 'petroleum', 'exxon', 'chevron', 'conoco', 'shell', 'mobil',
      'fossil fuel', 'pipeline', 'refin', 'coal', 'peabody', 'arch coal',
      'halliburton', 'schlumberger', 'marathon', 'valero', 'phillips 66',
    ],
  },
  {
    industry: 'Defense & Aerospace',
    domain: 'defense',
    keywords: [
      'lockheed', 'raytheon', 'boeing', 'northrop', 'general dynamics', 'l3harris',
      'bae systems', 'huntington ingalls', 'leidos', 'saic', 'booz allen',
      'textron', 'sierra nevada',
    ],
  },
  {
    industry: 'Pharmaceutical',
    domain: 'healthcare',
    keywords: [
      'pharma', 'pfizer', 'merck', 'abbvie', 'johnson &', 'eli lilly', 'bristol',
      'novartis', 'amgen', 'biogen', 'gilead', 'astrazeneca', 'genentech', 'sanofi',
      'regeneron', 'moderna', 'bayer', 'biotechnology', 'biopharmaceutical',
    ],
  },
  {
    industry: 'Health Insurance',
    domain: 'healthcare',
    keywords: [
      'unitedhealth', 'anthem', 'cigna', 'aetna', 'humana', 'centene', 'molina',
      'managed care', 'wellpoint',
    ],
  },
  {
    industry: 'Finance & Banking',
    domain: 'economy',
    keywords: [
      'goldman sachs', 'jpmorgan', 'jp morgan', 'morgan stanley', 'wells fargo',
      'citigroup', 'citibank', 'bank of america', 'blackstone', 'blackrock',
      'carlyle', 'kkr', 'private equity', 'investment bank',
      'merrill lynch', 'deutsche bank', 'barclays',
    ],
  },
  {
    industry: 'Firearms & NRA',
    domain: 'gun_policy',
    keywords: [
      'national rifle association', 'nra ', 'firearm', 'smith & wesson',
      'american outdoor brands', 'ruger', 'sig sauer', 'winchester', 'ammunition',
    ],
  },
  {
    industry: 'Tobacco & Vaping',
    domain: 'healthcare',
    keywords: [
      'altria', 'philip morris', 'reynolds american', 'tobacco', 'lorillard',
      'juul', 'vaping',
    ],
  },
];

// Whether a YES vote is the "progressive" position per domain.
// Mirrors the same map in alignmentEngine.js.
const PROGRESSIVE_IS_YES = {
  healthcare: true, climate: true, immigration: false, gun_policy: true,
  economy: true, defense: false, reproductive_rights: true, education: true,
  safety_net: true, criminal_justice: false, voting_rights: true, infrastructure: true,
};

// Employer name strings to skip — individual circumstances, not industries
const NOISE = new Set([
  'SELF-EMPLOYED', 'SELF EMPLOYED', 'RETIRED', 'NONE', 'NOT EMPLOYED',
  'UNEMPLOYED', 'HOMEMAKER', 'STUDENT', 'N/A', 'NA', 'INFORMATION REQUESTED',
  'INFORMATION REQUESTED PER BEST EFFORTS', 'NOT EMPLOYED/RETIRED',
]);

async function detectConflicts(politicianId) {
  // Return cached result if fresh
  const cached = await db.query(`
    SELECT conflicts, fec_candidate_id, top_donors
    FROM fec_conflicts
    WHERE politician_id = $1
      AND computed_at > NOW() - INTERVAL '${CACHE_DAYS} days'
  `, [politicianId]);
  if (cached.rows.length) {
    return {
      conflicts:      cached.rows[0].conflicts,
      topDonors:      cached.rows[0].top_donors,
      fecCandidateId: cached.rows[0].fec_candidate_id,
      fromCache:      true,
    };
  }

  const polResult = await db.query(
    'SELECT full_name, state, chamber FROM politicians WHERE id = $1',
    [politicianId]
  );
  if (!polResult.rows.length) return { conflicts: [], topDonors: [] };
  const { full_name, state, chamber } = polResult.rows[0];

  // Look up FEC candidate
  const fecCandidateId = await fec.findCandidateId(full_name, state, chamber);
  if (!fecCandidateId) {
    await save(politicianId, null, [], []);
    return { conflicts: [], topDonors: [], fecCandidateId: null };
  }

  // Fetch top employer donors
  const committeeId   = await fec.getCommitteeId(fecCandidateId);
  const allEmployers  = committeeId ? await fec.getTopEmployers(committeeId) : [];
  const employers     = allEmployers.filter(e => !NOISE.has(e.employer) && e.total >= MIN_DONATION);

  // Classify politician's votes by domain
  const votesResult = await db.query(`
    SELECT v.position, v.description, v.question,
           b.title, b.short_title, b.primary_subject, b.categories
    FROM votes v
    LEFT JOIN bills b ON v.bill_id = b.id
    WHERE v.politician_id = $1
      AND v.position IN ('Yes', 'No')
  `, [politicianId]);

  const domainVotes = {};
  for (const vote of votesResult.rows) {
    const domain = classifyVote(vote);
    if (!domain) continue;
    if (!domainVotes[domain]) domainVotes[domain] = { yes: 0, no: 0, total: 0 };
    if (vote.position === 'Yes') domainVotes[domain].yes++;
    else                         domainVotes[domain].no++;
    domainVotes[domain].total++;
  }

  // Detect conflicts
  const conflicts = [];
  const seenDomain = new Set(); // one conflict flagged per industry+domain pair

  for (const emp of employers) {
    const sector = classifyEmployer(emp.employer);
    if (!sector) continue;

    const key = `${sector.industry}:${sector.domain}`;
    if (seenDomain.has(key)) continue;

    const dv = domainVotes[sector.domain];
    if (!dv || dv.total < MIN_VOTES) continue;

    const progressiveIsYes = PROGRESSIVE_IS_YES[sector.domain] ?? true;
    const progressiveVotes = progressiveIsYes ? dv.yes : dv.no;
    const progressivePct   = Math.round((progressiveVotes / dv.total) * 100);
    const conflictScore    = 100 - progressivePct; // how often they vote WITH donor interest

    if (conflictScore >= CONFLICT_THRESHOLD) {
      seenDomain.add(key);
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

  const topDonors = employers.slice(0, 10).map(e => ({
    employer: toTitleCase(e.employer),
    total: Math.round(e.total),
  }));

  await save(politicianId, fecCandidateId, topDonors, conflicts);
  return { conflicts, topDonors, fecCandidateId };
}

function classifyEmployer(name) {
  const n = name.toLowerCase();
  for (const sector of SECTOR_MAP) {
    if (sector.keywords.some(kw => n.includes(kw))) return sector;
  }
  return null;
}

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

async function save(politicianId, fecCandidateId, topDonors, conflicts) {
  await db.query(`
    INSERT INTO fec_conflicts (politician_id, fec_candidate_id, top_donors, conflicts)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (politician_id) DO UPDATE SET
      fec_candidate_id = $2, top_donors = $3, conflicts = $4, computed_at = NOW()
  `, [politicianId, fecCandidateId, JSON.stringify(topDonors), JSON.stringify(conflicts)]);
}

module.exports = { detectConflicts };
