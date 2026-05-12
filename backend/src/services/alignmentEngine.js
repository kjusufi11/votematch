// src/services/alignmentEngine.js
// Calculates alignment score between a user's survey answers and a politician's voting record

const db = require('../db');

// Maps extended survey policy_depth answers → (issueId, conservativeScore 0–1)
// Used to blend a more precise position signal into the base alignment score.
const DEPTH_MAP = {
  healthcare: { issue: 'healthcare', scores: { single_payer: 0, hybrid: 0.375, private: 0.875 } },
  trade:      { issue: 'taxes',      scores: { free_trade: 0.25, case_by_case: 0.5, protectionist: 0.75 } },
  immigration: { issue: 'immigration', scores: { path_citizenship: 0, guest_worker: 0.5, deportation: 1 } },
  defense:    { issue: 'defense',    scores: { reduce: 0, maintain: 0.5, increase: 1 } },
  tax:        { issue: 'taxes',      scores: { wealth_tax: 0, progressive: 0.25, flat: 0.875 } },
};

// Maps issue IDs from the survey to vote categories/keywords in our DB
const ISSUE_VOTE_MAPPING = {
  healthcare: {
    keywords: ['health', 'medicare', 'medicaid', 'aca', 'affordable care', 'insulin', 'drug price', 'prescription'],
    // positive value = votes FOR expanded healthcare (liberal position)
    // negative value = votes AGAINST expanded healthcare (conservative position)
    progressiveVotes: ['yes'], // voting yes on healthcare expansion = progressive
  },
  climate: {
    keywords: ['climate', 'environment', 'clean energy', 'renewable', 'epa', 'carbon', 'emission', 'green'],
    progressiveVotes: ['yes'],
  },
  immigration: {
    keywords: ['immigr', 'border', 'dhs', 'asylum', 'visa', 'deportat', 'alien', 'citizenship'],
    progressiveVotes: ['no'], // voting NO on strict immigration = progressive
  },
  gun_policy: {
    keywords: ['gun', 'firearm', 'weapon', 'background check', 'second amendment', 'nra'],
    progressiveVotes: ['yes'], // voting YES on gun control = progressive
  },
  taxes: {
    keywords: ['tax', 'revenue', 'irs', 'budget reconcil', 'fiscal', 'deficit', 'debt ceiling'],
    progressiveVotes: ['yes'], // voting YES on tax increases = progressive
  },
  defense: {
    keywords: ['defense', 'military', 'ndaa', 'armed forces', 'pentagon', 'nato', 'ukraine', 'israel aid'],
    progressiveVotes: ['no'], // voting NO on military spending increases = progressive
  },
  reproductive_rights: {
    keywords: ['abortion', 'reproductive', 'planned parenthood', 'contraception', 'women\'s health protection'],
    progressiveVotes: ['yes'], // voting YES on reproductive rights = progressive
  },
  education: {
    keywords: ['education', 'school', 'student loan', 'pell grant', 'title', 'dept of ed'],
    progressiveVotes: ['yes'], // voting YES on education funding = progressive
  },
  safety_net: {
    keywords: ['snap', 'food stamp', 'welfare', 'tanf', 'housing', 'medicaid', 'social security', 'poverty'],
    progressiveVotes: ['yes'],
  },
  criminal_justice: {
    keywords: ['criminal justice', 'police', 'prison', 'sentencing', 'incarcerat', 'fbi', 'doj', 'crime'],
    progressiveVotes: ['no'], // voting NO on harsher sentencing = progressive
  },
};

// Convert user's survey position (-2 to 2) to a 0-1 scale
// -2 = fully progressive, +2 = fully conservative
function userPositionToScore(value) {
  return (value + 2) / 4; // maps -2->0, -1->0.25, 0->0.5, 1->0.75, 2->1
}

// Calculate politician's position on an issue from their votes (0=progressive, 1=conservative)
function politicianPositionOnIssue(votes, issueConfig) {
  if (!votes || votes.length === 0) return null;

  let progressiveCount = 0;
  let conservativeCount = 0;

  for (const vote of votes) {
    const pos = vote.position?.toLowerCase();
    if (pos === 'not voting' || pos === 'present') continue;

    const isProgressiveVote = issueConfig.progressiveVotes.includes(pos);
    if (isProgressiveVote) progressiveCount++;
    else conservativeCount++;
  }

  const total = progressiveCount + conservativeCount;
  if (total === 0) return null;

  // Returns 0 (fully progressive) to 1 (fully conservative)
  return conservativeCount / total;
}

async function calculateAlignment(userId, politicianId) {
  // 1. Get user's survey answers
  const surveyResult = await db.query(
    'SELECT answers, importance FROM user_surveys WHERE user_id = $1',
    [String(userId)]
  );

  if (!surveyResult.rows.length) return null;

  const { answers, importance } = surveyResult.rows[0];
  const answeredIssues = Object.keys(answers).filter(k => answers[k] !== undefined && answers[k] !== null);

  if (answeredIssues.length === 0) return null;

  // Load extended survey policy depth (best-effort — non-fatal if missing)
  let policyDepth = {};
  try {
    const extResult = await db.query(
      'SELECT policy_depth FROM extended_survey_responses WHERE user_id = $1',
      [String(userId)]
    );
    if (extResult.rows.length) policyDepth = extResult.rows[0].policy_depth || {};
  } catch {}

  // Build a depth override map: issueId → precise conservativeScore (0–1)
  const depthOverrides = {};
  for (const [depthKey, cfg] of Object.entries(DEPTH_MAP)) {
    const answer = policyDepth[depthKey];
    if (answer && cfg.scores[answer] !== undefined) {
      depthOverrides[cfg.issue] = cfg.scores[answer];
    }
  }

  // 2. For each answered issue, get politician's relevant votes
  let totalWeight = 0;
  let weightedAgreement = 0;
  const breakdown = [];

  for (const issueId of answeredIssues) {
    const issueConfig = ISSUE_VOTE_MAPPING[issueId];
    if (!issueConfig) continue;

    const userValue = answers[issueId];
    const importanceWeight = importance?.[issueId] || 2; // 1-3

    // Build keyword query
    const keywordConditions = issueConfig.keywords.map((_, i) =>
      `(LOWER(v.description) LIKE $${i + 2} OR LOWER(b.title) LIKE $${i + 2} OR LOWER(v.question) LIKE $${i + 2})`
    ).join(' OR ');

    const keywordParams = issueConfig.keywords.map(k => `%${k}%`);

    const votesResult = await db.query(`
      SELECT v.position, v.description, b.title
      FROM votes v
      LEFT JOIN bills b ON v.bill_id = b.id
      WHERE v.politician_id = $1
      AND (${keywordConditions})
      AND v.position NOT IN ('Not Voting', 'Present')
      LIMIT 100
    `, [politicianId, ...keywordParams]);

    const relevantVotes = votesResult.rows;
    if (relevantVotes.length < 2) continue; // Not enough data for this issue

    // Calculate politician's position on this issue (0=progressive, 1=conservative)
    const politicianScore = politicianPositionOnIssue(relevantVotes, issueConfig);
    if (politicianScore === null) continue;

    // User's position (0=progressive, 1=conservative)
    // If policy depth gave us a precise override for this issue, blend it in (weighted 2:1 over basic answer)
    const baseUserScore = userPositionToScore(userValue);
    const depthScore = depthOverrides[issueId];
    const userScore = depthScore !== undefined
      ? (baseUserScore + depthScore * 2) / 3
      : baseUserScore;

    // Agreement = 1 - |difference| (1 = perfect agreement, 0 = complete disagreement)
    const agreement = 1 - Math.abs(userScore - politicianScore);

    // Boost importance weight for issues where user provided depth detail
    const effectiveWeight = depthScore !== undefined ? Math.min(importanceWeight + 1, 3) : importanceWeight;

    totalWeight += effectiveWeight;
    weightedAgreement += agreement * effectiveWeight;

    breakdown.push({
      issue: issueId,
      label: issueId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      userPosition: userValue,
      politicianScore: Math.round(politicianScore * 100),
      agreement: Math.round(agreement * 100),
      importance: importanceWeight,
      voteCount: relevantVotes.length,
    });
  }

  if (totalWeight === 0) return null;

  const overallScore = Math.round((weightedAgreement / totalWeight) * 100);

  return {
    score: overallScore,
    breakdown: breakdown.sort((a, b) => b.importance - a.importance),
    issuesAnalyzed: breakdown.length,
    issuesAnswered: answeredIssues.length,
  };
}

// Calculate alignment for all of a user's representatives
async function calculateAlignmentForReps(userId, politicianIds) {
  const results = {};
  for (const polId of politicianIds) {
    try {
      results[polId] = await calculateAlignment(userId, polId);
    } catch (err) {
      console.warn(`Alignment calc failed for ${polId}:`, err.message);
      results[polId] = null;
    }
  }
  return results;
}

module.exports = { calculateAlignment, calculateAlignmentForReps };
