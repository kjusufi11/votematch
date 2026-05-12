// src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const lookupRoutes        = require('./routes/lookup');
const politicianRoutes    = require('./routes/politicians');
const surveyRoutes        = require('./routes/survey');
const authRoutes          = require('./routes/auth');
const adminRoutes         = require('./routes/admin');
const upcomingRoutes      = require('./routes/upcoming');
const notificationsRoutes = require('./routes/notifications');
const presidentRoutes     = require('./routes/president');
const billsRoutes         = require('./routes/bills');

const app  = express();
const PORT = process.env.PORT || 3001;

// Trust Railway's proxy — required for rate limiting behind a load balancer
app.set('trust proxy', 1);

// CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  /\.railway\.app$/,
  /votematch\.app$/,
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const ok = allowedOrigins.some(o => typeof o === 'string' ? o === origin : o.test(origin));
    cb(ok ? null : new Error('CORS: origin not allowed'), ok);
  },
  credentials: true,
}));

app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again in 15 minutes.' },
});
app.use('/api/', limiter);

const analysisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Analysis rate limit reached. Please try again in an hour.' },
});
app.use('/api/politicians/:id/analyze', analysisLimiter);

// Routes
app.use('/api/lookup', lookupRoutes);
app.use('/api/politicians', politicianRoutes);
app.use('/api/survey', surveyRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upcoming', upcomingRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/president', presidentRoutes);
app.use('/api/bills', billsRoutes);

// Sitemap — crawled by Google; lists all politician profile pages
app.get('/sitemap.xml', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id FROM politicians ORDER BY last_name, first_name');
    const base = 'https://votematch.app';
    const staticUrls = ['/', '/president', '/upcoming', '/about', '/privacy', '/terms'].map(p =>
      `<url><loc>${base}${p}</loc><changefreq>weekly</changefreq></url>`
    );
    const polUrls = rows.map(r =>
      `<url><loc>${base}/politician/${r.id}</loc><changefreq>daily</changefreq></url>`
    );
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...polUrls].join('\n')}
</urlset>`;
    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(xml);
  } catch (err) {
    console.error('[sitemap]', err.message);
    res.status(500).send('<?xml version="1.0"?><urlset/>');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: require('./services/mockData').isMockMode() ? 'mock' : 'live',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

// Idempotent table creation
const db = require('./db');
db.query(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    keys JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(e => console.warn('[startup] push_subscriptions table:', e.message));

db.query(`
  CREATE TABLE IF NOT EXISTS extended_survey_responses (
    user_id TEXT PRIMARY KEY,
    demographics JSONB DEFAULT '{}',
    engagement JSONB DEFAULT '{}',
    deal_breakers JSONB DEFAULT '{}',
    policy_depth JSONB DEFAULT '{}',
    research_consent BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(e => console.warn('[startup] extended_survey_responses table:', e.message));

app.listen(PORT, () => {
  console.log(`\nVoteMatch API running on http://localhost:${PORT}`);
  const missing = ['CONGRESS_API_KEY', 'GOOGLE_CIVIC_API_KEY', 'ANTHROPIC_API_KEY']
    .filter(k => !process.env[k] || process.env[k].startsWith('your_'));
  if (missing.length) {
    console.warn('Mock mode — missing keys:', missing.join(', '));
  } else {
    console.log('Live mode — all API keys present');
  }
});

module.exports = app;
