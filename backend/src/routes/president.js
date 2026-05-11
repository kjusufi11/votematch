// src/routes/president.js
const express   = require('express');
const router    = express.Router();
const axios     = require('axios');
const NodeCache = require('node-cache');
const Anthropic = require('@anthropic-ai/sdk');
const db        = require('../db');

const cache    = new NodeCache({ stdTTL: 3600 * 3 });
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const PRESIDENT = {
  name:        'Donald J. Trump',
  first_name:  'Donald',
  last_name:   'Trump',
  party:       'R',
  title:       'President of the United States',
  term_start:  '2025-01-20',
  term_number: 47,
  photo_url:   'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Donald_Trump_official_portrait_%282025%29.jpg/440px-Donald_Trump_official_portrait_%282025%29.jpg',
};

// ── Federal Register: executive orders ───────────────────────────────────────

async function fetchExecutiveOrders(perPage = 20) {
  const cacheKey = `eos_${perPage}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { data } = await axios.get(
    'https://www.federalregister.gov/api/v1/documents.json',
    {
      params: {
        'conditions[type]': 'PRESDOCU',
        'conditions[presidential_document_type]': 'executive_order',
        'conditions[publication_date][gte]': PRESIDENT.term_start,
        per_page: perPage,
        order: 'newest',
        'fields[]': [
          'title', 'document_number', 'publication_date',
          'abstract', 'html_url', 'executive_order_number', 'signing_date',
        ],
      },
      timeout: 10000,
    }
  );

  const result = {
    total: data.count || 0,
    orders: (data.results || []).map(eo => ({
      id:        eo.document_number,
      eo_number: eo.executive_order_number || null,
      title:     eo.title,
      date:      eo.signing_date || eo.publication_date,
      abstract:  eo.abstract || null,
      url:       eo.html_url,
    })),
  };

  cache.set(cacheKey, result, 3600 * 3);
  return result;
}

// ── Claude Haiku: plain-English EO summary (cached 24 h) ─────────────────────

async function getAISummary(eo) {
  const cacheKey = `eo_ai_${eo.id}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  if (!anthropic) {
    cache.set(cacheKey, null, 3600 * 24);
    return null;
  }

  const context = eo.abstract
    ? `\n\nFederal Register abstract: ${eo.abstract.slice(0, 400)}`
    : '';

  try {
    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{
        role:    'user',
        content: `Executive order title: "${eo.title}"${context}\n\nWrite one plain-English sentence (under 25 words) describing what this order does. Factual and neutral only — no opinion, no spin.`,
      }],
    });
    const summary = msg.content[0]?.text?.trim() || null;
    cache.set(cacheKey, summary, 3600 * 24);
    return summary;
  } catch {
    cache.set(cacheKey, null, 3600);
    return null;
  }
}

async function addSummaries(orders) {
  const CONCURRENCY = 5;
  const out = [...orders];
  for (let i = 0; i < out.length; i += CONCURRENCY) {
    const batch    = out.slice(i, i + CONCURRENCY);
    const summaries = await Promise.all(batch.map(eo => getAISummary(eo)));
    summaries.forEach((s, j) => { out[i + j] = { ...out[i + j], summary: s }; });
  }
  return out;
}

// ── Rep votes from DB ────────────────────────────────────────────────────────

async function getRepVotes(polIds) {
  if (!polIds.length) return [];

  const { rows } = await db.query(`
    SELECT v.id, v.politician_id, v.position, v.question, v.description,
           v.vote_date, v.congress,
           b.title, b.short_title, b.primary_subject,
           p.full_name, p.title AS pol_title, p.party, p.state, p.chamber
    FROM votes v
    LEFT JOIN bills b ON v.bill_id = b.id
    JOIN politicians p ON v.politician_id = p.id
    WHERE v.politician_id = ANY($1)
      AND v.congress = 119
      AND v.position IN ('Yes', 'No')
      AND v.question NOT ILIKE '%nomination%'
      AND v.question NOT ILIKE '%motion to proceed%'
    ORDER BY v.vote_date DESC NULLS LAST
    LIMIT 30
  `, [polIds]);

  return rows;
}

// ── Route ────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const polIds = req.query.polIds
    ? req.query.polIds.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  try {
    const [eoData, repVotes] = await Promise.all([
      fetchExecutiveOrders(20),
      getRepVotes(polIds),
    ]);

    const ordersWithSummaries = await addSummaries(eoData.orders);

    const daysInOffice = Math.floor(
      (Date.now() - new Date(PRESIDENT.term_start).getTime()) / 86400000
    );

    res.json({
      president:       { ...PRESIDENT, daysInOffice },
      stats:           { eoCount: eoData.total, daysInOffice },
      executiveOrders: ordersWithSummaries,
      repVotes,
    });
  } catch (err) {
    console.error('[president]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
