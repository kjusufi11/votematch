// src/db/index.js
const { Pool } = require('pg');

// Only use mock/noop if explicitly set OR no database URL at all
const isMock = process.env.MOCK_MODE === 'true' ||
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL === 'postgresql://localhost:5432/votemap';

let pool = null;

if (!isMock) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  pool.on('error', (err) => {
    console.error('DB pool error:', err.message);
  });
  console.log('DB: Connected to PostgreSQL');
} else {
  console.log('DB: Mock mode — no database connection');
}

const noopQuery = async () => ({ rows: [], rowCount: 0 });

module.exports = {
  query: isMock ? noopQuery : (text, params) => pool.query(text, params),
  getClient: isMock ? async () => ({ query: noopQuery, release: () => {} }) : () => pool.connect(),
  pool,
  isMock,
};
