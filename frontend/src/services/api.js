// src/services/api.js
// All API calls from the frontend go through here.
// Change BASE_URL here if you deploy the backend somewhere.

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://votemap-production.up.railway.app/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// ── Lookup ────────────────────────────────────────────────────────────────────

// Core entry: resolve a ZIP to the user's representatives
export async function lookupZip(zip) {
  const { data } = await api.post('/lookup/zip', { zip });
  return data;
}

// ── Politicians ───────────────────────────────────────────────────────────────

export async function getPolitician(bioguideId) {
  const { data } = await api.get(`/politicians/${bioguideId}`);
  return data;
}

export async function getPoliticianVotes(bioguideId, page = 0, subject = null) {
  const params = { page };
  if (subject) params.subject = subject;
  const { data } = await api.get(`/politicians/${bioguideId}/votes`, { params });
  return data;
}

export async function getPoliticianAnalysis(bioguideId) {
  const { data } = await api.get(`/politicians/${bioguideId}/analysis`);
  return data;
}

export async function triggerAnalysis(bioguideId, forceRefresh = false) {
  const { data } = await api.post(
    `/politicians/${bioguideId}/analyze`,
    {},
    { params: { refresh: forceRefresh } }
  );
  return data;
}

export async function searchPoliticians(query = {}) {
  const { data } = await api.get('/politicians', { params: query });
  return data;
}

// ── Survey ────────────────────────────────────────────────────────────────────

export async function saveSurvey(userId, surveyData) {
  const { data } = await api.post(`/survey/${userId}`, surveyData);
  return data;
}

export async function getSurvey(userId) {
  try {
    const { data } = await api.get(`/survey/${userId}`);
    return data;
  } catch (err) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

// ── Error helpers ─────────────────────────────────────────────────────────────

export function getErrorMessage(err) {
  return err?.response?.data?.error || err?.message || 'Something went wrong.';
}

export async function getAlignment(userId, politicianIds) {
  try {
    const { data } = await api.get(`/survey/${userId}/alignment`, {
      params: { politicians: politicianIds.join(',') }
    });
    return data;
  } catch {
    return {};
  }
}

export async function getConflicts(politicianId) {
  try {
    const { data } = await api.get(`/politicians/${politicianId}/conflicts`);
    return data;
  } catch {
    return { conflicts: [], topDonors: [], fromCache: false };
  }
}

export async function computeConflicts(politicianId, employers, fecCandidateId = null) {
  const { data } = await api.post(`/politicians/${politicianId}/conflicts`, { employers, fecCandidateId });
  return data;
}

export async function getUpcoming(userId) {
  try {
    const params = userId ? { userId } : {};
    const { data } = await api.get('/upcoming', { params });
    return data;
  } catch (err) {
    if (err?.response?.status === 404) return { elections: [], bills: [], userPriorities: [] };
    throw err;
  }
}

export async function getAlignmentForPolitician(politicianId, userId) {
  const base = (import.meta.env.VITE_API_URL || 'https://votemap-production.up.railway.app/api').replace(/\/api$/, '');
  const token = localStorage.getItem('votemap_token');
  try {
    const res = await fetch(`${base}/api/politicians/${politicianId}/alignment?userId=${userId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
