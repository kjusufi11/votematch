import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { lookupZip, getErrorMessage } from '../services/api';

const EXAMPLES = ['10001', '90210', '60601', '77001', '02101'];

export default function ZipLookup() {
  const [zip, setZip]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const navigate              = useNavigate();
  const [params]              = useSearchParams();
  const unsubscribed          = params.get('unsubscribed') === '1';

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
      navigate('/reps');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally { setLoading(false); }
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
        {/* Subtle horizontal lines */}
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
