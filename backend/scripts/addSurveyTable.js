require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_surveys (
      user_id     TEXT PRIMARY KEY,
      answers     JSONB NOT NULL DEFAULT '{}',
      importance  JSONB NOT NULL DEFAULT '{}',
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('✅ user_surveys table created');
  await pool.end();
}
run().catch(e => { console.error(e); process.exit(1); });
