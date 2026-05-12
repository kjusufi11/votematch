import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPresident, getSurvey, getPresidentEOs, getPresidentEOCounts } from '../services/api';

const PARTY_COLOR = { D: 'var(--party-d)', R: 'var(--party-r)', I: 'var(--party-i)' };
const PARTY_DIM   = { D: 'var(--party-d-dim)', R: 'var(--party-r-dim)', I: 'var(--party-i-dim)' };
const PARTY_LABEL = { D: 'Democrat', R: 'Republican', I: 'Independent' };

const DOMAIN_LABELS = {
  healthcare: 'Healthcare', climate: 'Climate', immigration: 'Immigration',
  economy: 'Economy', defense: 'Defense', gun_policy: 'Gun Policy',
  reproductive_rights: 'Repro. Rights', education: 'Education',
  safety_net: 'Safety Net', criminal_justice: 'Criminal Justice',
  voting_rights: 'Voting Rights', infrastructure: 'Infrastructure',
};

const ISSUE_TO_DOMAIN = {
  healthcare: 'healthcare', climate: 'climate', immigration: 'immigration',
  taxes: 'economy', economy: 'economy', defense: 'defense',
  gun_control: 'gun_policy', gun_policy: 'gun_policy', abortion: 'reproductive_rights',
  reproductive_rights: 'reproductive_rights', education: 'education',
  social_safety_net: 'safety_net', safety_net: 'safety_net',
  criminal_justice: 'criminal_justice', voting_rights: 'voting_rights',
  infrastructure: 'infrastructure',
};

function ordinalSuffix(n) {
  if (!n) return 'th';
  const v = n % 100;
  const s = ['th', 'st', 'nd', 'rd'];
  return s[(v - 20) % 10] || s[v] || s[0];
}

function fmtDate(dateStr, opts = { month: 'short', day: 'numeric' }) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', opts);
}

function isWithinDays(dateStr, days) {
  if (!dateStr) return false;
  const diff = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  return diff >= 0 && diff <= days;
}

// Normalize all action types to a shared shape
function makeEO(eo)   { return { id: `eo-${eo.id}`,    type: 'eo',     date: eo.date,   title: eo.title, domains: eo.domains || [],  url: eo.url,  summary: eo.summary, abstract: eo.abstract, eo_number: eo.eo_number }; }
function makeBill(b)  { return { id: `bill-${b.id}`,   type: 'signed', date: b.date,    title: b.title,  domains: [],                url: b.url,   number: b.number, public_law: b.public_law }; }
function makeVeto(b)  { return { id: `veto-${b.id}`,   type: 'vetoed', date: b.date,    title: b.title,  domains: [],                number: b.number }; }

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

function TypeTag({ type }) {
  const styles = {
    eo:     { bg: 'var(--bg-3)',      color: 'var(--text-3)',  label: 'EO' },
    signed: { bg: 'var(--green-dim)', color: 'var(--green)',   label: 'Signed' },
    vetoed: { bg: 'var(--red-dim)',   color: 'var(--red)',     label: 'Vetoed' },
  };
  const s = styles[type] || styles.eo;
  return (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '.06em',
      textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3,
      background: s.bg, color: s.color, whiteSpace: 'nowrap', fontWeight: 600,
    }}>{s.label}</span>
  );
}

function DomainTag({ domain }) {
  return (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '.04em',
      textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3,
      background: 'var(--bg-3)', color: 'var(--text-3)', whiteSpace: 'nowrap',
    }}>{DOMAIN_LABELS[domain] || domain}</span>
  );
}

function FeedRow({ item, expanded, onToggle, userPriorityDomains = new Set(), index = 0 }) {
  const affectsUser = userPriorityDomains.size > 0 && item.domains.some(d => userPriorityDomains.has(d));
  const canExpand   = !!(item.summary || item.abstract || item.url);

  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      animation: `fadeUp 0.2s ease ${Math.min(index * 0.02, 0.3)}s both`,
    }}>
      <button
        onClick={() => canExpand && onToggle(item.id)}
        style={{
          width: '100%', padding: '.75rem 0', display: 'flex', alignItems: 'flex-start',
          gap: '.625rem', background: 'none', border: 'none', cursor: canExpand ? 'pointer' : 'default',
          textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
          minWidth: 52, flexShrink: 0, paddingTop: 1,
        }}>
          {fmtDate(item.date)}
        </span>

        <div style={{ display: 'flex', gap: '.375rem', alignItems: 'flex-start', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          <TypeTag type={item.type} />
          {affectsUser && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '.06em',
              textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3,
              background: 'var(--green-dim)', color: 'var(--green)', fontWeight: 600, whiteSpace: 'nowrap',
            }}>Your issue</span>
          )}
          {item.domains.slice(0, 2).map(d => <DomainTag key={d} domain={d} />)}
          {item.eo_number && (
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
              EO {item.eo_number}
            </span>
          )}
          {item.number && !item.eo_number && (
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
              {item.number}
            </span>
          )}
          <span style={{
            fontSize: 13, color: 'var(--text)', lineHeight: 1.4,
            width: '100%', marginTop: item.type !== 'eo' || item.domains.length === 0 ? 0 : 2,
          }}>
            {item.title}
          </span>
        </div>

        {canExpand && (
          <span style={{
            fontSize: 10, color: 'var(--text-3)', flexShrink: 0, paddingTop: 2,
            transition: 'transform var(--transition)',
            transform: expanded ? 'rotate(180deg)' : 'none',
            display: 'inline-block',
          }}>▼</span>
        )}
      </button>

      {expanded && (
        <div style={{
          paddingLeft: 'calc(52px + .625rem)', paddingBottom: '1rem',
          animation: 'fadeUp 0.15s ease both',
        }}>
          {(item.summary || item.abstract) && (
            <p style={{
              fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6,
              margin: '0 0 .5rem', maxWidth: 580,
            }}>
              {item.summary || item.abstract?.slice(0, 300)}
              {!item.summary && item.abstract?.length > 300 ? '…' : ''}
            </p>
          )}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', textDecoration: 'none' }}>
              Read full text →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function FeedSkeleton({ rows = 5 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ borderBottom: '1px solid var(--border)', padding: '.75rem 0', display: 'flex', gap: '.625rem', alignItems: 'flex-start' }}>
          <div style={{ width: 52, height: 13, background: 'var(--bg-3)', borderRadius: 3, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ height: 16, width: 36, background: 'var(--bg-3)', borderRadius: 3 }} />
              <div style={{ height: 16, width: 60, background: 'var(--bg-3)', borderRadius: 3 }} />
            </div>
            <div style={{ height: 13, width: '75%', background: 'var(--bg-3)', borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function getRepPolIds() {
  try {
    const raw = sessionStorage.getItem('votemap_lookup') || localStorage.getItem('votemap_lookup');
    if (!raw) return [];
    return (JSON.parse(raw).representatives || []).filter(r => r.level === 'federal' && r.id).map(r => r.id);
  } catch { return []; }
}

export default function PresidentPage() {
  const { user, isLoggedIn } = useAuth();

  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [imgError, setImgError] = useState(false);

  const [initialEOs, setInitialEOs]   = useState([]);
  const [eoCounts, setEoCounts]       = useState(null);
  const [eoInitLoading, setEoInitLoading] = useState(true);

  const [userPriorityDomains, setUserPriorityDomains] = useState(new Set());
  const [surveyLoaded, setSurveyLoaded] = useState(false);

  const [historyOpen, setHistoryOpen]         = useState(false);
  const [historySearch, setHistorySearch]     = useState('');
  const [historyFilter, setHistoryFilter]     = useState(null);
  const [historyEOs, setHistoryEOs]           = useState([]);
  const [historyTotal, setHistoryTotal]       = useState(0);
  const [historyOffset, setHistoryOffset]     = useState(0);
  const [historyHasMore, setHistoryHasMore]   = useState(false);
  const [historyLoading, setHistoryLoading]   = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);

  const [expandedId, setExpandedId] = useState(null);
  const EO_PAGE_SIZE = 20;

  useEffect(() => {
    const polIds = getRepPolIds();
    setLoading(true);
    Promise.all([
      getPresident(polIds),
      getPresidentEOCounts(),
      getPresidentEOs({ limit: 30 }),
    ]).then(([presData, counts, eoData]) => {
      setData(presData);
      setEoCounts(counts);
      setInitialEOs(eoData.orders || []);
    }).catch(err => setError(err?.response?.data?.error || err.message || 'Failed to load.'))
      .finally(() => { setLoading(false); setEoInitLoading(false); });
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !user?.id) { setSurveyLoaded(true); return; }
    getSurvey(String(user.id)).then(survey => {
      if (!survey?.answers) return;
      const domains = new Set();
      for (const issue of Object.keys(survey.answers)) {
        if (ISSUE_TO_DOMAIN[issue]) domains.add(ISSUE_TO_DOMAIN[issue]);
      }
      setUserPriorityDomains(domains);
    }).catch(() => {}).finally(() => setSurveyLoaded(true));
  }, [user, isLoggedIn]);

  // Load history EOs when history expands or filter changes
  useEffect(() => {
    if (!historyOpen) return;
    const delay = historySearch ? 350 : 0;
    const timer = setTimeout(() => {
      setHistoryLoading(true);
      setHistoryEOs([]); setHistoryOffset(0);
      getPresidentEOs({ domain: historyFilter || undefined, q: historySearch.trim() || undefined, limit: EO_PAGE_SIZE })
        .then(d => {
          setHistoryEOs(d.orders || []);
          setHistoryTotal(d.total || 0);
          setHistoryHasMore(d.hasMore || false);
          setHistoryOffset(EO_PAGE_SIZE);
        }).catch(() => {}).finally(() => setHistoryLoading(false));
    }, delay);
    return () => clearTimeout(timer);
  }, [historyOpen, historyFilter, historySearch]);

  const { president, stats, enactedBills = [], vetoedBills = [] } = data || {};

  const thisWeekItems = useMemo(() => {
    const items = [
      ...initialEOs.filter(eo => isWithinDays(eo.date, 7)).map(makeEO),
      ...enactedBills.filter(b => isWithinDays(b.date, 7)).map(makeBill),
      ...vetoedBills.filter(b => isWithinDays(b.date, 7)).map(makeVeto),
    ];
    return items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [initialEOs, enactedBills, vetoedBills]);

  const recentItems = useMemo(() => {
    if (thisWeekItems.length > 0) return thisWeekItems;
    const all = [
      ...initialEOs.slice(0, 8).map(makeEO),
      ...enactedBills.slice(0, 3).map(makeBill),
      ...vetoedBills.slice(0, 2).map(makeVeto),
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return all.slice(0, 8);
  }, [thisWeekItems, initialEOs, enactedBills, vetoedBills]);

  const personalizedItems = useMemo(() =>
    recentItems.filter(item => item.domains.some(d => userPriorityDomains.has(d))),
    [recentItems, userPriorityDomains]
  );

  const historyItems = useMemo(() => {
    if (!historyOpen) return [];
    const searching = historyFilter || historySearch.trim();
    const bills  = searching ? [] : enactedBills.map(makeBill);
    const vetoes = searching ? [] : vetoedBills.map(makeVeto);
    return [...bills, ...vetoes, ...historyEOs.map(makeEO)]
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [historyOpen, historyEOs, enactedBills, vetoedBills, historyFilter, historySearch]);

  const activeDomains = useMemo(() =>
    eoCounts?.counts ? Object.entries(eoCounts.counts).sort((a, b) => b[1] - a[1]).map(([d]) => d) : [],
    [eoCounts]
  );

  async function loadMoreHistory() {
    setHistoryLoadingMore(true);
    try {
      const d = await getPresidentEOs({
        domain: historyFilter || undefined,
        q: historySearch.trim() || undefined,
        offset: historyOffset, limit: EO_PAGE_SIZE,
      });
      setHistoryEOs(prev => [...prev, ...(d.orders || [])]);
      setHistoryHasMore(d.hasMore || false);
      setHistoryOffset(prev => prev + EO_PAGE_SIZE);
    } catch {}
    setHistoryLoadingMore(false);
  }

  function toggleExpand(id) { setExpandedId(prev => prev === id ? null : id); }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading…</div>
  );
  if (error) return (
    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--red)', fontSize: 14 }}>{error}</div>
  );

  const hasThisWeek = thisWeekItems.length > 0;

  return (
    <main style={{ maxWidth: 780, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>

      {/* ── HERO ── */}
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', marginBottom: '3rem', flexWrap: 'wrap' }}>
        {!imgError && president?.photo_url && (
          <img src={president.photo_url} alt={president.name} onError={() => setImgError(true)}
            style={{ width: 76, height: 92, objectFit: 'cover', objectPosition: 'top',
              borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.4rem', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '.1em',
              textTransform: 'uppercase', padding: '2px 8px', borderRadius: 3,
              background: PARTY_DIM[president?.party] || 'var(--bg-3)',
              color: PARTY_COLOR[president?.party] || 'var(--text-2)',
            }}>{PARTY_LABEL[president?.party] || president?.party}</span>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
              {president?.term_number}{ordinalSuffix(president?.term_number)} President · {stats?.daysInOffice} days in office
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
            fontWeight: 900, letterSpacing: '-.022em', lineHeight: 1.06, marginBottom: '.3rem',
          }}>{president?.name}</h1>

          <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', margin: '0 0 1rem' }}>
            {president?.title} · Since {president?.term_start
              ? new Date(president.term_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              : ''}
          </p>

          <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-.02em', marginRight: 4 }}>
                {stats?.eoCount ?? '—'}
              </span>executive orders
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-.02em', marginRight: 4 }}>
                {stats?.enactedCount ?? '—'}
              </span>laws signed
            </span>
          </div>
        </div>
      </div>

      {/* ── THIS WEEK / MOST RECENT ── */}
      <div style={{ marginBottom: '2.5rem' }}>
        <SectionLabel>{hasThisWeek ? 'This week' : 'Most recent'}</SectionLabel>
        {eoInitLoading ? (
          <FeedSkeleton rows={5} />
        ) : recentItems.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', padding: '1rem 0' }}>
            No recent actions found.
          </p>
        ) : (
          <div>
            {recentItems.map((item, i) => (
              <FeedRow
                key={item.id} item={item} index={i}
                expanded={expandedId === item.id}
                onToggle={toggleExpand}
                userPriorityDomains={userPriorityDomains}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── WHAT THIS MEANS FOR YOU ── */}
      {isLoggedIn && surveyLoaded && userPriorityDomains.size > 0 && (
        <div style={{
          marginBottom: '2.5rem', padding: '1.25rem 1.25rem',
          background: personalizedItems.length > 0 ? 'var(--green-dim)' : 'var(--bg-2)',
          border: `1px solid ${personalizedItems.length > 0 ? 'var(--green)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-lg)',
        }}>
          <p style={{
            fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '.08em',
            textTransform: 'uppercase', color: personalizedItems.length > 0 ? 'var(--green)' : 'var(--text-3)',
            marginBottom: '.5rem',
          }}>What this means for you</p>
          {personalizedItems.length > 0 ? (
            <>
              <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55, marginBottom: '.875rem' }}>
                {personalizedItems.length} recent action{personalizedItems.length > 1 ? 's' : ''} touch{personalizedItems.length === 1 ? 'es' : ''} your priority issues
                {' '}({[...new Set(personalizedItems.flatMap(i => i.domains).filter(d => userPriorityDomains.has(d)))].map(d => DOMAIN_LABELS[d]).join(', ')}).
              </p>
              <div style={{ borderTop: `1px solid var(--green)`, paddingTop: '.75rem' }}>
                {personalizedItems.slice(0, 4).map((item, i) => (
                  <FeedRow
                    key={item.id} item={item} index={i}
                    expanded={expandedId === item.id}
                    onToggle={toggleExpand}
                    userPriorityDomains={userPriorityDomains}
                  />
                ))}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
              No actions from the past 7 days directly affect your priority issues.
              Check the full history below for recent related actions.
            </p>
          )}
        </div>
      )}

      {isLoggedIn && surveyLoaded && userPriorityDomains.size === 0 && (
        <div style={{
          marginBottom: '2.5rem', padding: '1rem 1.25rem',
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between', flexWrap: 'wrap',
        }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
            Take the survey to see which actions affect your priority issues.
          </p>
          <a href="/survey" style={{
            fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text)',
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}>Take survey →</a>
        </div>
      )}

      {/* ── FULL HISTORY ── */}
      <div style={{ marginBottom: '3rem' }}>
        <button
          onClick={() => setHistoryOpen(x => !x)}
          style={{
            width: '100%', padding: '1rem 1.25rem',
            background: 'var(--bg-2)', border: '1px solid var(--border-med)',
            borderRadius: historyOpen ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)',
            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            boxShadow: 'var(--shadow)', transition: 'all var(--transition)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            Full history — executive orders, laws &amp; vetoes
          </span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{eoCounts?.total ?? stats?.eoCount ?? '…'} EOs total</span>
            <span style={{ transition: 'transform var(--transition)', transform: historyOpen ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>▼</span>
          </span>
        </button>

        {historyOpen && (
          <div style={{
            border: '1px solid var(--border-med)', borderTop: 'none',
            borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
            background: 'var(--bg-2)', padding: '1rem 1.25rem',
            boxShadow: 'var(--shadow)',
          }}>
            {/* Search + filter */}
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Search executive orders…"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', fontSize: 12, fontFamily: 'var(--font-mono)',
                  padding: '7px 10px', border: '1px solid var(--border-med)', borderRadius: 'var(--radius)',
                  background: 'var(--bg)', color: 'var(--text)', outline: 'none', marginBottom: '.625rem',
                }}
              />
              {activeDomains.length > 0 && (
                <div style={{ display: 'flex', gap: '.375rem', flexWrap: 'wrap' }}>
                  {activeDomains.map(d => (
                    <button key={d} onClick={() => setHistoryFilter(historyFilter === d ? null : d)} style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)', padding: '3px 9px', borderRadius: 20,
                      border: `1px solid ${historyFilter === d ? 'transparent' : 'var(--border-med)'}`,
                      background: historyFilter === d ? 'var(--text)' : 'transparent',
                      color: historyFilter === d ? 'var(--bg-2)' : 'var(--text-2)',
                      cursor: 'pointer', transition: 'all var(--transition)',
                    }}>
                      {DOMAIN_LABELS[d] || d} <span style={{ opacity: 0.55 }}>{eoCounts.counts[d]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Feed */}
            {historyLoading ? (
              <FeedSkeleton rows={6} />
            ) : historyItems.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', padding: '.5rem 0' }}>
                No results{historyFilter ? ` for ${DOMAIN_LABELS[historyFilter]}` : ''}.
              </p>
            ) : (
              <>
                {!historyFilter && !historySearch.trim() && (
                  <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '.625rem' }}>
                    Showing laws signed, vetoes, and {historyTotal} executive orders — newest first
                  </p>
                )}
                {historyItems.map((item, i) => (
                  <FeedRow
                    key={item.id} item={item} index={i}
                    expanded={expandedId === item.id}
                    onToggle={toggleExpand}
                    userPriorityDomains={userPriorityDomains}
                  />
                ))}
                {historyHasMore && (
                  <button onClick={loadMoreHistory} disabled={historyLoadingMore} style={{
                    marginTop: '.875rem', fontSize: 12, fontFamily: 'var(--font-mono)',
                    padding: '7px 16px', border: '1px solid var(--border-med)', borderRadius: 'var(--radius)',
                    background: 'transparent', color: historyLoadingMore ? 'var(--text-3)' : 'var(--text-2)',
                    cursor: historyLoadingMore ? 'default' : 'pointer', transition: 'all var(--transition)',
                  }}>
                    {historyLoadingMore ? 'Loading…' : `Load more (${historyTotal - historyEOs.length} remaining)`}
                  </button>
                )}
              </>
            )}

            <p style={{ marginTop: '1.25rem', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', borderTop: '1px solid var(--border)', paddingTop: '.75rem' }}>
              EO data: Federal Register API · Summaries: AI · Laws &amp; vetoes: Congress.gov
            </p>
          </div>
        )}
      </div>

    </main>
  );
}
