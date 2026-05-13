import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { lookupZip, getErrorMessage } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { saveZip } from '../services/auth';

const EXAMPLES = ['10001', '90210', '60601', '77001', '02101'];

export default function ZipLookup() {
  const [zip, setZip]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const navigate              = useNavigate();
  const [params]              = useSearchParams();
  const unsubscribed          = params.get('unsubscribed') === '1';
  const { user, setUser, isLoggedIn } = useAuth();
  const didAutoRedirect = useRef(false);

  // Auto-redirect if we already have a saved ZIP
  useEffect(() => {
    if (didAutoRedirect.current) return;

    // Logged-in user with a server-saved ZIP
    if (isLoggedIn && user?.zip_code) {
      didAutoRedirect.current = true;
      performLookup(user.zip_code);
      return;
    }

    // Guest user: restore last lookup from localStorage
    if (!isLoggedIn) {
      const cached = localStorage.getItem('votemap_lookup');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed?.zip && parsed?.representatives?.length) {
            didAutoRedirect.current = true;
            sessionStorage.setItem('votemap_lookup', cached);
            navigate('/reps');
            return;
          }
        } catch {}
      }
    }
  }, [user, isLoggedIn]);

  async function performLookup(zipCode) {
    setLoading(true);
    try {
      const data = await lookupZip(zipCode);
      const payload = JSON.stringify({ zip: zipCode, ...data });
      sessionStorage.setItem('votemap_lookup', payload);
      localStorage.setItem('votemap_lookup', payload);
      navigate('/reps');
    } catch {
      // Auto-lookup failed — just show the form so they can try again
      didAutoRedirect.current = false;
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const clean = zip.trim().replace(/\D/g, '').slice(0, 5);
    if (clean.length !== 5) { setError('Enter a valid 5-digit ZIP code.'); return; }
    setError(''); setLoading(true);
    try {
      const data = await lookupZip(clean);
      const payload = JSON.stringify({ zip: clean, ...data });
      sessionStorage.setItem('votemap_lookup', payload);
      localStorage.setItem('votemap_lookup', payload);

      // Persist ZIP for logged-in users
      if (isLoggedIn) {
        saveZip(clean)
          .then(() => setUser(u => u ? { ...u, zip_code: clean } : u))
          .catch(() => {});
      }

      navigate('/reps');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally { setLoading(false); }
  }

  // Show a minimal loading state while auto-redirecting
  if (loading && didAutoRedirect.current) {
    return (
      <div style={{ minHeight: 'calc(100vh - 54px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-3)', margin: '0 auto 1.5rem', animation: 'pulse 1.2s ease infinite' }} />
          <p style={{ fontSize: 14, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            Loading your representatives…
          </p>
        </div>
      </div>
    );
  }

  return (
    <main style={{ minHeight: 'calc(100vh - 54px)', display: 'flex', flexDirection: 'column' }}>

      {unsubscribed && (
        <div style={{
          textAlign: 'center', padding: '10px', fontSize: 13,
          background: 'var(--bg-2)', borderBottom: '1px solid var(--border)',
          color: 'var(--text-2)',
        }}>
          You've been unsubscribed from vote alerts. You can re-enable them in your <a href="/survey" style={{ color: 'var(--text)' }}>survey settings</a>.
        </div>
      )}

      {/* Hero */}
      <section style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '5rem 1.5rem 3rem', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #fff 0%, var(--bg) 60%)',
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px)',
          backgroundSize: '100% 60px',
          maskImage: 'linear-gradient(to bottom, transparent, rgba(0,0,0,.35) 30%, rgba(0,0,0,.35) 70%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, rgba(0,0,0,.35) 30%, rgba(0,0,0,.35) 70%, transparent)',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 700, width: '100%', textAlign: 'center' }}>

          <div className="animate-fade-up" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 11, fontFamily: 'var(--font-mono)',
            color: 'var(--text-2)', letterSpacing: '.1em', textTransform: 'uppercase',
            border: '1px solid var(--border-med)', borderRadius: 20,
            padding: '5px 16px', marginBottom: '2rem',
            background: 'var(--bg-2)', boxShadow: 'var(--shadow)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s ease infinite' }} />
            Real votes · AI analysis · No spin
          </div>

          <h1 className="animate-fade-up delay-1" style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.8rem, 7vw, 5rem)',
            fontWeight: 900, lineHeight: 1.02,
            letterSpacing: '-.025em', marginBottom: '1.25rem', color: 'var(--text)',
          }}>
            Who <em style={{ fontStyle: 'italic', color: 'var(--red)' }}>really</em><br />represents you?
          </h1>

          <p className="animate-fade-up delay-2" style={{
            fontSize: 18, color: 'var(--text-2)', lineHeight: 1.7,
            maxWidth: 520, margin: '0 auto 2.75rem', fontWeight: 300,
          }}>
            Enter your ZIP code to see your elected officials and uncover their actual voting patterns — analyzed by AI.
          </p>

          <form onSubmit={handleSubmit} className="animate-fade-up delay-3" style={{
            display: 'flex', gap: 10, maxWidth: 460, margin: '0 auto',
            flexWrap: 'wrap', justifyContent: 'center',
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <input
                type="text" inputMode="numeric" maxLength={5}
                placeholder="ZIP code" value={zip}
                onChange={e => { setZip(e.target.value.replace(/\D/g, '')); setError(''); }}
                autoFocus
                style={{
                  width: '100%', background: 'var(--bg-2)',
                  border: `1.5px solid ${error ? 'var(--red)' : 'var(--border-med)'}`,
                  borderRadius: 'var(--radius)', padding: '0 1.25rem',
                  height: 54, fontSize: 22, fontFamily: 'var(--font-mono)',
                  letterSpacing: '.12em', outline: 'none',
                  boxShadow: 'var(--shadow)',
                  transition: 'border-color var(--transition)',
                }}
                onFocus={e => { if (!error) e.target.style.borderColor = 'var(--text)'; }}
                onBlur={e => { if (!error) e.target.style.borderColor = 'var(--border-med)'; }}
              />
            </div>
            <button type="submit" disabled={loading || zip.length < 5} style={{
              height: 54, padding: '0 1.75rem',
              background: (loading || zip.length < 5) ? 'var(--bg-4)' : 'var(--text)',
              color: 'var(--bg-2)', borderRadius: 'var(--radius)',
              fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap',
              boxShadow: 'var(--shadow)', transition: 'all var(--transition)',
              opacity: (loading || zip.length < 5) ? 0.5 : 1,
            }}>
              {loading ? 'Looking up…' : 'See my reps →'}
            </button>
          </form>

          {error && (
            <p style={{ marginTop: '.75rem', fontSize: 12, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>
              {error}
            </p>
          )}

          <div className="animate-fade-up delay-4" style={{
            marginTop: '2rem', display: 'flex', gap: 7,
            justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Try:</span>
            {EXAMPLES.map(z => (
              <button key={z} onClick={() => { setZip(z); setError(''); }} style={{
                fontSize: 12, fontFamily: 'var(--font-mono)',
                color: 'var(--text-2)', border: '1px solid var(--border-med)',
                borderRadius: 4, padding: '3px 10px', background: 'var(--bg-2)',
                transition: 'all var(--transition)',
              }}
                onMouseEnter={e => { e.target.style.background = 'var(--text)'; e.target.style.color = 'var(--bg-2)'; e.target.style.borderColor = 'var(--text)'; }}
                onMouseLeave={e => { e.target.style.background = 'var(--bg-2)'; e.target.style.color = 'var(--text-2)'; e.target.style.borderColor = 'var(--border-med)'; }}
              >
                {z}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Mockup preview */}
      <section style={{ padding: '2.5rem 1.5rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <p style={{
            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
            letterSpacing: '.12em', textTransform: 'uppercase', textAlign: 'center', marginBottom: '1.25rem',
          }}>What you get after entering your ZIP</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
            {[
              { name: 'Sen. Jane Doe', party: 'D', state: 'NY', score: 82, scoreColor: 'var(--green)', bars: [{ label: 'Healthcare', pct: 88 }, { label: 'Climate', pct: 91 }, { label: 'Education', pct: 76 }] },
              { name: 'Rep. John Smith', party: 'R', state: 'NY', score: 34, scoreColor: 'var(--red)', bars: [{ label: 'Healthcare', pct: 22 }, { label: 'Climate', pct: 18 }, { label: 'Taxes', pct: 55 }] },
            ].map((rep, idx) => (
              <div key={idx} style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem',
                boxShadow: 'var(--shadow)', opacity: 0.85,
                display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: rep.party === 'D' ? 'var(--party-d-dim)' : 'var(--party-r-dim)',
                  border: `2px solid ${rep.party === 'D' ? 'var(--party-d)' : 'var(--party-r)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: rep.party === 'D' ? 'var(--party-d)' : 'var(--party-r)',
                }}>{rep.name.split(' ').slice(-1)[0][0]}</div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--text)' }}>{rep.name}</p>
                  <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', margin: '2px 0 0' }}>
                    {rep.party === 'D' ? 'Democrat' : 'Republican'} · {rep.state}
                  </p>
                </div>
                <div style={{ flex: 2, minWidth: 140 }}>
                  {rep.bars.map(b => (
                    <div key={b.label} style={{ marginBottom: 5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{b.label}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${b.pct}%`, background: b.pct > 50 ? 'var(--blue)' : 'var(--red)', borderRadius: 2, transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 900, color: rep.scoreColor, margin: 0, letterSpacing: '-.02em' }}>
                    {rep.score}%
                  </p>
                  <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', margin: '2px 0 0' }}>match</p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: '.875rem' }}>
            Sample preview — your actual results are based on your ZIP and your survey answers
          </p>
        </div>
      </section>

      {/* Feature strip */}
      <section style={{
        borderTop: '1px solid var(--border)', background: 'var(--bg-2)', padding: '3rem 1.5rem',
      }}>
        <div style={{
          maxWidth: 960, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '2rem',
        }}>
          {[
            { icon: '◎', title: 'Your exact representatives', desc: 'Federal and state officials tied to your specific ZIP — not just your state.' },
            { icon: '⚑', title: 'Corruption & influence flags', desc: 'Surfaces voting patterns tied to lobbyist funding and foreign interests.' },
            { icon: '↗', title: 'Real vote records', desc: 'Every roll call vote from Congress, pulled live from ProPublica.' },
            { icon: '◈', title: 'AI bias analysis', desc: 'Claude reads 200+ votes and surfaces the ideological patterns the data reveals.' },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: '.875rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: 'var(--text-3)', flexShrink: 0, marginTop: 2 }}>{f.icon}</span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, color: 'var(--text)' }}>{f.title}</p>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
