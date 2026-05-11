const router = require('express').Router();
const db = require('../db');
const { rebuildVotes, syncSingleSenatorVotes, progress } = require('../services/voteRebuild');
const { syncMembers } = require('../services/sync');

// POST /api/admin/rebuild-votes
router.post('/rebuild-votes', (req, res) => {
  if (progress.running) {
    return res.json({ started: false, message: 'Already running', progress });
  }
  rebuildVotes().catch(err => console.error('Rebuild failed:', err.message));
  res.json({ started: true, message: 'Vote rebuild started. Poll GET /api/admin/rebuild-status for progress.' });
});

// GET /api/admin/rebuild-status
router.get('/rebuild-status', (req, res) => {
  res.json(progress);
});

async function runMigrations() {
  const results = [];
  const migrations = require('../db/migrate').getMigrations();
  for (const sql of migrations) {
    try {
      await db.query(sql);
      results.push({ ok: true, sql: sql.slice(0, 60).replace(/\n/g, ' ').trim() });
    } catch (err) {
      results.push({ ok: false, sql: sql.slice(0, 60).replace(/\n/g, ' ').trim(), error: err.message });
    }
  }
  return results;
}

// GET /api/admin/run-migrate — same as POST, idempotent
router.get('/run-migrate', async (req, res) => {
  try {
    const results = await runMigrations();
    res.json({ done: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/run-migrate
router.post('/run-migrate', async (req, res) => {
  try {
    const results = await runMigrations();
    res.json({ done: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/fix-politician
// Corrects bad field values (chamber, state, title, last_name) on a politician record.
router.patch('/fix-politician', async (req, res) => {
  const { id, chamber, state, title, last_name } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });

  const allowed = { chamber, state, title, last_name };
  const sets = [];
  const vals = [id];
  for (const [col, val] of Object.entries(allowed)) {
    if (val !== undefined) {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

  await db.query(`UPDATE politicians SET ${sets.join(', ')} WHERE id = $1`, vals);
  const { rows } = await db.query('SELECT id, full_name, chamber, state, title, last_name FROM politicians WHERE id = $1', [id]);
  res.json({ ok: true, politician: rows[0] });
});

// POST /api/admin/sync-senator-votes/:id
// Re-syncs Senate clerk XML votes for a single senator.
// Use after fixing a politician's chamber/state with PATCH /fix-politician.
router.post('/sync-senator-votes/:id', async (req, res) => {
  const { id } = req.params;
  const { rows } = await db.query(
    'SELECT id, full_name, last_name, state FROM politicians WHERE id = $1', [id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Politician not found' });
  const pol = rows[0];

  if (!pol.last_name || !pol.state) {
    return res.status(400).json({ error: `Missing last_name or state for ${id}` });
  }

  syncSingleSenatorVotes(pol.id, pol.last_name, pol.state)
    .then(n => console.log(`[admin] Synced ${n} Senate votes for ${pol.id}`))
    .catch(e => console.error(`[admin] Sync failed for ${pol.id}:`, e.message));

  res.json({
    started: true,
    politician: pol,
    message: `Syncing Senate votes for ${pol.full_name} (${pol.last_name}, ${pol.state}). Poll /api/admin/rebuild-status for log.`,
  });
});

// POST /api/admin/sync-members
// Re-syncs all current members from Congress.gov (both chambers).
// Populates next_election from term end year. Safe to call repeatedly.
router.post('/sync-members', async (req, res) => {
  // Fire and forget — sync can take 30+ seconds
  syncMembers('both')
    .then(async total => {
      const { rows } = await db.query(`
        SELECT next_election, COUNT(*) as count
        FROM politicians
        WHERE in_office = true AND next_election IS NOT NULL
        GROUP BY next_election
        ORDER BY next_election
      `);
      console.log(`[admin] sync-members complete. ${total} members synced. Election years:`, rows);
    })
    .catch(err => console.error('[admin] sync-members failed:', err.message));

  res.json({ started: true, message: 'Member sync started in background. next_election will be populated from Congress.gov term data.' });
});

// GET /api/admin/debug-member?id=B001230
// Shows raw Congress.gov data for one member so we can verify term structure.
router.get('/debug-member', async (req, res) => {
  const congress = require('../services/congress');
  const id = req.query.id || 'C001098'; // Ted Cruz as default
  try {
    const member = await congress.getMember(id);
    res.json({ raw: member, normalized: congress.normalizeMember(member) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/debug-member-list
// Shows raw Congress.gov data for the first 2 senators from the bulk list.
router.get('/debug-member-list', async (req, res) => {
  const congress = require('../services/congress');
  try {
    const members = await congress.getMembers(congress.CURRENT_CONGRESS, 'senate');
    const sample = members.slice(0, 2);
    res.json({
      count: members.length,
      sample: sample.map(m => ({
        bioguideId: m.bioguideId,
        name: m.name || m.directOrderName,
        terms_raw: m.terms,
        normalized: congress.normalizeMember(m),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/populate-elections
// Iterates every politician in the DB, fetches their individual Congress.gov record,
// and updates next_election. Runs in background; poll /rebuild-status for progress.
router.post('/populate-elections', async (req, res) => {
  const congress = require('../services/congress');

  async function run() {
    const { rows } = await db.query('SELECT id, full_name, chamber FROM politicians WHERE in_office = true ORDER BY chamber, id');
    console.log(`[populate-elections] Starting for ${rows.length} politicians`);
    let updated = 0, errors = 0;

    for (const pol of rows) {
      try {
        const member = await congress.getMember(pol.id);
        if (!member) { errors++; continue; }
        const norm = congress.normalizeMember(member);
        if (norm.next_election) {
          await db.query('UPDATE politicians SET next_election = $1 WHERE id = $2', [norm.next_election, pol.id]);
          updated++;
        }
      } catch (err) {
        console.warn(`[populate-elections] ${pol.id} (${pol.full_name}): ${err.message}`);
        errors++;
      }
      // small delay to avoid hammering the API
      await new Promise(r => setTimeout(r, 150));
    }
    console.log(`[populate-elections] Done. updated=${updated} errors=${errors}`);
  }

  run().catch(err => console.error('[populate-elections] Fatal:', err.message));
  res.json({ started: true, total: 'check logs', message: 'populate-elections running in background' });
});

// GET /api/admin/bills-debug
router.get('/bills-debug', async (req, res) => {
  const [countResult, joinResult, sampleResult] = await Promise.all([
    db.query('SELECT COUNT(*) FROM bills'),
    db.query('SELECT COUNT(*) FROM votes WHERE bill_id IS NOT NULL'),
    db.query('SELECT id, number, title, primary_subject FROM bills LIMIT 5'),
  ]);
  res.json({
    total_bills: countResult.rows[0].count,
    votes_with_bill_id: joinResult.rows[0].count,
    sample_bills: sampleResult.rows,
  });
});

// GET /api/admin/election-summary
// Shows the current next_election breakdown in the DB.
router.get('/election-summary', async (req, res) => {
  const { rows } = await db.query(`
    SELECT next_election, chamber, COUNT(*) as count
    FROM politicians
    WHERE in_office = true
    GROUP BY next_election, chamber
    ORDER BY next_election NULLS LAST, chamber
  `);
  res.json(rows);
});

module.exports = router;
