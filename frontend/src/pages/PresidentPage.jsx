import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPresident, getSurvey } from '../services/api';

const PARTY_COLOR = { D: 'var(--party-d)', R: 'var(--party-r)', I: 'var(--party-i)' };
const PARTY_DIM   = { D: 'var(--party-d-dim)', R: 'var(--party-r-dim)', I: 'var(--party-i-dim)' };
const PARTY_LABEL = { D: 'Democrat', R: 'Republican', I: 'Independent' };

const VOTE_COLOR = { Yes: 'var(--green)', No: 'var(--red)' };
const VOTE_BG    = { Yes: 'var(--green-dim)', No: 'var(--red-dim)' };

const DOMAIN_LABELS = {
  healthcare:          'Healthcare',
  climate:             'Climate',
  immigration:         'Immigration',
  economy:             'Economy',
  defense:             'Defense',
  gun_policy:          'Gun Policy',
  reproductive_rights: 'Repro. Rights',
  education:           'Education',
  safety_net:          'Safety Net',
  criminal_justice:    'Criminal Justice',
  voting_rights:       'Voting Rights',
  infrastructure:      'Infrastructure',
};

// Survey issue keys → EO domain keys
const ISSUE_TO_DOMAIN = {
  healthcare:          'healthcare',
  climate:             'climate',
  immigration:         'immigration',
  taxes:               'economy',
  economy:             'economy',
  defense:             'defense',
  gun_control:         'gun_policy',
  abortion:            'reproductive_rights',
  education:           'education',
  social_safety_net:   'safety_net',
  criminal_justice:    'criminal_justice',
  voting_rights:       'voting_rights',
  infrastructure:      'infrastructure',
};

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

function DomainBadge({ domain }) {
  return (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '.06em',
      textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3,
      background: 'var(--bg-3)', color: 'var(--text-3)', whiteSpace: 'nowrap',
    }}>{DOMAIN_LABELS[domain] || domain}</span>
  );
}

function PriorityBadge() {
  return (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '.06em',
      textTransform: 'uppercase', padding: '2px 7px', borderRadius: 3,
      background: 'var(--green-dim)', color: 'var(--green)', whiteSpace: 'nowrap',
      fontWeight: 600,
    }}>Affects your priorities</span>
  );
}

function EOCard({ eo, index, userPriorityDomains, viewMode }) {
  const dateStr = eo.date
    ? new Date(eo.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const affectsUser = userPriorityDomains.size > 0 && (eo.domains || []).some(d => userPriorityDomains.has(d));

  if (viewMode === 'timeline') {
    return (
      <div style={{
        display: 'flex', gap: '1rem', alignItems: 'flex-start',
        animation: `fadeUp 0.3s ease ${Math.min(index * 0.03, 0.4)}s both`,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border-med)', flexShrink: 0 }} />
          <div style={{ width: 1, flex: 1, background: 'var(--border)', minHeight: 20 }} />
        </div>
        <div style={{
          flex: 1, paddingBottom: '1.25rem',
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem',
          boxShadow: 'var(--shadow)',
        }}>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
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
            {affectsUser && <PriorityBadge />}
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, margin: '0 0 4px' }}>
            {eo.title}
          </p>
          {eo.summary && (
            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, margin: '0 0 6px' }}>{eo.summary}</p>
          )}
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {(eo.domains || []).slice(0, 3).map(d => <DomainBadge key={d} domain={d} />)}
            <a href={eo.url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', textDecoration: 'none', marginLeft: 'auto' }}>
              Read →
            </a>
          </div>
        </div>
      </div>
    );
  }

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
          {affectsUser && <PriorityBadge />}
        </div>
      </div>

      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, marginBottom: '.5rem' }}>
        {eo.title}
      </p>

      {eo.summary && (
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: '.5rem' }}>
          {eo.summary}
        </p>
      )}
      {!eo.summary && eo.abstract && (
        <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: '.5rem', fontStyle: 'italic' }}>
          {eo.abstract.slice(0, 200)}{eo.abstract.length > 200 ? '…' : ''}
        </p>
      )}

      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '.625rem' }}>
        {(eo.domains || []).slice(0, 3).map(d => <DomainBadge key={d} domain={d} />)}
      </div>

      <a
        href={eo.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', textDecoration: 'none' }}
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

function BillRow({ bill, last }) {
  const dateStr = bill.date
    ? new Date(bill.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  return (
    <div style={{
      padding: '10px 1.25rem',
      borderBottom: last ? 'none' : '1px solid var(--border)',
      display: 'flex', alignItems: 'flex-start', gap: '.875rem',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
          {bill.public_law && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '.06em',
              textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3,
              background: 'var(--green-dim)', color: 'var(--green)',
            }}>P.L. {bill.public_law}</span>
          )}
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            {bill.number}
          </span>
          {dateStr && (
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{dateStr}</span>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>
          {bill.title}
        </p>
      </div>
      <a
        href={bill.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)',
          textDecoration: 'none', flexShrink: 0, alignSelf: 'center',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-2)'}
      >View →</a>
    </div>
  );
}

function VetoRow({ bill, last }) {
  const dateStr = bill.date
    ? new Date(bill.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  return (
    <div style={{
      padding: '10px 1.25rem',
      borderBottom: last ? 'none' : '1px solid var(--border)',
      display: 'flex', alignItems: 'flex-start', gap: '.875rem',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '.06em',
            textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3,
            background: 'var(--red-dim)', color: 'var(--red)',
          }}>Vetoed</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{bill.number}</span>
          {dateStr && (
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{dateStr}</span>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>{bill.title}</p>
      </div>
    </div>
  );
}

function NominationRow({ nom, last }) {
  const dateStr = nom.date
    ? new Date(nom.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  return (
    <div style={{
      padding: '10px 1.25rem',
      borderBottom: last ? 'none' : '1px solid var(--border)',
      display: 'flex', alignItems: 'flex-start', gap: '.875rem',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '.06em',
            textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3,
            background: nom.confirmed ? 'var(--green-dim)' : 'var(--bg-3)',
            color: nom.confirmed ? 'var(--green)' : 'var(--text-3)',
          }}>{nom.confirmed ? 'Confirmed' : 'Withdrawn'}</span>
          {dateStr && (
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{dateStr}</span>
          )}
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, margin: '0 0 2px' }}>
          {nom.name}
        </p>
        {nom.position && (
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.4, margin: 0 }}>{nom.position}</p>
        )}
      </div>
    </div>
  );
}

export default function PresidentPage() {
  const { user } = useAuth();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [imgError, setImgError]   = useState(false);
  const [search, setSearch]       = useState('');
  const [activeFilter, setActiveFilter] = useState(null);
  const [viewMode, setViewMode]   = useState('cards'); // 'cards' | 'timeline'
  const [userPriorities, setUserPriorities] = useState(null);

  useEffect(() => {
    const polIds = getRepPolIds();
    setLoading(true);
    getPresident(polIds)
      .then(setData)
      .catch(err => setError(err?.response?.data?.error || err.message || 'Failed to load.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    getSurvey(String(user.id)).then(survey => {
      if (!survey?.answers) return;
      const domains = new Set();
      for (const [issue, val] of Object.entries(survey.answers)) {
        if ((val?.importance || 0) >= 2 && ISSUE_TO_DOMAIN[issue]) {
          domains.add(ISSUE_TO_DOMAIN[issue]);
        }
      }
      setUserPriorities(domains);
    }).catch(() => {});
  }, [user]);

  const { president, stats, executiveOrders = [], enactedBills = [], vetoedBills = [], nominations = [], repVotes = [] } = data || {};

  // Domain counts for filter pills
  const domainCounts = useMemo(() => {
    const counts = {};
    for (const eo of executiveOrders) {
      for (const d of (eo.domains || [])) {
        counts[d] = (counts[d] || 0) + 1;
      }
    }
    return counts;
  }, [executiveOrders]);

  const activeDomains = useMemo(() =>
    Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([d]) => d),
    [domainCounts]
  );

  const filteredOrders = useMemo(() => {
    let orders = executiveOrders;
    if (activeFilter) orders = orders.filter(eo => (eo.domains || []).includes(activeFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      orders = orders.filter(eo =>
        eo.title?.toLowerCase().includes(q) ||
        eo.summary?.toLowerCase().includes(q) ||
        eo.abstract?.toLowerCase().includes(q)
      );
    }
    return orders;
  }, [executiveOrders, activeFilter, search]);

  const userPriorityDomains = userPriorities || new Set();

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      Loading…
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--red)', fontSize: 14 }}>{error}</div>
  );

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
        <StatCard value={stats?.enactedCount ?? '—'} label="Bills signed into law" />
        <StatCard value={stats?.daysInOffice ?? '—'} label="Days in office" />
      </div>

      {/* ── Executive orders ── */}
      <div style={{ marginBottom: '3rem' }}>
        <SectionLabel>Executive orders · most recent {executiveOrders.length}</SectionLabel>

        {/* Search + view toggle */}
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search orders…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: '1 1 200px', minWidth: 0,
              fontSize: 12, fontFamily: 'var(--font-mono)',
              padding: '6px 10px',
              border: '1px solid var(--border-med)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg-2)',
              color: 'var(--text)',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', border: '1px solid var(--border-med)', borderRadius: 'var(--radius)', overflow: 'hidden', flexShrink: 0 }}>
            {['cards', 'timeline'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  padding: '5px 12px',
                  border: 'none',
                  background: viewMode === mode ? 'var(--text)' : 'var(--bg-2)',
                  color: viewMode === mode ? 'var(--bg-2)' : 'var(--text-2)',
                  cursor: 'pointer',
                  borderRight: mode === 'cards' ? '1px solid var(--border-med)' : 'none',
                }}
              >{mode}</button>
            ))}
          </div>
        </div>

        {/* Domain filter pills */}
        {activeDomains.length > 0 && (
          <div style={{ display: 'flex', gap: '.375rem', flexWrap: 'wrap', marginBottom: '.875rem' }}>
            <button
              onClick={() => setActiveFilter(null)}
              style={{
                fontSize: 11, fontFamily: 'var(--font-mono)',
                padding: '4px 10px', borderRadius: 20,
                border: '1px solid var(--border-med)',
                background: !activeFilter ? 'var(--text)' : 'var(--bg-2)',
                color: !activeFilter ? 'var(--bg-2)' : 'var(--text-2)',
                cursor: 'pointer',
              }}
            >All</button>
            {activeDomains.map(d => (
              <button
                key={d}
                onClick={() => setActiveFilter(activeFilter === d ? null : d)}
                style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  padding: '4px 10px', borderRadius: 20,
                  border: '1px solid var(--border-med)',
                  background: activeFilter === d ? 'var(--text)' : 'var(--bg-2)',
                  color: activeFilter === d ? 'var(--bg-2)' : 'var(--text-2)',
                  cursor: 'pointer',
                }}
              >
                {DOMAIN_LABELS[d] || d}{' '}
                <span style={{ opacity: 0.6 }}>{domainCounts[d]}</span>
              </button>
            ))}
          </div>
        )}

        {filteredOrders.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            No executive orders match.
          </p>
        ) : viewMode === 'timeline' ? (
          <div style={{ paddingLeft: '.25rem' }}>
            {filteredOrders.map((eo, i) => (
              <EOCard key={eo.id} eo={eo} index={i} userPriorityDomains={userPriorityDomains} viewMode="timeline" />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '.75rem' }}>
            {filteredOrders.map((eo, i) => (
              <EOCard key={eo.id} eo={eo} index={i} userPriorityDomains={userPriorityDomains} viewMode="cards" />
            ))}
          </div>
        )}

        <p style={{ marginTop: '1rem', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          Source: Federal Register (federalregister.gov) · Summaries generated by AI
        </p>
      </div>

      {/* ── Bills signed into law ── */}
      {enactedBills.length > 0 && (
        <div style={{ marginBottom: '3rem' }}>
          <SectionLabel>Bills signed into law · 119th Congress ({enactedBills.length})</SectionLabel>
          <div style={{
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)',
          }}>
            {enactedBills.map((b, i) => (
              <BillRow key={b.id} bill={b} last={i === enactedBills.length - 1} />
            ))}
          </div>
        </div>
      )}

      {/* ── Vetoes ── */}
      {vetoedBills.length > 0 && (
        <div style={{ marginBottom: '3rem' }}>
          <SectionLabel>Vetoed bills · 119th Congress ({vetoedBills.length})</SectionLabel>
          <div style={{
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)',
          }}>
            {vetoedBills.map((b, i) => (
              <VetoRow key={b.id} bill={b} last={i === vetoedBills.length - 1} />
            ))}
          </div>
        </div>
      )}

      {/* ── Cabinet & Appointments ── */}
      {nominations.length > 0 && (
        <div style={{ marginBottom: '3rem' }}>
          <SectionLabel>Cabinet & appointments · 119th Congress ({nominations.length})</SectionLabel>
          <div style={{
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)',
          }}>
            {nominations.map((n, i) => (
              <NominationRow key={n.id || i} nom={n} last={i === nominations.length - 1} />
            ))}
          </div>
        </div>
      )}

      {/* ── Rep votes ── */}
      <div style={{ marginBottom: '3rem' }}>
        <SectionLabel>How your representatives voted · 119th Congress</SectionLabel>
        {repVotes.length > 0 ? (
          <div style={{
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)',
          }}>
            {repVotes.map((v, i) => (
              <RepVoteRow key={v.id} vote={v} last={i === repVotes.length - 1} />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            {getRepPolIds().length === 0
              ? <>Enter your ZIP on the <a href="/" style={{ color: 'var(--text-2)' }}>home page</a> to see how your reps voted.</>
              : 'No recent votes found for your representatives.'
            }
          </p>
        )}
      </div>

      <div style={{ paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          Executive order data: Federal Register API · Vote &amp; legislation data: Congress.gov
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
