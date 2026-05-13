import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RepresentativeCard from '../components/RepresentativeCard';
import { getAlignment, getSurvey } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function MyReps() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [alignment, setAlignment] = useState({});
  const [surveyImportance, setSurveyImportance] = useState(undefined);

  useEffect(() => {
    const raw = sessionStorage.getItem('votemap_lookup') || localStorage.getItem('votemap_lookup');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.zip) {
          sessionStorage.setItem('votemap_lookup', raw); // warm sessionStorage for other pages
          setData(parsed);
          return;
        }
      } catch {}
    }
    navigate('/');
  }, []);

  // Fetch alignment scores when data and user are available
  useEffect(() => {
    if (!data || !user) return;
    const ids = data.representatives
      ?.filter(r => r.bioguideId)
      .map(r => r.bioguideId) || [];
    if (ids.length === 0) return;
    getAlignment(user.id, ids).then(setAlignment).catch(() => {});
  }, [data, user]);

  // Load user survey importance for personalized rep cards
  useEffect(() => {
    if (!user) { setSurveyImportance(null); return; }
    getSurvey(user.id)
      .then(d => setSurveyImportance(d?.importance || {}))
      .catch(() => setSurveyImportance({}));
  }, [user]);

  if (!data) return <LoadingState />;

  const { zip, city, state, representatives = [] } = data;
  const federal = representatives.filter(r => r.level === 'federal');
  const stateReps = representatives.filter(r => r.level === 'state');

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>

      <header className="animate-fade-up" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.07em' }}>ZIP {zip}</span>
          {city && state && <>
            <span style={{ color: 'var(--border-med)', fontSize: 11 }}>·</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{city}, {state}</span>
          </>}
          <button
            onClick={() => {
              sessionStorage.removeItem('votemap_lookup');
              navigate('/');
            }}
            style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
              background: 'none', border: '1px solid var(--border)', borderRadius: 3,
              padding: '2px 7px', cursor: 'pointer', letterSpacing: '.05em',
            }}
          >
            Change ZIP
          </button>
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(1.9rem, 4vw, 2.9rem)',
          fontWeight: 900, letterSpacing: '-.022em', lineHeight: 1.06, marginBottom: '.625rem',
        }}>Your Representatives</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
          {representatives.length} elected officials represent you.
        </p>

        {/* Legend */}
        <div style={{
          display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '.75rem 1.125rem',
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)',
        }}>
          {[
            { type: 'dot', color: 'var(--green)', label: 'High confidence' },
            { type: 'dot', color: 'var(--amber)', label: 'Medium confidence' },
            { type: 'dot', color: 'var(--text-3)', label: 'Low confidence' },
            { type: 'bar', color: 'var(--blue)', label: 'Votes for issue' },
            { type: 'bar', color: 'var(--red)', label: 'Votes against' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {l.type === 'dot'
                ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                : <span style={{ width: 16, height: 3, borderRadius: 2, background: l.color, flexShrink: 0 }} />
              }
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </header>

      {federal.length > 0 && (
        <section style={{ marginBottom: '2.5rem' }}>
          <SectionLabel>Federal — U.S. Congress</SectionLabel>
          {federal.map((rep, i) => <RepresentativeCard key={rep.bioguideId || rep.name} rep={rep} index={i} alignment={alignment[rep.bioguideId]} surveyImportance={surveyImportance} />)}
        </section>
      )}

      {stateReps.length > 0 && (
        <section>
          <SectionLabel>State Legislature</SectionLabel>
          {stateReps.map((rep, i) => <RepresentativeCard key={rep.name} rep={rep} index={federal.length + i} surveyImportance={surveyImportance} />)}
        </section>
      )}

      {representatives.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          No representatives found for this ZIP.
        </div>
      )}

      {/* Social share — shown when alignment scores are loaded */}
      {Object.values(alignment).some(s => s?.score != null) && (
        <ShareMatchButton alignment={alignment} representatives={federal} />
      )}

      <footer style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between' }}>
        <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Vote data: ProPublica · Reps: Google Civic · Analysis: Claude AI</p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Federal votes only · Updates nightly</p>
      </footer>
    </main>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

function ShareMatchButton({ alignment, representatives }) {
  const scores = representatives
    .filter(r => alignment[r.bioguideId]?.score != null)
    .map(r => ({ name: r.name?.split(', ').reverse().join(' ') || r.name, score: alignment[r.bioguideId].score }))
    .sort((a, b) => b.score - a.score);

  if (!scores.length) return null;

  const best = scores[0];
  const worst = scores[scores.length - 1];

  let tweetText;
  if (scores.length === 1) {
    tweetText = `I just found out ${best.name} is ${best.score}% aligned with my values on VoteMatch. How does your rep stack up?`;
  } else {
    tweetText = `My reps: ${best.name} is ${best.score}% aligned with my values, ${worst.name} is ${worst.score}%. See how yours vote → votematch.app`;
  }

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent('https://votematch.app')}&via=votematch`;

  return (
    <div style={{
      marginTop: '2rem', padding: '1.25rem 1.5rem',
      background: 'var(--bg-2)', border: '1px solid var(--border-med)',
      borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
    }}>
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Share your match scores</p>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Let people know how your representatives are voting
        </p>
      </div>
      <a
        href={tweetUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          height: 38, padding: '0 1.25rem', display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'var(--text)', color: 'var(--bg-2)',
          borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500,
          textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        <svg width="15" height="13" viewBox="0 0 15 13" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M14.2 0h-2.7L8.5 4.6 5.4 0H0l5.5 7.6L0 13h2.7l3.4-4.9L9.6 13H15l-5.7-7.7L14.2 0zm-3.7 12L1.8 1h2l8.7 11h-2z"/>
        </svg>
        Share on X
      </a>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '5rem 1.5rem', textAlign: 'center' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-3)', margin: '0 auto 1.5rem', animation: 'pulse 1.2s ease infinite' }} />
      <p style={{ fontSize: 14, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Finding your representatives…</p>
    </div>
  );
}
