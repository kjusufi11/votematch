import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUser, signIn, signUp, signOut, fetchMe } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(getUser());
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // On mount, refresh user profile from server so zip_code is always current
  useEffect(() => {
    if (!user) return;
    fetchMe().then(setUser).catch(() => {});
  }, []);

  async function login(email, password) {
    setLoading(true); setError('');
    try {
      const u = await signIn(email, password);
      setUser(u); return u;
    } catch (err) {
      const msg = err?.response?.data?.error || 'Login failed.';
      setError(msg); throw new Error(msg);
    } finally { setLoading(false); }
  }

  async function register(email, password) {
    setLoading(true); setError('');
    try {
      const u = await signUp(email, password);
      setUser(u); return u;
    } catch (err) {
      const msg = err?.response?.data?.error || 'Sign up failed.';
      setError(msg); throw new Error(msg);
    } finally { setLoading(false); }
  }

  function logout() { setUser(null); signOut(); }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, error, login, register, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
