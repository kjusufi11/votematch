// src/services/domainClassifier.js
// Classifies votes into clean policy domains for better alignment breakdowns

const DOMAINS = {
  healthcare: {
    label: 'Healthcare',
    icon: '🏥',
    keywords: [
      'health', 'medicare', 'medicaid', 'aca', 'affordable care', 'insulin',
      'drug price', 'prescription', 'hospital', 'opioid', 'mental health',
      'public health', 'fda', 'cdc', 'vaccine', 'insurance coverage'
    ],
  },
  climate: {
    label: 'Climate & Energy',
    icon: '🌱',
    keywords: [
      'climate', 'environment', 'clean energy', 'renewable', 'epa', 'carbon',
      'emission', 'green', 'solar', 'wind energy', 'fossil fuel', 'pollution',
      'paris agreement', 'clean air', 'clean water', 'conservation', 'drilling',
      // ProPublica/Congress.gov primary_subject values
      'energy', 'natural resources', 'oil and gas', 'petroleum', 'keystone',
      'offshore', 'arctic refuge', 'public lands',
    ],
  },
  economy: {
    label: 'Economy & Taxes',
    icon: '💰',
    keywords: [
      'tax', 'revenue', 'irs', 'budget reconcil', 'fiscal', 'deficit',
      'debt ceiling', 'economic', 'trade', 'tariff', 'inflation', 'gdp',
      'minimum wage', 'labor', 'jobs', 'unemployment', 'small business',
      'wall street', 'banking', 'financial regulation', 'federal reserve',
      // ProPublica/Congress.gov primary_subject values
      'dodd-frank', 'consumer financial', 'securities regulation',
    ],
  },
  immigration: {
    label: 'Immigration',
    icon: '🗽',
    keywords: [
      'immigr', 'border', 'dhs', 'asylum', 'visa', 'deportat', 'alien',
      'citizenship', 'daca', 'refugee', 'customs', 'ice ', 'undocumented',
      'green card', 'naturalization', 'border security'
    ],
  },
  gun_policy: {
    label: 'Gun Policy',
    icon: '🔒',
    keywords: [
      'gun', 'firearm', 'weapon', 'background check', 'second amendment',
      'nra', 'assault', 'ammunition', 'concealed carry', 'red flag'
    ],
  },
  defense: {
    label: 'Defense & Foreign Policy',
    icon: '🌐',
    keywords: [
      'defense', 'military', 'ndaa', 'armed forces', 'pentagon', 'nato',
      'ukraine', 'israel', 'foreign aid', 'war', 'troops', 'veteran',
      'intelligence', 'national security', 'department of defense', 'air force',
      'navy', 'army', 'nuclear', 'sanctions', 'diplomatic'
    ],
  },
  reproductive_rights: {
    label: 'Reproductive Rights',
    icon: '⚕️',
    keywords: [
      'abortion', 'reproductive', 'planned parenthood', 'contraception',
      "women's health protection", 'roe', 'fetal', 'pregnancy', 'birth control'
    ],
  },
  education: {
    label: 'Education',
    icon: '📚',
    keywords: [
      'education', 'school', 'student loan', 'pell grant', 'title i',
      'dept of ed', 'department of education', 'teacher', 'college',
      'university', 'head start', 'early childhood', 'curriculum'
    ],
  },
  safety_net: {
    label: 'Social Safety Net',
    icon: '🤝',
    keywords: [
      'snap', 'food stamp', 'welfare', 'tanf', 'housing', 'social security',
      'poverty', 'supplemental', 'disability', 'ssi', 'earned income',
      'child care', 'nutrition', 'homelessness', 'medicaid'
    ],
  },
  criminal_justice: {
    label: 'Criminal Justice',
    icon: '⚖️',
    keywords: [
      'criminal justice', 'police', 'prison', 'sentencing', 'incarcerat',
      'fbi', 'doj', 'crime', 'law enforcement', 'civil rights', 'bail',
      'parole', 'justice reform', 'death penalty', 'drug offense'
    ],
  },
  voting_rights: {
    label: 'Voting & Democracy',
    icon: '🗳️',
    keywords: [
      'voting rights', 'election', 'ballot', 'voter id', 'gerrymandering',
      'campaign finance', 'fec', 'electoral', 'democracy', 'voter suppression',
      'redistricting', 'dark money'
    ],
  },
  infrastructure: {
    label: 'Infrastructure',
    icon: '🏗️',
    keywords: [
      'infrastructure', 'highway', 'bridge', 'broadband', 'transit',
      'transportation', 'amtrak', 'airport', 'road', 'water system',
      'electric grid', 'internet access', 'rail'
    ],
  },
};

/**
 * Classify a vote into a domain based on bill/vote text
 * Returns domain key or null if no match
 */
function classifyVote(vote) {
  // Skip personnel and procedural votes — they match policy keywords accidentally
  // or don't reflect the senator's actual policy position.
  const q = vote.question || '';
  if (/\bnomination\b/i.test(q) || /\bPN\d/i.test(q)) return null;
  if (/\bmotion to proceed\b/i.test(q)) return null;
  if (/\bpoint of order\b/i.test(q)) return null;
  if (/\bmotion to discharge\b/i.test(q)) return null;

  const searchText = [
    vote.description || '',
    vote.question || '',
    vote.title || '',         // bill title
    vote.short_title || '',
    vote.primary_subject || '',
    (vote.categories || []).join(' '),
  ].join(' ').toLowerCase();

  let bestDomain = null;
  let bestScore = 0;

  for (const [domainKey, domainConfig] of Object.entries(DOMAINS)) {
    let score = 0;
    for (const keyword of domainConfig.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        // Longer/more specific keywords score higher
        score += keyword.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domainKey;
    }
  }

  // Require minimum score to avoid false positives
  return bestScore >= 4 ? bestDomain : null;
}

/**
 * Get all domains with their metadata
 */
function getAllDomains() {
  return DOMAINS;
}

/**
 * Get domain config by key
 */
function getDomain(key) {
  return DOMAINS[key] || null;
}

// Returns the effective policy position of a vote, accounting for framing where
// YES is the anti-progressive direction:
//   • Congressional Review Act disapprovals: YES = striking down a regulation
//   • "To terminate / eliminate / abolish / defund X": YES = removing the program
function effectivePosition(vote) {
  if (vote.position !== 'Yes' && vote.position !== 'No') return vote.position;
  const desc = (vote.description || '').toLowerCase();
  const inverted =
    /\bcongressional disapproval\b/.test(desc) ||
    /^to (terminate|eliminate|abolish|defund)\b/.test(desc);
  if (!inverted) return vote.position;
  return vote.position === 'Yes' ? 'No' : 'Yes';
}

module.exports = { classifyVote, effectivePosition, getAllDomains, getDomain };
