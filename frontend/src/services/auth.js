// src/services/auth.js
// Simple JWT-based auth — no external dependencies

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://votemap-production.up.railway.app/api';
const TOKEN_KEY = 'votemap_token';
const USER_KEY  = 'votemap_user';

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

// Attach token to every request
api.interceptors.request.use(cfg => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function getUser()  { 
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
  catch { return null; }
}
export function isLoggedIn() { return !!getToken(); }

export async function signUp(email, password) {
  const { data } = await api.post('/auth/signup', { email, password });
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

export async function signIn(email, password) {
  const { data } = await api.post('/auth/signin', { email, password });
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

export function signOut() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = '/';
}

export default api;
