// src/routes/auth.js
// Uses Node.js built-in crypto — no external dependencies needed
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const db      = require('../db');

async function createDefaultNotificationPrefs(userId) {
  const token = crypto.randomBytes(20).toString('hex');
  await db.query(`
    INSERT INTO user_notification_prefs (user_id, vote_alerts, unsubscribe_token)
    VALUES ($1, true, $2) ON CONFLICT DO NOTHING
  `, [String(userId), token]).catch(() => {});
}

const JWT_SECRET = process.env.JWT_SECRET || 'votematch-dev-secret';

// Simple JWT implementation using built-in crypto
function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now()/1000) + 60*60*24*30 })).toString('base64url');
  const sig    = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now()/1000)) return null;
    return payload;
  } catch { return null; }
}

// Hash password using built-in crypto (PBKDF2)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const attempt = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return attempt === hash;
}

// Verify Bearer token from Authorization header; returns payload or responds 401
function requireAuth(req, res) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  const payload = verifyToken(auth.slice(7));
  if (!payload) { res.status(401).json({ error: 'Invalid or expired token' }); return null; }
  return payload;
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) return res.status(409).json({ error: 'An account with this email already exists.' });

    const hash = hashPassword(password);
    const result = await db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, zip_code',
      [email.toLowerCase(), hash]
    );
    const user = result.rows[0];
    await createDefaultNotificationPrefs(user.id);
    const token = createToken({ userId: user.id, email: user.email });
    res.json({ token, user: { id: String(user.id), email: user.email, zip_code: user.zip_code || null } });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

// POST /api/auth/signin
router.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

  try {
    const result = await db.query(
      'SELECT id, email, password_hash, zip_code FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid email or password.' });

    const user = result.rows[0];
    if (!verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = createToken({ userId: user.id, email: user.email });
    res.json({ token, user: { id: String(user.id), email: user.email, zip_code: user.zip_code || null } });
  } catch (err) {
    console.error('Signin error:', err.message);
    res.status(500).json({ error: 'Sign in failed. Please try again.' });
  }
});

// GET /api/auth/me — returns full user profile including saved ZIP
router.get('/me', async (req, res) => {
  const payload = requireAuth(req, res);
  if (!payload) return;
  try {
    const result = await db.query('SELECT id, email, zip_code FROM users WHERE id = $1', [payload.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({ id: String(u.id), email: u.email, zip_code: u.zip_code || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/zip — save or update the user's home ZIP
router.put('/zip', async (req, res) => {
  const payload = requireAuth(req, res);
  if (!payload) return;
  const { zip } = req.body;
  if (!zip || !/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'Invalid ZIP code' });
  try {
    await db.query('UPDATE users SET zip_code = $1 WHERE id = $2', [zip, payload.userId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
