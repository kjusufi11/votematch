const router = require('express').Router();
const { rebuildVotes, progress } = require('../services/voteRebuild');

// POST /api/admin/rebuild-votes
// Starts the full vote rebuild as a background job. Safe to call repeatedly
// (will reject if already running). Returns immediately; poll /rebuild-status.
router.post('/rebuild-votes', (req, res) => {
  if (progress.running) {
    return res.json({ started: false, message: 'Already running', progress });
  }
  rebuildVotes().catch(err => console.error('Rebuild failed:', err.message));
  res.json({
    started: true,
    message: 'Vote rebuild started. Poll GET /api/admin/rebuild-status for progress.',
  });
});

// GET /api/admin/rebuild-status
router.get('/rebuild-status', (req, res) => {
  res.json(progress);
});

module.exports = router;
