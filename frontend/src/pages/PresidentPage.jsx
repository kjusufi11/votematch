import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPresident } from '../services/api';

const PARTY_COLOR = { D: 'var(--party-d)', R: 'var(--party-r)', I: 'var(--party-i)' };
const PARTY_DIM   = { D: 'var(--party-d-dim)', R: 'var(--party-r-dim)', I: 'var(--party-i-dim)' };
const PARTY_LABEL = { D: 'Democrat', R: 'Republican', I: 'Independent' };

const VOTE_COLOR = { Yes: 'var(--green)', No: 'var(--red)' };
const VOTE_BG    = { Yes: 'var(--green-dim)', No: 'var(--red-dim)' };

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
      <span style={{
        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
        letterSpacing: '.12em', textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

function StatCard({ value, label }) {
  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem',
      boxShadow: 'var(--shadow)', textAlign: 'center', flex: '1 1 140px',
    }}>
      <p style={{
        fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
        fontWeight: 900, letterSpacing: '-.02em', color: 'var(--text)', margin: 0,
      }}>{value}</p>
      <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', margin: '4px 0 0' }}>
        {label}
      </p>
    </div>
  );
}

function EOCard({ eo, index }) {
  const dateStr = eo.date
    ? new Date(eo.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem',
      boxShadow: 'var(--shadow)',
      animation: `fadeUp 0.3s ease ${Math.min(index * 0.04, 0.5)}s both`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.75rem', marginBottom: '.5rem' }}>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {eo.eo_number && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '.08em',
              textTransform: 'uppercase', padding: '2px 7px', borderRadius: 3,
              background: 'var(--bg-3)', color: 'var(--text-3)',
            }}>EO {eo.eo_number}</span>
          )}
          {dateStr && (
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
              {dateStr}
            </span>
          )}
        </div>
      </div>

      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, marginBottom: '.5rem' }}>
        {eo.title}
      </p>

      {eo.summary && (
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: '.625rem' }}>
          {eo.summary}
        </p>
      )}

      {!eo.summary && eo.abstract && (
        <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: '.625rem', fontStyle: 'italic' }}>
          {eo.abstract.slice(0, 200)}{eo.abstract.length > 200 ? '…' : ''}
        </p>
      )}

      <a
        href={eo.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)',
          textDecoration: 'none',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-2)'}
      >
        Read full text →
      </a>
    </div>
  );
}

function RepVoteRow({ vote, last }) {
  const dateStr = vote.vote_date
    ? new Date(vote.vote_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const title = vote.short_title || vote.title || vote.description || vote.question;

  return (
    <div style={{
      padding: '10px 1.25rem',
      borderBottom: last ? 'none' : '1px solid var(--border)',
      display: 'flex', alignItems: 'flex-start', gap: '.875rem',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: PARTY_COLOR[vote.party] || 'var(--text-2)',
          }}>
            {vote.pol_title} {vote.full_name}
          </span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            {vote.state} · {vote.chamber === 'senate' ? 'Senate' : 'House'}
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>
          {title}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{
          fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
          padding: '2px 8px', borderRadius: 20,
          background: VOTE_BG[vote.position] || 'var(--bg-3)',
          color: VOTE_COLOR[vote.position] || 'var(--text-3)',
        }}>{vote.position}</span>
        {dateStr && (
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{dateStr}</span>
        )}
      </div>
    </div>
  );
}

export default function PresidentPage() {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const polIds = getRepPolIds();
    setLoading(true);
    getPresident(polIds)
      .then(setData)
      .catch(err => setError(err?.response?.data?.error || err.message || 'Failed to load.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      Loading…
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--red)', fontSize: 14 }}>{error}</div>
  );

  const { president, stats, executiveOrders = [], repVotes = [] } = data || {};

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>

      {/* ── President header ── */}
      <div style={{
        display: 'flex', gap: '1.5rem', alignItems: 'flex-start',
        marginBottom: '2.5rem', flexWrap: 'wrap',
      }}>
        {!imgError && president?.photo_url && (
          <img
            src={president.photo_url}
            alt={president.name}
            onError={() => setImgError(true)}
            style={{
              width: 90, height: 110, objectFit: 'cover', objectPosition: 'top',
              borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.5rem', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '.1em',
              textTransform: 'uppercase', padding: '2px 8px', borderRadius: 3,
              background: PARTY_DIM[president?.party] || 'var(--bg-3)',
              color: PARTY_COLOR[president?.party] || 'var(--text-2)',
            }}>{PARTY_LABEL[president?.party] || president?.party}</span>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
              {president?.term_number}{ordinalSuffix(president?.term_number)} President
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.6rem)',
            fontWeight: 900, letterSpacing: '-.022em', lineHeight: 1.06,
            marginBottom: '.375rem',
          }}>{president?.name}</h1>

          <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', margin: 0 }}>
            {president?.title} · Term began{' '}
            {president?.term_start
              ? new Date(president.term_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              : ''}
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '3rem' }}>
        <StatCard value={stats?.eoCount ?? '—'} label="Executive orders signed" />
        <StatCard value={stats?.daysInOffice ?? '—'} label="Days in office" />
      </div>

      {/* ── Executive orders ── */}
      <div style={{ marginBottom: '3rem' }}>
        <SectionLabel>
          Executive orders · most recent {executiveOrders.length}
        </SectionLabel>

        {executiveOrders.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            No executive orders found.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '.75rem' }}>
            {executiveOrders.map((eo, i) => <EOCard key={eo.id} eo={eo} index={i} />)}
          </div>
        )}

        <p style={{ marginTop: '1rem', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          Source: Federal Register (federalregister.gov) · Summaries generated by AI
        </p>
      </div>

      {/* ── Rep votes ── */}
      {repVotes.length > 0 && (
        <div style={{ marginBottom: '3rem' }}>
          <SectionLabel>How your representatives voted · 119th Congress</SectionLabel>
          <div style={{
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)',
          }}>
            {repVotes.map((v, i) => (
              <RepVoteRow key={v.id} vote={v} last={i === repVotes.length - 1} />
            ))}
          </div>
        </div>
      )}

      {repVotes.length === 0 && (
        <div style={{ marginBottom: '3rem' }}>
          <SectionLabel>How your representatives voted · 119th Congress</SectionLabel>
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            {getRepPolIds().length === 0
              ? <>Enter your ZIP on the <a href="/" style={{ color: 'var(--text-2)' }}>home page</a> to see how your reps voted.</>
              : 'No recent votes found for your representatives.'
            }
          </p>
        </div>
      )}

      <div style={{ paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          Executive order data: Federal Register API · Vote data: Congress.gov
        </span>
      </div>
    </main>
  );
}

function getRepPolIds() {
  try {
    const stored = sessionStorage.getItem('votemap_lookup');
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return (parsed.representatives || [])
      .filter(r => r.level === 'federal' && r.id)
      .map(r => r.id);
  } catch {
    return [];
  }
}

function ordinalSuffix(n) {
  if (!n) return 'th';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
