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

module.exports = router;
