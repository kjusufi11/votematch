import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

export default function Nav() {
  const { pathname } = useLocation();
  const { logout, isLoggedIn } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

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
            }}>VoteMatch</span>
          </Link>

          {/* Desktop nav — hidden on mobile via CSS class */}
          <div className="nav-links-desktop" style={{ gap: 8, alignItems: 'center' }}>
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

          {/* Hamburger — shown on mobile via CSS class */}
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(x => !x)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            style={{
              alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36,
              border: '1px solid var(--border-med)',
              borderRadius: 'var(--radius)',
              background: 'none',
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--text)',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >{menuOpen ? '✕' : '☰'}</button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div style={{
          position: 'fixed', top: 54, left: 0, right: 0, zIndex: 99,
          background: 'rgba(245,243,238,0.98)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
          padding: '0 1.5rem',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        }}>
          {pathname !== '/' && (
            <Link to="/" style={{
              fontSize: 14, fontFamily: 'var(--font-mono)',
              color: 'var(--text-2)', padding: '0.875rem 0',
              borderBottom: '1px solid var(--border)',
              display: 'block',
            }}>← Change ZIP</Link>
          )}
          {isLoggedIn ? (
            <>
              <Link to="/survey" style={{
                fontSize: 14, fontFamily: 'var(--font-mono)',
                color: 'var(--text-2)', padding: '0.875rem 0',
                borderBottom: '1px solid var(--border)',
                display: 'block',
              }}>My Values</Link>
              <button onClick={() => { logout(); setMenuOpen(false); }} style={{
                fontSize: 14, fontFamily: 'var(--font-mono)',
                color: 'var(--text-3)', background: 'none',
                border: 'none', borderTop: 'none',
                cursor: 'pointer', padding: '0.875rem 0',
                textAlign: 'left', display: 'block',
              }}>Sign out</button>
            </>
          ) : (
            <button onClick={() => { setShowAuth(true); setMenuOpen(false); }} style={{
              fontSize: 14, fontFamily: 'var(--font-mono)',
              color: 'var(--text)', background: 'none',
              border: 'none', cursor: 'pointer',
              padding: '0.875rem 0', textAlign: 'left',
              fontWeight: 500, display: 'block',
            }}>Sign in →</button>
          )}
        </div>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
