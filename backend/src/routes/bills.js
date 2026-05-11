// src/routes/bills.js
const express    = require('express');
const router     = express.Router();
const axios      = require('axios');
const NodeCache  = require('node-cache');
const crypto     = require('crypto');
const db         = require('../db');

const cache = new NodeCache({ stdTTL: 3600 * 6 });
const JWT_SECRET = process.env.JWT_SECRET || 'votematch-dev-secret';

const cgov = axios.create({
  baseURL: 'https://api.congress.gov/v3',
  params:  { api_key: process.env.CONGRESS_API_KEY, format: 'json' },
  timeout: 10000,
});

function getUser(req) {
  try {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return null;
    const [h, b, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function stripHtml(text) {
  if (!text) return null;
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function deriveStatusLabel(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes('signed by the president') || t.includes('became public law')) return 'Signed';
  if (t.includes('vetoed')) return 'Vetoed';
  if (t.includes('passed house')) return 'Passed House';
  if (t.includes('passed senate')) return 'Passed Senate';
  if (t.includes('reported by') || t.includes('ordered to be reported')) return 'Out of Committee';
  if (t.includes('referred to the committee') || t.includes('referred to the subcommittee')) return 'In Committee';
  if (t.includes('introduced in')) return 'Introduced';
  return null;
}

// ── GET /api/bills/details?congress=119&type=hr&number=1234&polIds=A000,B001 ──

router.get('/details', async (req, res) => {
  const { congress, type, number, polIds } = req.query;
  if (!congress || !type || !number) {
    return res.status(400).json({ error: 'Missing congress/type/number' });
  }

  const cacheKey = `bdet_${congress}_${type}_${number}`;
  let details = cache.get(cacheKey);

  if (!details) {
    const [billRes, cosRes, sumRes, comRes] = await Promise.allSettled([
      cgov.get(`/bill/${congress}/${type}/${number}`),
      cgov.get(`/bill/${congress}/${type}/${number}/cosponsors`, { params: { limit: 100 } }),
      cgov.get(`/bill/${congress}/${type}/${number}/summaries`),
      cgov.get(`/bill/${congress}/${type}/${number}/committees`),
    ]);

    const bill        = billRes.status === 'fulfilled' ? billRes.value.data.bill       : null;
    const cosponsors  = cosRes.status  === 'fulfilled' ? (cosRes.value.data.cosponsors  || []) : [];
    const summaries   = sumRes.status  === 'fulfilled' ? (sumRes.value.data.summaries   || []) : [];
    const committees  = comRes.status  === 'fulfilled' ? (comRes.value.data.committees  || []) : [];

    const summaryText = summaries
      .sort((a, b) => new Date(b.updateDate || 0) - new Date(a.updateDate || 0))
      .map(s => stripHtml(s.text))
      .find(Boolean) || null;

    const primaryCommittee = committees[0]?.name || null;

    details = {
      summary:          summaryText,
      latestAction:     bill?.latestAction  || null,
      statusLabel:      deriveStatusLabel(bill?.latestAction?.text),
      policyArea:       bill?.policyArea?.name || null,
      primaryCommittee,
      sponsor: bill?.sponsors?.[0] ? {
        bioguideId: bill.sponsors[0].bioguideId,
        fullName:   bill.sponsors[0].fullName,
        party:      bill.sponsors[0].party,
        state:      bill.sponsors[0].state,
      } : null,
      allCosponsors: cosponsors.map(c => ({
        bioguideId: c.bioguideId,
        fullName:   c.fullName,
        party:      c.party,
        state:      c.state,
      })),
    };
    cache.set(cacheKey, details);
  }

  // Filter cosponsors to user's reps — done after cache so polIds don't pollute it
  const polIdSet      = new Set((polIds || '').split(',').filter(Boolean));
  const repCosponsors = polIdSet.size > 0
    ? details.allCosponsors.filter(c => polIdSet.has(c.bioguideId))
    : [];

  res.json({ ...details, repCosponsors });
});

// ── GET /api/bills/tracked  (auth) ───────────────────────────────────────────

router.get('/tracked', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { rows } = await db.query(
      'SELECT congress, bill_type, bill_number, title FROM tracked_bills WHERE user_id = $1 ORDER BY tracked_at DESC',
      [String(user.id)]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/bills/track  { congress, type, number, title }  (auth) ─────────

router.post('/track', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { congress, type, number, title } = req.body;
  if (!congress || !type || !number) return res.status(400).json({ error: 'Missing fields' });
  try {
    await db.query(
      `INSERT INTO tracked_bills (user_id, congress, bill_type, bill_number, title)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, congress, bill_type, bill_number) DO NOTHING`,
      [String(user.id), parseInt(congress), type, String(number), title || null]
    );
    res.json({ tracked: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/bills/track  { congress, type, number }  (auth) ──────────────

router.delete('/track', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const { congress, type, number } = req.body;
  if (!congress || !type || !number) return res.status(400).json({ error: 'Missing fields' });
  try {
    await db.query(
      'DELETE FROM tracked_bills WHERE user_id = $1 AND congress = $2 AND bill_type = $3 AND bill_number = $4',
      [String(user.id), parseInt(congress), type, String(number)]
    );
    res.json({ tracked: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
