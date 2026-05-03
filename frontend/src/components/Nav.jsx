import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

export default function Nav() {
  const { pathname } = useLocation();
  const { user, logout, isLoggedIn } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(245,243,238,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        height: 54,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', width: '100%',
          padding: '0 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{
              width: 9, height: 9, borderRadius: '50%',
              background: 'var(--red)', display: 'inline-block',
            }} />
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 900,
              letterSpacing: '-.02em', color: 'var(--text)',
            }}>VoteMap</span>
          </Link>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {pathname !== '/' && (
              <Link to="/" style={{
                fontSize: 12, color: 'var(--text-2)',
                padding: '5px 12px',
                border: '1px solid var(--border-med)',
                borderRadius: 20,
                fontFamily: 'var(--font-mono)',
              }}>← Change ZIP</Link>
            )}

            {isLoggedIn ? (
              <>
                <Link to="/survey" style={{
                  fontSize: 12, fontFamily: 'var(--font-mono)',
                  color: 'var(--text-2)', padding: '5px 12px',
                  border: '1px solid var(--border-med)', borderRadius: 20,
                }}>My Values</Link>
                <button onClick={logout} style={{
                  fontSize: 12, fontFamily: 'var(--font-mono)',
                  color: 'var(--text-3)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: '5px 8px',
                }}>Sign out</button>
              </>
            ) : (
              <button onClick={() => setShowAuth(true)} style={{
                fontSize: 12, fontFamily: 'var(--font-mono)',
                padding: '5px 14px',
                border: '1px solid var(--border-med)', borderRadius: 20,
                background: 'var(--text)', color: 'var(--bg-2)',
                cursor: 'pointer',
              }}>Sign in</button>
            )}
          </div>
        </div>
      </nav>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
