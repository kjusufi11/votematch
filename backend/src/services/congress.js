// src/services/congress.js
// Congress.gov API v3 — official Library of Congress data source
// Docs: https://api.congress.gov/

const axios = require('axios');
const NodeCache = require('node-cache');

const BASE = 'https://api.congress.gov/v3';
const cache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL_VOTES || 3600) });

const client = axios.create({
  baseURL: BASE,
  params: { api_key: process.env.CONGRESS_API_KEY, format: 'json' },
  timeout: 15000,
});

async function get(path, params = {}, ttl = null) {
  const key = path + JSON.stringify(params);
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const { data } = await client.get(path, { params });
    cache.set(key, data, ttl || cache.options.stdTTL);
    return data;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    throw new Error(`Congress API error [${path}]: ${msg}`);
  }
}

const CURRENT_CONGRESS = 119;

// ── Members ──────────────────────────────────────────────────────────────────

async function getMembers(congress, chamber) {
  const ttl = parseInt(process.env.CACHE_TTL_MEMBERS || 86400);
  const data = await get(`/member/congress/${congress}/${chamber}`, { limit: 250 }, ttl);
  return data.members || [];
}

async function getMember(bioguideId) {
  const ttl = parseInt(process.env.CACHE_TTL_MEMBERS || 86400);
  const data = await get(`/member/${bioguideId}`, {}, ttl);
  return data.member || null;
}

// Get members by state
async function getMembersByState(state, chamber) {
  const ttl = parseInt(process.env.CACHE_TTL_MEMBERS || 86400);
  const data = await get(`/member/${state}/${chamber}`, { limit: 10, currentMember: true }, ttl);
  return data.members || [];
}

// ── Votes ─────────────────────────────────────────────────────────────────────

// Get votes for a specific member
async function getMemberVotes(bioguideId, offset = 0) {
  const data = await get(`/member/${bioguideId}/votes`, { limit: 250, offset });
  return data.votes || [];
}

// Get recent votes for a chamber
async function getRecentVotes(congress, chamber, session = 1) {
  const data = await get(`/vote/${congress}/${chamber}/${session}`, { limit: 50 });
  return data.votes || [];
}

// Get specific vote detail
async function getVoteDetail(congress, chamber, session, rollCall) {
  const data = await get(`/vote/${congress}/${chamber}/${session}/${rollCall}`);
  return data.vote || null;
}

// ── Bills ─────────────────────────────────────────────────────────────────────

async function getMemberSponsoredBills(bioguideId) {
  const data = await get(`/member/${bioguideId}/sponsored-legislation`, { limit: 50 });
  return data.sponsoredLegislation || [];
}

async function getBill(congress, billType, billNumber) {
  const data = await get(`/bill/${congress}/${billType}/${billNumber}`);
  return data.bill || null;
}

// ── Normalize ─────────────────────────────────────────────────────────────────

function normalizeMember(m) {
  // Congress.gov member structure
  const currentTerm = m.terms?.item?.[m.terms.item.length - 1] || {};
  const chamber = currentTerm.chamber?.toLowerCase().includes('senate') ? 'senate' : 'house';

  return {
    id: m.bioguideId,
    full_name: m.directOrderName || `${m.firstName} ${m.lastName}`,
    first_name: m.firstName,
    last_name: m.lastName,
    party: normalizeParty(m.partyHistory?.[0]?.partyAbbreviation || m.party),
    state: currentTerm.stateCode || m.state,
    chamber,
    district: currentTerm.district || null,
    title: chamber === 'senate' ? 'Sen.' : 'Rep.',
    in_office: m.currentMember !== false,
    url: m.officialWebsiteUrl || null,
    total_votes: 0,
    missed_votes_pct: 0,
    party_loyalty_pct: 0,
  };
}

function normalizeVote(v, politicianId) {
  // Congress.gov vote structure from member votes endpoint.
  // vote_id uses shared roll-call identity (chamber-congress-session-rollNumber)
  // WITHOUT the politician's bioguide ID so the same roll call gets the same
  // vote_id across politicians — required for party-loyalty comparison.
  const chamber = (v.chamber || '').toLowerCase().includes('senate') ? 'senate' : 'house';
  const voteId  = `${chamber}-${v.congress}-${v.sessionNumber}-${v.rollNumber}`;
  return {
    politician_id: politicianId,
    vote_id:  voteId,
    position: normalizePosition(v.memberVotes?.memberVote?.[0]?.votePosition || v.votePosition),
    question: v.question || v.voteType,
    description: v.description || v.title,
    vote_date: v.date,
    session: String(v.sessionNumber || 1),
    congress: v.congress || CURRENT_CONGRESS,
  };
}

function normalizePosition(pos) {
  if (!pos) return 'Not Voting';
  const p = pos.toLowerCase();
  if (p === 'yea' || p === 'yes' || p === 'aye') return 'Yes';
  if (p === 'nay' || p === 'no') return 'No';
  if (p === 'present') return 'Present';
  return 'Not Voting';
}

function normalizeParty(abbr) {
  if (!abbr) return null;
  if (abbr === 'D' || abbr === 'Democrat') return 'D';
  if (abbr === 'R' || abbr === 'Republican') return 'R';
  return 'I';
}

module.exports = {
  getMembers,
  getMember,
  getMembersByState,
  getMemberVotes,
  getRecentVotes,
  getVoteDetail,
  getMemberSponsoredBills,
  getBill,
  normalizeMember,
  normalizeVote,
  CURRENT_CONGRESS,
};
