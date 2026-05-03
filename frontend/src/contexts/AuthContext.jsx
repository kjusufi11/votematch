import React, { createContext, useContext, useState } from 'react';
import { getUser, signIn, signUp, signOut } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(getUser());
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

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
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
