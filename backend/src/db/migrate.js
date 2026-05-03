// src/db/migrate.js
// Run with: npm run db:migrate
// Creates all VoteMatch tables from scratch

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrations = [
  // ── Politicians ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS politicians (
    id                TEXT PRIMARY KEY,          -- bioguide ID (e.g. "S000033")
    full_name         TEXT NOT NULL,
    first_name        TEXT,
    last_name         TEXT,
    party             TEXT,                       -- "D", "R", "ID"
    state             TEXT,                       -- 2-letter state code
    chamber           TEXT,                       -- "senate" or "house"
    district          INTEGER,                    -- NULL for senators
    title             TEXT,                       -- "Sen." or "Rep."
    in_office         BOOLEAN DEFAULT true,
    dw_nominate       NUMERIC,                    -- ideology score (-1 liberal to +1 conservative)
    next_election     TEXT,
    twitter_handle    TEXT,
    url               TEXT,
    photo_url         TEXT,
    total_votes        INTEGER DEFAULT 0,
    missed_votes_pct   NUMERIC DEFAULT 0,
    party_loyalty_pct  NUMERIC DEFAULT 0,
    last_synced       TIMESTAMPTZ DEFAULT NOW(),
    created_at        TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Committees ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS committees (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    chamber     TEXT,
    url         TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS politician_committees (
    politician_id TEXT REFERENCES politicians(id) ON DELETE CASCADE,
    committee_id  TEXT REFERENCES committees(id) ON DELETE CASCADE,
    rank          TEXT,
    PRIMARY KEY (politician_id, committee_id)
  )`,

  // ── Bills ────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS bills (
    id              TEXT PRIMARY KEY,             -- e.g. "hr1234-118"
    bill_id         TEXT,                         -- ProPublica bill_id
    number          TEXT,
    title           TEXT NOT NULL,
    short_title     TEXT,
    summary         TEXT,
    congress        INTEGER,
    chamber         TEXT,
    primary_subject TEXT,                         -- ProPublica subject tag
    categories      TEXT[],                       -- our enriched category tags
    introduced_date DATE,
    last_vote_date  DATE,
    status          TEXT,
    sponsor_id      TEXT REFERENCES politicians(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Votes ─────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS votes (
    id              SERIAL PRIMARY KEY,
    politician_id   TEXT NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
    bill_id         TEXT REFERENCES bills(id),
    vote_id         TEXT,                          -- ProPublica roll call ID
    position        TEXT NOT NULL,                 -- "Yes", "No", "Not Voting", "Present"
    question        TEXT,
    description     TEXT,
    vote_date       DATE,
    session         TEXT,
    congress        INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(politician_id, vote_id)
  )`,

  `CREATE INDEX IF NOT EXISTS votes_politician_idx ON votes(politician_id)`,
  `CREATE INDEX IF NOT EXISTS votes_bill_idx ON votes(bill_id)`,
  `CREATE INDEX IF NOT EXISTS votes_date_idx ON votes(vote_date DESC)`,

  // ── Bias Scores ───────────────────────────────────────────────────────────
  // Computed by the AI bias engine, cached here to avoid re-computing every request
  `CREATE TABLE IF NOT EXISTS bias_scores (
    id              SERIAL PRIMARY KEY,
    politician_id   TEXT NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
    category        TEXT NOT NULL,                 -- e.g. "reproductive_rights"
    label           TEXT NOT NULL,                 -- e.g. "Anti-abortion rights"
    score           NUMERIC NOT NULL,              -- 0.0 to 1.0
    direction       TEXT NOT NULL,                 -- "for" or "against"
    vote_count      INTEGER,                       -- how many votes informed this
    confidence      TEXT,                          -- "high", "medium", "low"
    summary         TEXT,                          -- AI-generated 1-sentence explanation
    computed_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(politician_id, category)
  )`,

  // ── AI Analysis Cache ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ai_analysis (
    id              SERIAL PRIMARY KEY,
    politician_id   TEXT NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
    analysis_type   TEXT NOT NULL,                 -- "full_profile", "bias_tags", "summary"
    content         JSONB NOT NULL,
    model_version   TEXT,
    computed_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(politician_id, analysis_type)
  )`,

  // ── ZIP to District cache ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS zip_lookups (
    zip             TEXT PRIMARY KEY,
    state           TEXT,
    districts       JSONB,                          -- array of {level, office, politician_id}
    raw_response    JSONB,
    looked_up_at    TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── FEC Conflict Cache ────────────────────────────────────────────────────
  // Cross-reference of FEC donor data vs voting record, cached 7 days
  `CREATE TABLE IF NOT EXISTS fec_conflicts (
    politician_id    TEXT PRIMARY KEY REFERENCES politicians(id) ON DELETE CASCADE,
    fec_candidate_id TEXT,
    top_donors       JSONB DEFAULT '[]',
    conflicts        JSONB DEFAULT '[]',
    computed_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── Schema patches ────────────────────────────────────────────────────────
  // Add flag column to bias_scores (for corruption/foreign influence tagging)
  `ALTER TABLE bias_scores ADD COLUMN IF NOT EXISTS flag TEXT`,
];

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🗄️  Running migrations...');
    for (const sql of migrations) {
      await client.query(sql);
      const name = sql.slice(0, 60).replace(/\n/g, ' ').trim();
      console.log(`  ✓ ${name}...`);
    }
    console.log('\n✅ All migrations complete.\n');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
