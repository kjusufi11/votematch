// src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const lookupRoutes    = require('./routes/lookup');
const politicianRoutes = require('./routes/politicians');
const surveyRoutes    = require('./routes/survey');
const authRoutes      = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 3001;

// Trust Railway's proxy — required for rate limiting behind a load balancer
app.set('trust proxy', 1);

// CORS
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL, /\.railway\.app$/].filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:5173'];

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

app.listen(PORT, () => {
  console.log(`\nVoteMap API running on http://localhost:${PORT}`);
  const missing = ['CONGRESS_API_KEY', 'GOOGLE_CIVIC_API_KEY', 'ANTHROPIC_API_KEY']
    .filter(k => !process.env[k] || process.env[k].startsWith('your_'));
  if (missing.length) {
    console.warn('Mock mode — missing keys:', missing.join(', '));
  } else {
    console.log('Live mode — all API keys present');
  }
});

module.exports = app;
