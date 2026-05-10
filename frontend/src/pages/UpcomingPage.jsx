import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUpcoming } from '../services/api';
import Avatar from '../components/Avatar';

const PC = { D: 'var(--party-d)', R: 'var(--party-r)', I: 'var(--party-i)' };
const PD = { D: 'var(--party-d-dim)', R: 'var(--party-r-dim)', I: 'var(--party-i-dim)' };
const PL = { D: 'Democrat', R: 'Republican', I: 'Independent' };

const scoreColor = s => s >= 70 ? 'var(--green)' : s >= 45 ? 'var(--amber)' : 'var(--red)';
const scoreDim   = s => s >= 70 ? 'var(--green-dim)' : s >= 45 ? 'var(--amber-dim)' : 'var(--red-dim)';

const PRIORITY_LABELS = {
  healthcare: 'Healthcare', climate: 'Climate & Energy', immigration: 'Immigration',
  gun_policy: 'Gun Policy', taxes: 'Economy & Taxes', defense: 'Defense & Foreign Policy',
  reproductive_rights: 'Reproductive Rights', education: 'Education',
  safety_net: 'Social Safety Net', criminal_justice: 'Criminal Justice',
};

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '.75rem' }}>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

export default function UpcomingPage() {
  const { user, isLoggedIn } = useAuth();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [stateFilter, setStateFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    getUpcoming(user?.id)
      .then(setData)
      .catch(err => setError(err?.response?.data?.error || err.message || 'Failed to load.'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      Loading upcoming…
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--red)', fontSize: 14 }}>{error}</div>
  );

  const elections = data?.elections || [];
  const bills     = data?.bills || [];
  const userPriorities = data?.userPriorities || [];

  const states = [...new Set(elections.map(p => p.state))].sort();
  const filteredElections = stateFilter
    ? elections.filter(p => p.state === stateFilter)
    : elections;

  const senate = filteredElections.filter(p => p.chamber === 'senate');
  const house  = filteredElections.filter(p => p.chamber === 'house');

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
        fontWeight: 900, letterSpacing: '-.022em', lineHeight: 1.06,
        marginBottom: '.5rem',
      }}>
        {data?.electionYear} Elections &amp; Upcoming Votes
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: '2.5rem', lineHeight: 1.6 }}>
        {isLoggedIn && userPriorities.length > 0
          ? `Showing bills in your priority areas: ${userPriorities.map(p => PRIORITY_LABELS[p] || p).join(', ')}.`
          : isLoggedIn
          ? <>Bills across all topics. <Link to="/survey" style={{ color: 'var(--text-2)' }}>Set your priorities →</Link></>
          : <>Sign in and take the survey to see content tailored to your priorities.</>
        }
      </p>

      {/* ── Elections ── */}
      <div style={{ marginBottom: '3rem' }}>
        <SectionLabel>
          {data?.electionYear} elections · {elections.length} seats
        </SectionLabel>

        {elections.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            No election data available.
          </p>
        ) : (
          <>
            {/* State filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>Filter by state:</span>
              <select
                value={stateFilter}
                onChange={e => setStateFilter(e.target.value)}
                style={{ fontSize: 12, fontFamily: 'var(--font-mono)', border: '1px solid var(--border-med)', borderRadius: 'var(--radius)', padding: '4px 8px', background: 'var(--bg-2)', outline: 'none', cursor: 'pointer' }}
              >
                <option value="">All states ({elections.length})</option>
                {states.map(s => (
                  <option key={s} value={s}>{s} ({elections.filter(p => p.state === s).length})</option>
                ))}
              </select>
            </div>

            {senate.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.625rem' }}>
                  Senate seats
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '.75rem' }}>
                  {senate.map(pol => <ElectionCard key={pol.id} pol={pol} />)}
                </div>
              </div>
            )}

            {house.length > 0 && (
              <div>
                <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.625rem' }}>
                  House seats ({house.length})
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '.75rem' }}>
                  {house.slice(0, 30).map(pol => <ElectionCard key={pol.id} pol={pol} />)}
                </div>
                {house.length > 30 && (
                  <p style={{ marginTop: '.75rem', fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    …and {house.length - 30} more House seats. Filter by state to see your district.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Bills to Watch ── */}
      <div>
        <SectionLabel>
          Bills to watch{userPriorities.length > 0 ? ' · your priority areas' : ' · recent activity'}
        </SectionLabel>

        {bills.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            No recent bills found.{' '}
            {isLoggedIn && userPriorities.length === 0 && (
              <Link to="/survey" style={{ color: 'var(--text-2)' }}>Set your priorities →</Link>
            )}
          </p>
        ) : (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            {bills.map((bill, i) => <BillRow key={bill.id} bill={bill} last={i === bills.length - 1} />)}
          </div>
        )}
      </div>

      <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          Election data: Congress.gov · Bill data: ProPublica Congress API
        </span>
      </div>
    </main>
  );
}

function ElectionCard({ pol }) {
  const score = pol.alignmentScore;
  return (
    <Link
      to={`/politician/${pol.id}`}
      style={{
        display: 'block', background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '.875rem 1rem',
        boxShadow: 'var(--shadow)', transition: 'all var(--transition)', textDecoration: 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-med)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '.625rem', marginBottom: '.5rem' }}>
        <Avatar id={pol.id} name={pol.full_name} party={pol.party} size={32} fontSize={11} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pol.full_name}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            {pol.state}{pol.district ? `-${pol.district}` : ''} · {pol.chamber === 'senate' ? 'Sen.' : 'Rep.'}
          </p>
        </div>
        {score != null && (
          <span style={{
            fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
            padding: '2px 8px', borderRadius: 20, flexShrink: 0,
            background: scoreDim(score), color: scoreColor(score),
          }}>{score}%</span>
        )}
      </div>
      <span style={{
        display: 'inline-block', fontSize: 10, fontFamily: 'var(--font-mono)',
        padding: '2px 7px', borderRadius: 3,
        background: PD[pol.party] || 'var(--bg-3)',
        color: PC[pol.party] || 'var(--text-2)',
      }}>{PL[pol.party] || pol.party}</span>
    </Link>
  );
}

function BillRow({ bill, last }) {
  const date = bill.last_vote_date || bill.introduced_date;
  const dateStr = date ? new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;
  return (
    <div style={{
      padding: '10px 1.25rem', borderBottom: last ? 'none' : '1px solid var(--border)',
      display: 'flex', gap: '.875rem', alignItems: 'flex-start',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45, marginBottom: 3 }}>
          {bill.short_title || bill.title}
        </p>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {bill.primary_subject && (
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', padding: '1px 6px', borderRadius: 3, background: 'var(--bg-3)' }}>
              {bill.primary_subject}
            </span>
          )}
          {bill.number && (
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{bill.number}</span>
          )}
          {bill.status && (
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{bill.status}</span>
          )}
        </div>
      </div>
      {dateStr && (
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', flexShrink: 0, whiteSpace: 'nowrap' }}>{dateStr}</span>
      )}
    </div>
  );
}
