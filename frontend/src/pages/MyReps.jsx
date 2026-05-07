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
    const stored = sessionStorage.getItem('votemap_lookup');
    if (stored) { try { setData(JSON.parse(stored)); return; } catch {} }
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

function LoadingState() {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '5rem 1.5rem', textAlign: 'center' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-3)', margin: '0 auto 1.5rem', animation: 'pulse 1.2s ease infinite' }} />
      <p style={{ fontSize: 14, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Finding your representatives…</p>
    </div>
  );
}
