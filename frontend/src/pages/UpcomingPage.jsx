import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUpcoming, getBillDetails, getTrackedBills, trackBill, untrackBill } from '../services/api';
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

const BILL_TYPE_MAP = {
  hr: 'house-bill', s: 'senate-bill',
  hjres: 'house-joint-resolution', sjres: 'senate-joint-resolution',
  hres: 'house-resolution', sres: 'senate-resolution',
  hconres: 'house-concurrent-resolution', sconres: 'senate-concurrent-resolution',
};

const STATUS_COLOR = {
  'Signed':            'var(--green)',
  'Vetoed':            'var(--red)',
  'Passed House':      'var(--amber)',
  'Passed Senate':     'var(--amber)',
  'Out of Committee':  'var(--amber)',
  'In Committee':      'var(--text-3)',
  'Introduced':        'var(--text-3)',
};
const STATUS_BG = {
  'Signed':            'var(--green-dim)',
  'Vetoed':            'var(--red-dim)',
  'Passed House':      'var(--amber-dim)',
  'Passed Senate':     'var(--amber-dim)',
  'Out of Committee':  'var(--amber-dim)',
  'In Committee':      'var(--bg-3)',
  'Introduced':        'var(--bg-3)',
};

function buildCongressUrl(ref) {
  if (!ref) return null;
  const { congress, type, number } = ref;
  const billType = BILL_TYPE_MAP[type?.toLowerCase()];
  if (!billType) return null;
  return `https://www.congress.gov/bill/${congress}th-congress/${billType}/${number}`;
}

function buildCongressSearchUrl(query) {
  return `https://www.congress.gov/search?q=${encodeURIComponent(JSON.stringify({ source: 'legislation', search: query }))}`;
}

function getRepPolIds() {
  try {
    const stored = sessionStorage.getItem('votemap_lookup');
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return (parsed.representatives || [])
      .filter(r => r.level === 'federal' && r.id)
      .map(r => r.id);
  } catch { return []; }
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '.75rem' }}>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

function ElectionGroup({ senate, house, label, badge }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.625rem' }}>
          <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.1em', textTransform: 'uppercase', margin: 0 }}>
            {label}
          </p>
          {badge && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase',
              padding: '2px 7px', borderRadius: 3,
              background: 'var(--blue-dim, rgba(99,102,241,.12))', color: 'var(--blue, #6366f1)',
            }}>{badge}</span>
          )}
        </div>
      )}
      {senate.length > 0 && (
        <div style={{ marginBottom: house.length > 0 ? '1rem' : 0 }}>
          {!label && (
            <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.5rem' }}>
              Senate seats
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '.75rem' }}>
            {senate.map(pol => <ElectionCard key={pol.id} pol={pol} />)}
          </div>
        </div>
      )}
      {house.length > 0 && (
        <div>
          {!label && (
            <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.5rem' }}>
              House seats ({house.length})
            </p>
          )}
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
    </div>
  );
}

export default function UpcomingPage() {
  const { user, isLoggedIn } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [userState, setUserState]     = useState('');
  const [showAllStates, setShowAllStates] = useState(false);
  const [expandedBills, setExpandedBills] = useState(new Set());
  const [trackedKeys, setTrackedKeys]     = useState(new Set());
  const [repPolIds, setRepPolIds]         = useState([]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('votemap_lookup');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.state) setUserState(parsed.state.toUpperCase());
      }
      setRepPolIds(getRepPolIds());
    } catch {}
  }, []);

  useEffect(() => {
    setLoading(true);
    getUpcoming(user?.id)
      .then(setData)
      .catch(err => setError(err?.response?.data?.error || err.message || 'Failed to load.'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!isLoggedIn) return;
    getTrackedBills()
      .then(rows => setTrackedKeys(new Set(rows.map(r => `${r.congress}:${r.bill_type}:${r.bill_number}`))))
      .catch(() => {});
  }, [isLoggedIn]);

  const toggleBill = useCallback(id => {
    setExpandedBills(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleTrackChange = useCallback((key, tracked) => {
    setTrackedKeys(prev => {
      const next = new Set(prev);
      tracked ? next.add(key) : next.delete(key);
      return next;
    });
  }, []);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      Loading upcoming…
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--red)', fontSize: 14 }}>{error}</div>
  );

  const elections      = data?.elections || [];
  const bills          = data?.bills || [];
  const userPriorities = data?.userPriorities || [];

  // ── Elections: split by user state ───────────────────────────────────────
  const myStateAll  = userState ? elections.filter(p => p.state === userState) : [];
  const myStateSen  = myStateAll.filter(p => p.chamber === 'senate');
  const myStateHouse = myStateAll.filter(p => p.chamber === 'house');
  const hasMyState  = myStateAll.length > 0;

  // "Other" elections: all states when no userState, or all other states
  const otherAll   = userState ? elections.filter(p => p.state !== userState) : elections;
  const states     = [...new Set(otherAll.map(p => p.state))].sort();
  const filtered   = stateFilter ? otherAll.filter(p => p.state === stateFilter) : otherAll;
  const otherSen   = filtered.filter(p => p.chamber === 'senate');
  const otherHouse = filtered.filter(p => p.chamber === 'house');

  const showOther = !userState || showAllStates;

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
            {/* User's state first */}
            {hasMyState && (
              <ElectionGroup
                senate={myStateSen}
                house={myStateHouse}
                label={`${userState} races`}
                badge="Your state"
              />
            )}

            {/* All other states — collapsed if user has a state */}
            {showOther && (
              <>
                {userState && hasMyState && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>All states</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                )}

                {/* State filter (only shown in all-states view) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>Filter by state:</span>
                  <select
                    value={stateFilter}
                    onChange={e => setStateFilter(e.target.value)}
                    style={{ fontSize: 12, fontFamily: 'var(--font-mono)', border: '1px solid var(--border-med)', borderRadius: 'var(--radius)', padding: '4px 8px', background: 'var(--bg-2)', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">All states ({otherAll.length})</option>
                    {states.map(s => (
                      <option key={s} value={s}>{s} ({otherAll.filter(p => p.state === s).length})</option>
                    ))}
                  </select>
                </div>

                {otherSen.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.625rem' }}>
                      Senate seats
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '.75rem' }}>
                      {otherSen.map(pol => <ElectionCard key={pol.id} pol={pol} />)}
                    </div>
                  </div>
                )}

                {otherHouse.length > 0 && (
                  <div>
                    <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.625rem' }}>
                      House seats ({otherHouse.length})
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '.75rem' }}>
                      {otherHouse.slice(0, 30).map(pol => <ElectionCard key={pol.id} pol={pol} />)}
                    </div>
                    {otherHouse.length > 30 && (
                      <p style={{ marginTop: '.75rem', fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                        …and {otherHouse.length - 30} more House seats. Filter by state to see your district.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Show all states toggle */}
            {userState && hasMyState && !showAllStates && otherAll.length > 0 && (
              <button
                onClick={() => setShowAllStates(true)}
                style={{
                  marginTop: '.5rem', fontSize: 13, fontFamily: 'var(--font-mono)',
                  color: 'var(--text-2)', background: 'transparent',
                  border: '1px solid var(--border-med)', borderRadius: 'var(--radius)',
                  padding: '8px 16px', cursor: 'pointer',
                }}
              >
                Show all states ({otherAll.length} more seats) ↓
              </button>
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
            {bills.map((bill, i) => (
              <BillCard
                key={bill.id}
                bill={bill}
                last={i === bills.length - 1}
                expanded={expandedBills.has(bill.id)}
                onToggle={() => toggleBill(bill.id)}
                trackedKeys={trackedKeys}
                onTrackChange={handleTrackChange}
                user={user}
                isLoggedIn={isLoggedIn}
                repPolIds={repPolIds}
              />
            ))}
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

function BillCard({ bill, last, expanded, onToggle, trackedKeys, onTrackChange, user, isLoggedIn, repPolIds }) {
  const [details, setDetails]           = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [trackPending, setTrackPending] = useState(false);

  const ref      = bill.billRef;
  const trackKey = ref ? `${ref.congress}:${ref.type}:${ref.number}` : null;
  const isTracked = trackKey ? trackedKeys.has(trackKey) : false;
  const congressUrl = buildCongressUrl(ref);

  const date    = bill.last_vote_date || bill.introduced_date;
  const dateStr = date ? new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;

  useEffect(() => {
    if (!expanded || details !== null || !ref) return;
    setLoadingDetails(true);
    getBillDetails(ref.congress, ref.type, ref.number, repPolIds)
      .then(d => setDetails(d || {}))
      .catch(() => setDetails({}))
      .finally(() => setLoadingDetails(false));
  }, [expanded, ref?.congress, ref?.type, ref?.number, details, repPolIds]);

  const handleTrack = async e => {
    e.stopPropagation();
    if (!ref || trackPending) return;
    setTrackPending(true);
    try {
      if (isTracked) {
        await untrackBill(ref.congress, ref.type, ref.number);
        onTrackChange(trackKey, false);
      } else {
        await trackBill(ref.congress, ref.type, ref.number, bill.short_title || bill.title);
        onTrackChange(trackKey, true);
      }
    } catch {} finally { setTrackPending(false); }
  };

  const statusLabel = details?.statusLabel || null;

  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      {/* ── Collapsed header (always visible) ── */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', padding: '12px 1.25rem',
          display: 'flex', gap: '.875rem', alignItems: 'flex-start',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45, marginBottom: 5 }}>
            {bill.short_title || bill.title}
          </p>
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {bill.primary_subject && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', padding: '1px 6px', borderRadius: 3, background: 'var(--bg-3)' }}>
                {bill.primary_subject}
              </span>
            )}
            {ref && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                {ref.type.toUpperCase().replace('HJRES', 'H.J.Res.').replace('SJRES', 'S.J.Res.').replace('HCONRES', 'H.Con.Res.').replace('SCONRES', 'S.Con.Res.').replace('HRES', 'H.Res.').replace('SRES', 'S.Res.').replace('HR', 'H.R.')}{' '}{ref.number}
              </span>
            )}
            {statusLabel && (
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', padding: '1px 6px', borderRadius: 3,
                background: STATUS_BG[statusLabel] || 'var(--bg-3)',
                color: STATUS_COLOR[statusLabel] || 'var(--text-3)',
              }}>{statusLabel}</span>
            )}
            {isTracked && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>Tracking</span>
            )}
            {dateStr && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{dateStr}</span>
            )}
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0, marginTop: 2, fontFamily: 'var(--font-mono)' }}>
          {expanded ? '↑' : '↓'}
        </span>
      </button>

      {/* ── Expanded details ── */}
      {expanded && (
        <div style={{ padding: '0 1.25rem 1rem', borderTop: '1px solid var(--border)' }}>
          {loadingDetails ? (
            <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', padding: '10px 0' }}>
              Loading details…
            </p>
          ) : !ref ? (
            /* No Congress.gov reference — show what we have from DB */
            <div style={{ paddingTop: '.75rem' }}>
              {bill.title && bill.title !== (bill.short_title || '') && (
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '.75rem' }}>
                  {bill.title}
                </p>
              )}
              {bill.summary && (
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '.75rem' }}>
                  {bill.summary}
                </p>
              )}
              <a
                href={buildCongressSearchUrl(bill.short_title || bill.title)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', textDecoration: 'none',
                  padding: '5px 12px', border: '1px solid var(--border-med)', borderRadius: 'var(--radius)', background: 'var(--bg-2)', display: 'inline-block' }}
              >Search on Congress.gov →</a>
            </div>
          ) : (
            <>
              {/* Summary */}
              {(details?.summary || bill.summary) && (
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '.75rem', paddingTop: '.75rem' }}>
                  {details?.summary || bill.summary}
                </p>
              )}

              {/* Status + committee */}
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '.75rem', paddingTop: details?.summary || bill.summary ? 0 : '.75rem' }}>
                {details?.primaryCommittee && (
                  <div>
                    <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 3 }}>Committee</p>
                    <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{details.primaryCommittee}</p>
                  </div>
                )}
                {details?.latestAction && (
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 3 }}>Latest action</p>
                    <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.4 }}>
                      {details.latestAction.text}
                      {details.latestAction.actionDate && (
                        <span style={{ color: 'var(--text-3)', marginLeft: '.5rem' }}>
                          · {new Date(details.latestAction.actionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Rep cosponsors */}
              {details?.repCosponsors?.length > 0 && (
                <div style={{ marginBottom: '.75rem' }}>
                  <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 3 }}>Your reps who co-sponsored</p>
                  <div style={{ display: 'flex', gap: '.375rem', flexWrap: 'wrap' }}>
                    {details.repCosponsors.map(c => (
                      <span key={c.bioguideId} style={{
                        fontSize: 11, fontFamily: 'var(--font-mono)',
                        padding: '2px 8px', borderRadius: 3,
                        background: 'var(--bg-3)', color: 'var(--text-2)',
                      }}>{c.fullName} ({c.state})</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '.5rem' }}>
                {congressUrl && (
                  <a
                    href={congressUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)',
                      padding: '5px 12px', borderRadius: 'var(--radius)',
                      border: '1px solid var(--border-med)',
                      color: 'var(--text-2)', textDecoration: 'none', background: 'var(--bg-2)',
                    }}
                  >Read full text →</a>
                )}
                {isLoggedIn && ref && (
                  <button
                    onClick={handleTrack}
                    disabled={trackPending}
                    style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)',
                      padding: '5px 12px', borderRadius: 'var(--radius)',
                      border: '1px solid var(--border-med)',
                      background: isTracked ? 'var(--green-dim)' : 'var(--bg-2)',
                      color: isTracked ? 'var(--green)' : 'var(--text-2)',
                      cursor: trackPending ? 'default' : 'pointer',
                      opacity: trackPending ? 0.6 : 1,
                    }}
                  >{isTracked ? 'Tracking ✓' : 'Track this bill'}</button>
                )}
                {!isLoggedIn && ref && (
                  <Link
                    to="/?signin=1"
                    style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)',
                      padding: '5px 12px', borderRadius: 'var(--radius)',
                      border: '1px solid var(--border-med)',
                      color: 'var(--text-3)', textDecoration: 'none', background: 'var(--bg-2)',
                    }}
                  >Sign in to track</Link>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
