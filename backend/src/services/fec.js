// src/services/fec.js
// FEC (Federal Election Commission) API client
// Docs: https://api.fec.gov/v1/
// Register a free key at https://api.data.gov/signup/ for 1000 req/hr.
// DEMO_KEY works without registration (60 req/hr per IP).

const axios = require('axios');
const NodeCache = require('node-cache');

const BASE = 'https://api.fec.gov/v1';
const cache = new NodeCache({ stdTTL: 3600 });

const client = axios.create({
  baseURL: BASE,
  params: { api_key: process.env.FEC_API_KEY || 'DEMO_KEY' },
  timeout: 12000,
});

async function get(path, params = {}) {
  const key = path + JSON.stringify(params);
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const { data } = await client.get(path, { params });
    cache.set(key, data);
    return data;
  } catch (err) {
    const msg = err.response?.data?.['developer message'] || err.message;
    throw new Error(`FEC API [${path}]: ${msg}`);
  }
}

// Returns FEC candidate_id (e.g. "S4VT00081") or null
async function findCandidateId(fullName, state, chamber) {
  const office = chamber === 'senate' ? 'S' : 'H';
  try {
    const data = await get('/candidates/search/', {
      q: fullName, state: state.toUpperCase(), office,
      has_raised_funds: true, sort: '-receipts', per_page: 5,
    });
    return data.results?.[0]?.candidate_id || null;
  } catch (err) {
    console.warn(`FEC candidate lookup failed for ${fullName} (${state}):`, err.message);
    return null;
  }
}

// Returns principal campaign committee_id or null
async function getCommitteeId(candidateId) {
  try {
    const data = await get(`/candidate/${candidateId}/committees/`, {
      designation: 'P', per_page: 5,
    });
    return data.results?.[0]?.committee_id || null;
  } catch (err) {
    console.warn(`FEC committee lookup failed for ${candidateId}:`, err.message);
    return null;
  }
}

// Returns [{employer, total}] sorted desc, aggregated across 2022 and 2024 cycles
async function getTopEmployers(committeeId) {
  const byEmployer = {};
  for (const cycle of [2024, 2022]) {
    try {
      const data = await get('/schedules/schedule_a/by_employer/', {
        committee_id: committeeId,
        two_year_transaction_period: cycle,
        sort: '-total', per_page: 25,
      });
      for (const r of (data.results || [])) {
        const emp = r.employer?.trim().toUpperCase();
        if (!emp) continue;
        byEmployer[emp] = (byEmployer[emp] || 0) + (r.total || 0);
      }
    } catch (err) {
      console.warn(`FEC employer data failed for ${committeeId} cycle ${cycle}:`, err.message);
    }
  }
  return Object.entries(byEmployer)
    .map(([employer, total]) => ({ employer, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 30);
}

module.exports = { findCandidateId, getCommitteeId, getTopEmployers };
