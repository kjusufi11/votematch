// src/routes/president.js
const express   = require('express');
const router    = express.Router();
const axios     = require('axios');
const NodeCache = require('node-cache');
const Anthropic = require('@anthropic-ai/sdk');
const db        = require('../db');

const cache     = new NodeCache({ stdTTL: 3600 * 3 });
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const CONGRESS_KEY = process.env.CONGRESS_API_KEY;

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

// ── Domain classification ────────────────────────────────────────────────────
// Maps keyword patterns → policy domain keys (mirrors frontend domainClassifier)

const DOMAIN_KEYWORDS = {
  healthcare:          ['health', 'medicare', 'medicaid', 'drug price', 'vaccine', 'hospital', 'fda', 'opioid', 'public health'],
  climate:             ['climate', 'environment', 'epa', 'emission', 'fossil fuel', 'oil', 'natural gas', 'drilling', 'paris agreement', 'conservation', 'clean energy', 'renewable'],
  immigration:         ['immigr', 'border', 'asylum', 'visa', 'deportat', 'alien', 'citizenship', 'daca', 'refugee', 'customs and border', 'ice ', 'undocumented'],
  economy:             ['tax', 'trade', 'tariff', 'economic', 'fiscal', 'budget', 'inflation', 'financial regulation', 'banking', 'minimum wage', 'labor', 'sanction'],
  defense:             ['defense', 'military', 'nato', 'ukraine', 'israel', 'armed forces', 'veteran', 'national security', 'pentagon', 'nuclear', 'intelligence community', 'cia', 'nsa'],
  gun_policy:          ['gun', 'firearm', 'weapon', 'second amendment', 'ammunition'],
  reproductive_rights: ['abortion', 'reproductive', 'planned parenthood', 'contraception', 'fetal', 'family planning', 'title x'],
  education:           ['education', 'school', 'student loan', 'college', 'university', 'dei', 'diversity equity', 'department of education'],
  safety_net:          ['welfare', 'social security', 'housing', 'poverty', 'disability', 'snap', 'food stamp', 'medicaid'],
  criminal_justice:    ['criminal justice', 'police', 'crime', 'law enforcement', 'prison', 'sentencing', 'pardon', 'department of justice'],
  voting_rights:       ['election', 'voting', 'ballot', 'democracy', 'campaign finance', 'voter id', 'redistrict'],
  infrastructure:      ['infrastructure', 'highway', 'broadband', 'transit', 'transportation', 'rail', 'bridge', 'water system'],
};

// Agency name → domain hints
const AGENCY_DOMAINS = {
  'department of homeland security': ['immigration', 'defense'],
  'department of defense':           ['defense'],
  'department of health and human services': ['healthcare'],
  'department of education':         ['education'],
  'environmental protection agency': ['climate'],
  'department of energy':            ['climate'],
  'department of the treasury':      ['economy'],
  'department of justice':           ['criminal_justice'],
  'department of labor':             ['economy'],
  'department of housing and urban development': ['safety_net'],
  'department of transportation':    ['infrastructure'],
  'department of state':             ['defense'],
  'department of veterans affairs':  ['defense'],
};

function classifyDomains(eo) {
  const text = `${eo.title} ${eo.abstract || ''}`.toLowerCase();
  const found = new Set();

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some(k => text.includes(k))) found.add(domain);
  }

  for (const agency of (eo.agencies || [])) {
    const name = (agency.name || '').toLowerCase();
    for (const [agName, domains] of Object.entries(AGENCY_DOMAINS)) {
      if (name.includes(agName)) domains.forEach(d => found.add(d));
    }
  }

  return found.size > 0 ? [...found] : [];
}

// ── Federal Register ─────────────────────────────────────────────────────────

async function fetchExecutiveOrders(perPage = 250) {
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
          'title', 'document_number', 'publication_date', 'signing_date',
          'abstract', 'html_url', 'executive_order_number', 'agencies',
        ],
      },
      timeout: 10000,
    }
  );

  const result = {
    total: data.count || 0,
    orders: (data.results || []).map(eo => {
      const base = {
        id:        eo.document_number,
        eo_number: eo.executive_order_number || null,
        title:     eo.title,
        date:      eo.signing_date || eo.publication_date,
        abstract:  eo.abstract || null,
        url:       eo.html_url,
        agencies:  (eo.agencies || []).map(a => ({ name: a.name, slug: a.slug })),
      };
      return { ...base, domains: classifyDomains(base) };
    }),
  };

  cache.set(cacheKey, result, 3600 * 3);
  return result;
}

// Lightweight count-only fetch — avoids loading 250 EOs just to get the total
async function fetchEOCount() {
  const cacheKey = 'eo_count';
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  const { data } = await axios.get(
    'https://www.federalregister.gov/api/v1/documents.json',
    {
      params: {
        'conditions[type]': 'PRESDOCU',
        'conditions[presidential_document_type]': 'executive_order',
        'conditions[publication_date][gte]': PRESIDENT.term_start,
        per_page: 1,
        'fields[]': ['document_number'],
      },
      timeout: 8000,
    }
  );

  const count = data.count || 0;
  cache.set(cacheKey, count, 3600);
  return count;
}

// ── AI summary ───────────────────────────────────────────────────────────────

async function getAISummary(eo) {
  const cacheKey = `eo_ai_${eo.id}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;
  if (!anthropic) { cache.set(cacheKey, null, 3600 * 24); return null; }

  const context = eo.abstract ? `\n\nFederal Register abstract: ${eo.abstract.slice(0, 400)}` : '';
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 80,
      messages: [{
        role: 'user',
        content: `Executive order title: "${eo.title}"${context}\n\nWrite one plain-English sentence (under 25 words) describing what this order does. Factual and neutral only.`,
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
    const batch     = out.slice(i, i + CONCURRENCY);
    const summaries = await Promise.all(batch.map(eo => getAISummary(eo)));
    summaries.forEach((s, j) => { out[i + j] = { ...out[i + j], summary: s }; });
  }
  return out;
}

// ── Congress.gov: enacted laws ───────────────────────────────────────────────

async function fetchEnactedBills() {
  const cacheKey = 'enacted_119';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.get('https://api.congress.gov/v3/law/119', {
      params: { api_key: CONGRESS_KEY, format: 'json', limit: 20, sort: 'updateDate+desc' },
      timeout: 10000,
    });

    const bills = (data.bills || []).map(b => ({
      id:         `${b.type}${b.number}-119`,
      title:      b.title,
      number:     `${b.type}. ${b.number}`,
      date:       b.latestAction?.actionDate || b.updateDate,
      action:     b.latestAction?.text || '',
      public_law: (b.laws || []).find(l => l.type === 'Public Law')?.number || null,
      url: `https://www.congress.gov/bill/119th-congress/${
        b.type === 'HR' ? 'house-bill' :
        b.type === 'S'  ? 'senate-bill' :
        b.type === 'HJRES' ? 'house-joint-resolution' :
        b.type === 'SJRES' ? 'senate-joint-resolution' :
        'bill'
      }/${b.number}`,
    }));

    cache.set(cacheKey, bills, 3600 * 6);
    return bills;
  } catch (err) {
    console.warn('[president] enacted bills error:', err.message);
    return [];
  }
}

// ── Congress.gov: vetoed bills ───────────────────────────────────────────────

async function fetchVetoedBills() {
  const cacheKey = 'vetoed_119';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    // Use bill search and filter latest action text for vetoes
    const { data } = await axios.get('https://api.congress.gov/v3/bill/119', {
      params: {
        api_key: CONGRESS_KEY, format: 'json', limit: 100,
        sort: 'latestAction.actionDate+desc',
        'fromDateTime': '2025-01-20T00:00:00Z',
      },
      timeout: 10000,
    });

    const vetoed = (data.bills || [])
      .filter(b => /vetoed/i.test(b.latestAction?.text || ''))
      .map(b => ({
        id:     `${b.type}${b.number}-119`,
        title:  b.title,
        number: `${b.type}. ${b.number}`,
        date:   b.latestAction?.actionDate,
        reason: b.latestAction?.text || '',
      }));

    cache.set(cacheKey, vetoed, 3600 * 6);
    return vetoed;
  } catch (err) {
    console.warn('[president] vetoed bills error:', err.message);
    return [];
  }
}

// ── Congress.gov: nominations ────────────────────────────────────────────────

function parseNomination(n) {
  const desc = n.description || '';
  // "First Last, of State, to be Title" or "First Last, to be Title"
  const match = desc.match(/^(.+?),(?:\s+of\s+[\w\s]+,)?\s+to be (.+)$/i);
  return {
    id:           n.nominationNumber || n.citation,
    name:         match ? match[1].trim() : desc.split(',')[0].trim(),
    position:     match ? match[2].trim() : '',
    organization: n.organization || '',
    description:  desc,
    date:         n.latestAction?.actionDate || n.receivedDate,
    action:       n.latestAction?.text || '',
    confirmed:    /confirmed/i.test(n.latestAction?.text || ''),
    withdrawn:    /withdrawn|returned/i.test(n.latestAction?.text || ''),
  };
}

async function fetchNominations() {
  const cacheKey = 'nominations_119';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.get('https://api.congress.gov/v3/nomination/119', {
      params: { api_key: CONGRESS_KEY, format: 'json', limit: 50 },
      timeout: 10000,
    });

    const nominations = (data.nominations || [])
      .filter(n => !n.isMilitary)          // skip bulk military promotions
      .map(parseNomination)
      .filter(n => n.name?.trim())         // skip entries with no parseable name
      .filter(n => n.confirmed || n.withdrawn); // only settled nominations

    cache.set(cacheKey, nominations, 3600 * 6);
    return nominations;
  } catch (err) {
    console.warn('[president] nominations error:', err.message);
    return [];
  }
}

// ── Rep votes ────────────────────────────────────────────────────────────────

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

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/president/eos — full EO list with AI summaries, loaded lazily by frontend
router.get('/eos', async (req, res) => {
  try {
    const eoData = await fetchExecutiveOrders();
    const ordersWithSummaries = await addSummaries(eoData.orders);
    res.json({ total: eoData.total, orders: ordersWithSummaries });
  } catch (err) {
    console.error('[president/eos]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/president — fast: stats + bills + nominations + rep votes (no EO list)
router.get('/', async (req, res) => {
  const polIds = req.query.polIds
    ? req.query.polIds.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  try {
    const [eoCount, enactedBills, vetoedBills, nominations, repVotes] = await Promise.all([
      fetchEOCount(),
      fetchEnactedBills(),
      fetchVetoedBills(),
      fetchNominations(),
      getRepVotes(polIds),
    ]);

    const daysInOffice = Math.floor(
      (Date.now() - new Date(PRESIDENT.term_start).getTime()) / 86400000
    );

    res.json({
      president:       { ...PRESIDENT, daysInOffice },
      stats:           { eoCount, enactedCount: enactedBills.length, daysInOffice },
      executiveOrders: [],   // loaded separately via GET /eos
      enactedBills,
      vetoedBills,
      nominations,
      repVotes,
    });
  } catch (err) {
    console.error('[president]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
