// src/routes/politicians.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const biasEngine = require('../services/biasEngine');
const sync = require('../services/sync');
const mockData = require('../services/mockData');
const { classifyVote, getAllDomains } = require('../services/domainClassifier');
const { calculateAlignment } = require('../services/alignmentEngine');

// GET /api/politicians/debug/count — must be BEFORE /:id route
router.get('/debug/count', async (req, res) => {
  try {
    const total  = await db.query('SELECT COUNT(*) FROM politicians');
    const ny     = await db.query("SELECT COUNT(*) FROM politicians WHERE state = 'NY'");
    const senate = await db.query("SELECT COUNT(*) FROM politicians WHERE chamber = 'senate'");
    const active = await db.query("SELECT COUNT(*) FROM politicians WHERE in_office = true");
    const sample = await db.query('SELECT id, full_name, state, chamber, in_office FROM politicians LIMIT 5');
    res.json({
      total:        total.rows[0].count,
      ny_count:     ny.rows[0].count,
      senate_count: senate.rows[0].count,
      active_count: active.rows[0].count,
      sample:       sample.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});


// GET /api/politicians?state=NY&chamber=senate
router.get('/', async (req, res) => {
  const { q, state, chamber, party } = req.query;
  try {
    const conditions = ['p.in_office = true'];
    const params = [];
    if (q)       { params.push(`%${q}%`);             conditions.push(`p.full_name ILIKE $${params.length}`); }
    if (state)   { params.push(state.toUpperCase());   conditions.push(`p.state = $${params.length}`); }
    if (chamber) { params.push(chamber.toLowerCase()); conditions.push(`p.chamber = $${params.length}`); }
    if (party)   { params.push(party.toUpperCase());   conditions.push(`p.party = $${params.length}`); }

    const result = await db.query(`
      SELECT id, full_name, party, state, chamber, district, title, total_votes, party_loyalty_pct
      FROM politicians p
      WHERE ${conditions.join(' AND ')}
      ORDER BY last_name LIMIT 50
    `, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ⚠️ All /:id/subroutes MUST come before /:id

// GET /api/politicians/:id/alignment?userId=123
router.get('/:id/alignment', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const overall = await calculateAlignment(userId, id);
    if (!overall) {
      return res.json({ score: null, breakdown: [], message: 'Complete the values survey to see alignment.' });
    }

    const votesResult = await db.query(`
      SELECT v.position, v.description, v.question,
             b.title, b.short_title, b.primary_subject, b.categories
      FROM votes v
      LEFT JOIN bills b ON v.bill_id = b.id
      WHERE v.politician_id = $1
      AND v.position NOT IN ('Not Voting', 'Present')
    `, [id]);

    const allVotes = votesResult.rows;
    const domains = getAllDomains();

    const domainVotes = {};
    for (const vote of allVotes) {
      const domain = classifyVote(vote);
      if (!domain) continue;
      if (!domainVotes[domain]) domainVotes[domain] = { yes: 0, no: 0, total: 0 };
      const pos = vote.position?.toLowerCase();
      if (pos === 'yes' || pos === 'yea') domainVotes[domain].yes++;
      else if (pos === 'no' || pos === 'nay') domainVotes[domain].no++;
      domainVotes[domain].total++;
    }

    const surveyResult = await db.query(
      'SELECT answers FROM user_surveys WHERE user_id = $1',
      [String(userId)]
    );
    const userAnswers = surveyResult.rows[0]?.answers || {};

    const ISSUE_TO_DOMAIN = {
      healthcare: 'healthcare', climate: 'climate', immigration: 'immigration',
      gun_policy: 'gun_policy', taxes: 'economy', defense: 'defense',
      reproductive_rights: 'reproductive_rights', education: 'education',
      safety_net: 'safety_net', criminal_justice: 'criminal_justice',
    };

    const PROGRESSIVE_IS_YES = {
      healthcare: true, climate: true, immigration: false, gun_policy: true,
      economy: true, defense: false, reproductive_rights: true, education: true,
      safety_net: true, criminal_justice: false, voting_rights: true, infrastructure: true,
    };

    const domainBreakdown = [];
    for (const [domainKey, domainConfig] of Object.entries(domains)) {
      const votes = domainVotes[domainKey];
      if (!votes || votes.total < 3) continue;
      const surveyIssue = Object.entries(ISSUE_TO_DOMAIN).find(([, d]) => d === domainKey)?.[0];
      const userValue = surveyIssue ? userAnswers[surveyIssue] : null;
      const progressiveIsYes = PROGRESSIVE_IS_YES[domainKey] ?? true;
      const politicianProgressiveVotes = progressiveIsYes ? votes.yes : votes.no;
      const politicianProgressivePct = Math.round((politicianProgressiveVotes / votes.total) * 100);
      let agreementPct = null;
      if (userValue !== null && userValue !== undefined) {
        const userProgressivePct = Math.round(((2 - userValue) / 4) * 100);
        agreementPct = 100 - Math.abs(userProgressivePct - politicianProgressivePct);
      }
      domainBreakdown.push({
        domain: domainKey, label: domainConfig.label, icon: domainConfig.icon,
        voteCount: votes.total, politicianProgressivePct, agreementPct,
        hasUserAnswer: userValue !== null && userValue !== undefined,
      });
    }

    domainBreakdown.sort((a, b) => b.voteCount - a.voteCount);

    res.json({
      score: overall.score,
      issuesAnalyzed: overall.issuesAnalyzed,
      breakdown: domainBreakdown,
      surveyBreakdown: overall.breakdown,
    });

  } catch (err) {
    console.error('Alignment breakdown error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/politicians/:id/votes
router.get('/:id/votes', async (req, res) => {
  const { id } = req.params;
  const page  = parseInt(req.query.page || 0);
  const limit = 25;
  const offset = page * limit;

  if (mockData.isMockMode()) {
    return res.json(mockData.getMockVotes(id, page));
  }

  try {
    const count = await db.query('SELECT COUNT(*) FROM votes WHERE politician_id = $1', [id]);
    if (parseInt(count.rows[0].count) === 0) {
      await sync.syncSingleMember(id);
    }

    const result = await db.query(`
      SELECT v.id, v.position, v.question, v.description, v.vote_date, v.congress,
             b.title, b.short_title, b.primary_subject, b.categories, b.number
      FROM votes v
      LEFT JOIN bills b ON v.bill_id = b.id
      WHERE v.politician_id = $1
      ORDER BY v.vote_date DESC NULLS LAST
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    const total = await db.query('SELECT COUNT(*) FROM votes WHERE politician_id = $1', [id]);

    res.json({
      votes: result.rows,
      total: parseInt(total.rows[0].count),
      page,
      pages: Math.ceil(parseInt(total.rows[0].count) / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/politicians/:id/analysis
router.get('/:id/analysis', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(`
      SELECT content, computed_at FROM ai_analysis
      WHERE politician_id = $1 AND analysis_type = 'full_profile'
    `, [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'No analysis yet.' });
    res.json({ analysis: result.rows[0].content, computedAt: result.rows[0].computed_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/politicians/:id — MUST come after all /:id/subroutes
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (mockData.isMockMode()) {
    const pol = mockData.MOCK_POLITICIANS[id];
    if (!pol) return res.status(404).json({ error: 'Politician not found.' });
    return res.json({ ...pol, bias_scores: [] });
  }

  try {
    const existing = await db.query('SELECT id FROM politicians WHERE id = $1', [id]);
    if (!existing.rows.length) {
      console.log(`[sync] ${id} not in DB — syncing now...`);
      await sync.syncSingleMember(id);
    }

    const result = await db.query(`
      SELECT p.*,
        COALESCE(
          json_agg(json_build_object(
            'category', bs.category, 'label', bs.label, 'score', bs.score,
            'direction', bs.direction, 'confidence', bs.confidence,
            'vote_count', bs.vote_count, 'summary', bs.summary
          ) ORDER BY bs.score DESC) FILTER (WHERE bs.category IS NOT NULL), '[]'
        ) as bias_scores
      FROM politicians p
      LEFT JOIN bias_scores bs ON bs.politician_id = p.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Politician not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/politicians/:id/analyze
router.post('/:id/analyze', async (req, res) => {
  const { id } = req.params;
  const forceRefresh = req.query.refresh === 'true';
  try {
    const voteCount = await db.query('SELECT COUNT(*) FROM votes WHERE politician_id = $1', [id]);
    if (parseInt(voteCount.rows[0].count) < 10) {
      await sync.syncVotesForPolitician(id);
    }
    const analysis = await biasEngine.analyzePolitician(id, forceRefresh);
    res.json({ success: true, analysis });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/politicians/:id/sync
router.post('/:id/sync', async (req, res) => {
  const { id } = req.params;
  try {
    await sync.syncSingleMember(id);
    // Always recalculate stats from votes currently in DB,
    // even if syncSingleMember skipped due to the 24 h cache.
    const stats = await sync.updatePoliticianStats(id);
    const voteCount = await db.query('SELECT COUNT(*) FROM votes WHERE politician_id = $1', [id]);
    res.json({ success: true, votes: parseInt(voteCount.rows[0].count), stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
