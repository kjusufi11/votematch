// backend/src/cron.js
// Nightly data sync — pulls fresh votes from ProPublica for all tracked politicians
// Deployed as a separate Railway cron service (runs on a schedule, not a web server)
// Schedule: every night at 2:00 AM UTC

require('dotenv').config();
const sync   = require('./services/sync');
const db     = require('./db');
const mockData = require('./services/mockData');

async function run() {
  const startTime = Date.now();
  console.log(`\n[CRON] Starting nightly sync — ${new Date().toISOString()}`);

  if (mockData.isMockMode()) {
    console.log('[CRON] Mock mode active — skipping real sync. Set API keys to enable.');
    process.exit(0);
  }

  try {
    // 1. Sync all current members of Congress (updates names, party, stats)
    console.log('\n[CRON] Syncing member roster...');
    const memberCount = await sync.syncMembers('both');
    console.log(`[CRON] ✓ Synced ${memberCount} members`);

    // 2. Pull fresh votes for every politician in our DB
    // Prioritize those who haven't been synced recently
    console.log('\n[CRON] Syncing votes for all tracked politicians...');
    const result = await db.query(`
      SELECT id, full_name, chamber
      FROM politicians
      WHERE in_office = true
      ORDER BY last_synced ASC NULLS FIRST
      LIMIT 100
    `);

    let votesTotal = 0;
    let errors = 0;

    for (const pol of result.rows) {
      try {
        const count = await sync.syncVotesForPolitician(pol.id, 2); // offset 2 = skip most-recent, pick up slightly older
        votesTotal += count;
        process.stdout.write('.');
      } catch (err) {
        errors++;
        process.stdout.write('x');
      }
      // Respect ProPublica rate limit (1 req/sec)
      await sleep(1100);
    }

    console.log(`\n[CRON] ✓ Synced ~${votesTotal} votes (${errors} errors)`);

    // 3. Invalidate stale AI analysis so it gets regenerated on next view
    // (only invalidate if new votes were found)
    if (votesTotal > 0) {
      await db.query(`
        DELETE FROM ai_analysis
        WHERE computed_at < NOW() - INTERVAL '48 hours'
      `);
      console.log('[CRON] ✓ Cleared stale AI analysis cache');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n[CRON] ✅ Nightly sync complete in ${elapsed}s\n`);
    process.exit(0);

  } catch (err) {
    console.error('\n[CRON] ❌ Fatal sync error:', err.message);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

run();
