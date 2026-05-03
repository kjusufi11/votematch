import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthModal({ onClose }) {
  const { login, register, loading, error } = useAuth();
  const [mode, setMode]         = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [localErr, setLocalErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalErr('');
    if (!email || !password) { setLocalErr('Please fill in all fields.'); return; }
    if (password.length < 6) { setLocalErr('Password must be at least 6 characters.'); return; }
    try {
      if (mode === 'signin') await login(email, password);
      else await register(email, password);
      onClose();
    } catch (err) {
      setLocalErr(err.message);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--bg-2)', borderRadius: 'var(--radius-lg)',
        padding: '2rem', width: '100%', maxWidth: 400,
        boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)',
        animation: 'fadeUp 0.2s ease both',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700,
          marginBottom: '.25rem',
        }}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: '1.5rem' }}>
          {mode === 'signin'
            ? 'Sign in to save your values and see alignment scores.'
            : 'Create a free account to save your survey results.'}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" autoFocus
              style={{
                width: '100%', padding: '10px 12px', fontSize: 14,
                border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius)',
                background: 'var(--bg)', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', display: 'block', marginBottom: 5 }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '10px 12px', fontSize: 14,
                border: '1.5px solid var(--border-med)', borderRadius: 'var(--radius)',
                background: 'var(--bg)', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {(localErr || error) && (
            <p style={{ fontSize: 12, color: 'var(--red)', fontFamily: 'var(--font-mono)', marginBottom: '1rem' }}>
              {localErr || error}
            </p>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', height: 44, fontSize: 14, fontWeight: 500,
            background: loading ? 'var(--bg-3)' : 'var(--text)',
            color: 'var(--bg-2)', border: 'none', borderRadius: 'var(--radius)',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: 13, color: 'var(--text-3)' }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setLocalErr(''); }}
            style={{ color: 'var(--text)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
