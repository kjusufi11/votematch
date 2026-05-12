// src/routes/survey.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/survey/:userId
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      'SELECT answers, importance, updated_at FROM user_surveys WHERE user_id = $1',
      [userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'No survey found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/survey/:userId
router.post('/:userId', async (req, res) => {
  const { userId } = req.params;
  const { answers, importance } = req.body;

  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Invalid survey data.' });
  }

  try {
    await db.query(`
      INSERT INTO user_surveys (user_id, answers, importance, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        answers = $2, importance = $3, updated_at = NOW()
    `, [userId, JSON.stringify(answers), JSON.stringify(importance || {})]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/survey/:userId/alignment?politicians=id1,id2,id3
router.get('/:userId/alignment', async (req, res) => {
  const { userId } = req.params;
  const { politicians } = req.query;

  if (!politicians) return res.status(400).json({ error: 'Pass ?politicians=id1,id2,id3' });

  try {
    const { calculateAlignmentForReps } = require('../services/alignmentEngine');
    const polIds = politicians.split(',').filter(Boolean);
    const results = await calculateAlignmentForReps(userId, polIds);
    res.json(results);
  } catch (err) {
    console.error('Alignment error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/survey/extended/:userId
router.get('/extended/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      'SELECT demographics, engagement, deal_breakers, policy_depth, research_consent, completed_at FROM extended_survey_responses WHERE user_id = $1',
      [userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'No extended survey found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/survey/extended/:userId
router.post('/extended/:userId', async (req, res) => {
  const { userId } = req.params;
  const { demographics, engagement, deal_breakers, policy_depth, research_consent, completed } = req.body;
  try {
    await db.query(`
      INSERT INTO extended_survey_responses
        (user_id, demographics, engagement, deal_breakers, policy_depth, research_consent, completed_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        demographics = $2, engagement = $3, deal_breakers = $4, policy_depth = $5,
        research_consent = $6, completed_at = $7, updated_at = NOW()
    `, [
      userId,
      JSON.stringify(demographics || {}),
      JSON.stringify(engagement || {}),
      JSON.stringify(deal_breakers || {}),
      JSON.stringify(policy_depth || {}),
      research_consent ?? false,
      completed ? new Date() : null,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
