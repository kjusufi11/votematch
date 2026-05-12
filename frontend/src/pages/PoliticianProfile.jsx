import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import BiasBar, { CATEGORY_LABELS } from '../components/BiasBar';
import Avatar from '../components/Avatar';
import { useAuth } from '../contexts/AuthContext';
import { getPolitician, getPoliticianVotes, triggerAnalysis, getErrorMessage, getConflicts, computeConflicts, getSurvey } from '../services/api';
import { findCandidateId, getCommitteeId, getTopEmployers } from '../services/fecClient';
import { classifyVote, getDomain } from '../utils/domainClassifier';

const SURVEY_TO_SUBJECT = {
  healthcare:          'Health',
  climate:             'Environmental',
  immigration:         'Immigration',
  gun_policy:          'Crime',
  taxes:               'Taxation',
  defense:             'Armed Forces',
  reproductive_rights: 'Civil Rights',
  education:           'Education',
  safety_net:          'Finance',
  criminal_justice:    'Crime',
};

function getTopIssueSubject(importance) {
  if (!importance) return '';
  const top = Object.entries(importance).sort((a, b) => b[1] - a[1])[0];
  return top ? (SURVEY_TO_SUBJECT[top[0]] || '') : '';
}

const SURVEY_BIAS_KEYWORDS = {
  healthcare:           ['health', 'medical', 'medicare', 'medicaid', 'pharmaceutical', 'drug'],
  climate:              ['climate', 'energy', 'environment', 'clean', 'fossil', 'carbon', 'emission'],
  immigration:          ['immigration', 'border', 'asylum', 'deportat', 'migrant'],
  gun_policy:           ['gun', 'firearm', 'weapon', 'second amendment'],
  taxes:                ['tax', 'fiscal', 'budget', 'deficit', 'spending', 'appropriat'],
  defense:              ['defense', 'military', 'foreign', 'national security', 'armed forces', 'veteran'],
  reproductive_rights:  ['reproductive', 'abortion', 'planned parenthood'],
  education:            ['education', 'school', 'student'],
  safety_net:           ['safety net', 'welfare', 'social security', 'snap', 'poverty', 'housing'],
  criminal_justice:     ['criminal', 'crime', 'justice', 'prison', 'police', 'incarcerat'],
};

const PC = { D: 'var(--party-d)', R: 'var(--party-r)', I: 'var(--party-i)' };
const PD = { D: 'var(--party-d-dim)', R: 'var(--party-r-dim)', I: 'var(--party-i-dim)' };
const PL = { D: 'Democrat', R: 'Republican', I: 'Independent' };

const voteColor = pos => pos === 'Yes' || pos === 'Yea' ? 'var(--green)' : pos === 'No' || pos === 'Nay' ? 'var(--red)' : pos === 'Not Voting' ? 'var(--text-3)' : 'var(--amber)';
const voteShort = pos => pos === 'Yes' || pos === 'Yea' ? 'YEA' : pos === 'No' || pos === 'Nay' ? 'NAY' : pos === 'Not Voting' ? 'ABS' : 'PRE';

// Domain filter options — keys match classifyVote() return values
const DOMAIN_FILTERS = [
  { value: '', label: 'All subjects' },
  { value: 'healthcare',        label: 'Healthcare' },
  { value: 'climate',           label: 'Climate & Energy' },
  { value: 'economy',           label: 'Economy & Taxes' },
  { value: 'immigration',       label: 'Immigration' },
  { value: 'gun_policy',        label: 'Gun Policy' },
  { value: 'defense',           label: 'Defense & Foreign Policy' },
  { value: 'reproductive_rights', label: 'Reproductive Rights' },
  { value: 'education',         label: 'Education' },
  { value: 'safety_net',        label: 'Social Safety Net' },
  { value: 'criminal_justice',  label: 'Criminal Justice' },
  { value: 'voting_rights',     label: 'Voting & Democracy' },
  { value: 'infrastructure',    label: 'Infrastructure' },
];

// Multiple raw categories can map to the same display label (e.g. foreign_policy +
// defense_spending both → "Defense & Foreign Policy"). Keep the one with most votes.
function dedupeByLabel(biasArr) {
  const seen = new Map();
  for (const b of biasArr) {
    const label = CATEGORY_LABELS[b.category] || b.label;
    const prev  = seen.get(label);
    if (!prev || (b.vote_count || 0) > (prev.vote_count || 0)) seen.set(label, b);
  }
  return Array.from(seen.values());
}

export default function PoliticianProfile() {
  const { id } = useParams();
  const { user: authUser, isLoggedIn } = useAuth();
  const [pol,           setPol]           = useState(null);
  const [allVotes,      setAllVotes]      = useState([]);
  const [biases,        setBiases]        = useState([]);
  const [analysis,      setAnalysis]      = useState(null);
  const [analyzing,     setAnalyzing]     = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [alignment,     setAlignment]     = useState(null);
  const [alignLoading,  setAlignLoading]  = useState(false);
  const [alignError,    setAlignError]    = useState(false);
  const [conflicts,     setConflicts]     = useState(null);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  // Vote history expand/collapse
  const [votesExpanded,      setVotesExpanded]      = useState(false);
  const [userSurvey,         setUserSurvey]         = useState(null);
  const [showAllAlignments,  setShowAllAlignments]  = useState(false);
  const [showMoreTopics,     setShowMoreTopics]     = useState(false);
  const initialFilterSet = useRef(false);
  // Vote filters
  const [search,    setSearch]    = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [subFilter, setSubFilter] = useState('');
  const [votePage,  setVotePage]  = useState(0);
  const VOTES_PER_PAGE = 50;

  useEffect(() => { loadAll(); }, [id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [polData, votesData] = await Promise.all([
        getPolitician(id),
        getPoliticianVotes(id, 0),
      ]);
      setPol(polData);
      setBiases(polData.bias_scores || []);
      // Load all pages of votes
      let votes = votesData.votes || [];
      if (votesData.pages > 1) {
        const rest = await Promise.all(
          Array.from({ length: votesData.pages - 1 }, (_, i) => getPoliticianVotes(id, i + 1))
        );
        rest.forEach(r => { votes = votes.concat(r.votes || []); });
      }
      setAllVotes(votes);

      // Fire after main data — non-blocking, polData must be in scope here
      loadAlignment();
      loadConflicts(polData);
      loadUserSurvey();
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  }

  async function loadConflicts(polData) {
    setConflictsLoading(true);
    try {
      // 1. Try the backend cache first — use if valid FEC result exists with conflicts
      const cached = await getConflicts(id);
      if (cached?.fromCache && cached?.fecCandidateId && cached?.conflicts?.length > 0) {
        setConflicts(cached);
        return;
      }

      // 2. Cache miss — fetch FEC data from the browser (api.fec.gov supports CORS)
      if (!polData?.full_name || !polData?.state || !polData?.chamber) {
        setConflicts({ conflicts: [], topDonors: [], fecError: 'Missing politician data.' });
        return;
      }
      const found = await findCandidateId(polData.full_name, polData.state, polData.chamber);
      if (!found?.candidateId) {
        setConflicts({ conflicts: [], topDonors: [], fecError: `No FEC candidate record found for ${polData.full_name}.` });
        return;
      }
      const committeeId = await getCommitteeId(found.candidateId);
      if (!committeeId) {
        setConflicts({ conflicts: [], topDonors: [], fecError: `No FEC campaign committee found (ID: ${found.candidateId}).` });
        return;
      }
      const employers = await getTopEmployers(committeeId);

      // 3. POST employer list to backend for vote cross-reference + caching
      const result = await computeConflicts(id, employers, found.candidateId);
      setConflicts(result);
    } catch (err) {
      console.warn('Conflicts load failed:', err.message);
      setConflicts({ conflicts: [], topDonors: [], fecError: err.message });
    } finally {
      setConflictsLoading(false);
    }
  }

  function retryConflicts() {
    setConflicts(null);
    loadConflicts(pol);
  }

  async function loadUserSurvey() {
    try {
      if (!authUser?.id) return;
      const data = await getSurvey(authUser.id);
      if (data?.importance) setUserSurvey(data);
    } catch {}
  }

  async function loadAlignment() {
    if (!authUser?.id) return;
    setAlignLoading(true);
    setAlignError(false);
    try {
      const API = (import.meta.env.VITE_API_URL || 'https://votemap-production.up.railway.app/api').replace(/\/api$/, '');
      const token = localStorage.getItem('votemap_token');
      const res = await fetch(`${API}/api/politicians/${id}/alignment?userId=${authUser.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAlignment(data);
      } else {
        setAlignError(true);
      }
    } catch (err) {
      console.warn('Alignment load failed:', err.message);
      setAlignError(true);
    } finally {
      setAlignLoading(false);
    }
  }

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const result = await triggerAnalysis(id);
      if (result.analysis) { setAnalysis(result.analysis); setBiases(result.analysis.biases || []); }
    } catch {}
    setAnalyzing(false);
  }

  function handleShowVotes() {
    setVotesExpanded(true);
  }

  // Filtered votes
  const filteredVotes = useMemo(() => {
    return allVotes.filter(v => {
      const title = (v.short_title || v.title || v.description || '').toLowerCase();
      if (search && !title.includes(search.toLowerCase())) return false;
      if (posFilter && v.position !== posFilter) return false;
      if (subFilter && classifyVote(v) !== subFilter) return false;
      return true;
    });
  }, [allVotes, search, posFilter, subFilter]);

  const pagedVotes = filteredVotes.slice(votePage * VOTES_PER_PAGE, (votePage + 1) * VOTES_PER_PAGE);
  const totalPages = Math.ceil(filteredVotes.length / VOTES_PER_PAGE);

  function handleFilterChange(setter) {
    return (val) => { setter(val); setVotePage(0); };
  }

  // These must be before early returns to satisfy rules of hooks
  const corruptionBiases = dedupeByLabel(biases.filter(b => b.flag === 'corruption'));
  const foreignBiases    = dedupeByLabel(biases.filter(b => b.flag === 'foreign'));
  const standardBiases   = dedupeByLabel(biases.filter(b => !b.flag));
  const hasSurvey = !!(userSurvey?.importance && Object.keys(userSurvey.importance).length > 0);
  const { importantBiases, otherBiases } = useMemo(() => {
    if (!hasSurvey || standardBiases.length === 0) return { importantBiases: standardBiases, otherBiases: [] };
    const important = standardBiases.filter(b => {
      const cat = b.category.toLowerCase();
      return Object.entries(userSurvey.importance).some(([issueId, imp]) =>
        imp >= 2 && (SURVEY_BIAS_KEYWORDS[issueId] || []).some(kw => cat.includes(kw))
      );
    });
    if (important.length < 2) return { importantBiases: standardBiases, otherBiases: [] };
    const impSet = new Set(important.map(b => b.category));
    return { importantBiases: important, otherBiases: standardBiases.filter(b => !impSet.has(b.category)) };
  }, [standardBiases, hasSurvey, userSurvey]);

  if (loading) return <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading profile…</div>;
  if (error)   return <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--red)', fontSize: 14 }}>{error} — <Link to="/">Go home</Link></div>;
  if (!pol)    return null;

  const ini = `${pol.first_name?.[0] || ''}${pol.last_name?.[0] || ''}`;
  const dw  = pol.dw_nominate;
  const dwPct = dw != null ? ((dw + 1) / 2 * 100).toFixed(1) : null;
  const dwColor = dw < -.1 ? 'var(--blue)' : dw > .1 ? 'var(--red)' : 'var(--amber)';

  // Alignment score color
  const scoreColor = alignment?.score >= 70 ? 'var(--green)' : alignment?.score >= 45 ? 'var(--amber)' : 'var(--red)';

  return (
    <main style={{ maxWidth: 740, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
      <Link to="/reps" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', marginBottom: '1.75rem', transition: 'color var(--transition)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-2)'}
      >← Back to my representatives</Link>

      {/* Profile header */}
      <header className="animate-fade-up" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', marginBottom: '2.25rem', flexWrap: 'wrap' }}>
        <Avatar id={pol.id} name={pol.full_name} party={pol.party} size={76} fontSize={26} />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.9rem, 4vw, 3.1rem)', fontWeight: 900, letterSpacing: '-.022em', lineHeight: 1.04, marginBottom: '.5rem' }}>
            {pol.full_name}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '.5rem' }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', padding: '3px 9px', borderRadius: 3, background: PD[pol.party] || 'var(--bg-3)', color: PC[pol.party] || 'var(--text-2)' }}>
              {PL[pol.party] || pol.party}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {pol.title} · {pol.state}{pol.district ? `-${pol.district}` : ''} · {pol.chamber === 'senate' ? 'U.S. Senate' : 'U.S. House'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {[
              pol.total_votes && `${pol.total_votes.toLocaleString()} total votes`,
              pol.party_loyalty_pct && `${pol.party_loyalty_pct}% party loyalty`,
              pol.missed_votes_pct && `${pol.missed_votes_pct}% missed`,
              pol.next_election && `Next election: ${pol.next_election}`,
            ].filter(Boolean).map((s, i) => (
              <span key={i} style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{s}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          {pol.url && <a href={pol.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', border: '1px solid var(--border-med)', borderRadius: 'var(--radius)', padding: '7px 14px', transition: 'all var(--transition)' }} onMouseEnter={e=>{e.target.style.background='var(--text)';e.target.style.color='var(--bg-2)'}} onMouseLeave={e=>{e.target.style.background='transparent';e.target.style.color='var(--text-2)'}}>Official site ↗</a>}
        </div>
      </header>

      {/* Single-column profile — ordered: match → conflicts → bias → votes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* 1. MATCH SCORE + TOP 3 ALIGNMENTS */}
        {isLoggedIn && (
          <section>
            <SectionLabel>Your match</SectionLabel>
            <Panel title="How well do they represent you?">
              <div style={{ padding: '1.25rem' }}>
                {alignLoading ? (
                  <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Calculating…</p>
                ) : alignError ? (
                  <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    Unable to load alignment.{' '}
                    <button onClick={loadAlignment} style={{ fontSize: 13, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Retry</button>
                  </p>
                ) : alignment?.score == null ? (
                  <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    Complete the <Link to="/survey" style={{ color: 'var(--text-2)' }}>values survey</Link> to see your alignment score.
                  </p>
                ) : (() => {
                  const validDomains = alignment.breakdown
                    .filter(d => d.hasUserAnswer && d.agreementPct !== null)
                    .sort((a, b) => {
                      const ia = userSurvey?.importance?.[a.domain] || 0;
                      const ib = userSurvey?.importance?.[b.domain] || 0;
                      return ib !== ia ? ib - ia : b.voteCount - a.voteCount;
                    });
                  const topDomains  = validDomains.slice(0, 3);
                  const restDomains = validDomains.slice(3);
                  return (
                    <>
                      {/* Score + label */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
                        <div style={{
                          width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
                          border: `3px solid ${scoreColor}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900,
                          color: scoreColor,
                        }}>{alignment.score}%</div>
                        <div>
                          <p style={{ fontSize: 17, color: 'var(--text)', fontWeight: 700, marginBottom: 4, fontFamily: 'var(--font-display)' }}>
                            {alignment.score >= 70 ? 'Strong match' : alignment.score >= 45 ? 'Partial match' : 'Low match'}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                            Based on {alignment.issuesAnalyzed} issue{alignment.issuesAnalyzed !== 1 ? 's' : ''} · weighted by your priorities
                          </p>
                        </div>
                      </div>

                      {/* Top 3 issue alignments */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                        {topDomains.map(domain => {
                          const pct   = domain.agreementPct;
                          const color = pct >= 70 ? 'var(--green)' : pct >= 45 ? 'var(--amber)' : 'var(--red)';
                          return (
                            <div key={domain.domain}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>
                                  {domain.icon} {domain.label}
                                </span>
                                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color, fontWeight: 600 }}>
                                  {pct}%
                                </span>
                              </div>
                              <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Expand to show more */}
                      {restDomains.length > 0 && (
                        <>
                          {showAllAlignments && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', marginTop: '.75rem' }}>
                              {restDomains.map(domain => {
                                const pct   = domain.agreementPct;
                                const color = pct >= 70 ? 'var(--green)' : pct >= 45 ? 'var(--amber)' : 'var(--red)';
                                return (
                                  <div key={domain.domain}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                                        {domain.icon} {domain.label}
                                      </span>
                                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color, fontWeight: 600 }}>
                                        {pct}%
                                      </span>
                                    </div>
                                    <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <button onClick={() => setShowAllAlignments(x => !x)} style={{
                            marginTop: '.875rem', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)',
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            transition: 'color var(--transition)',
                          }}>
                            {showAllAlignments ? `↑ Show top 3 only` : `↓ Show all ${validDomains.length} issues`}
                          </button>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </Panel>
          </section>
        )}

        {/* 2. CONFLICTS OF INTEREST */}
        {(conflictsLoading || conflicts !== null || corruptionBiases.length > 0) && (
          <section>
            <SectionLabel>Conflicts of interest</SectionLabel>
            {(conflictsLoading || conflicts !== null) && (
              <Panel title="⚑ Donor conflicts" titleColor="var(--gold)" headerBg="var(--gold-dim)">
                <div style={{ padding: '.875rem 1.25rem' }}>
                  {conflictsLoading ? (
                    <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Loading FEC donor data…</p>
                  ) : (
                    <>
                      <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '1rem', lineHeight: 1.55 }}>
                        Top donor industries cross-referenced with voting record. Shown when a donor sector has contributed and the politician's votes systematically favor that industry.
                      </p>
                      {conflicts.conflicts.length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontStyle: 'italic' }}>
                          {conflicts.topDonors?.length > 0
                            ? 'Donor data loaded — no voting conflicts detected above threshold with these industries.'
                            : <>{conflicts.fecError || 'FEC donor data unavailable for this politician.'}{' '}
                                <button onClick={retryConflicts} style={{ fontSize: 12, fontFamily: 'var(--font-mono)', background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Retry</button>
                              </>
                          }
                        </p>
                      ) : conflicts.conflicts.map((c, i) => {
                        const d   = getDomain(c.domain);
                        const pct = c.vote_alignment_pct;
                        const amt = c.donor_amount >= 1_000_000
                          ? `$${(c.donor_amount / 1_000_000).toFixed(1)}M`
                          : `$${(c.donor_amount / 1000).toFixed(0)}K`;
                        return (
                          <div key={i} style={{
                            paddingBottom: i < conflicts.conflicts.length - 1 ? '.875rem' : 0,
                            marginBottom:  i < conflicts.conflicts.length - 1 ? '.875rem' : 0,
                            borderBottom:  i < conflicts.conflicts.length - 1 ? '1px solid var(--border)' : 'none',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{d?.icon} {c.industry}</span>
                                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: 3, letterSpacing: '.06em', textTransform: 'uppercase', background: 'var(--gold-dim)', color: 'var(--gold)' }}>⚑ FEC</span>
                              </div>
                              <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--gold)', flexShrink: 0 }}>{pct}%</span>
                            </div>
                            <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)', borderRadius: 2, transition: 'width 0.9s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                            </div>
                            <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', lineHeight: 1.5 }}>
                              {c.industry} donated {amt} · voted against {d?.label?.toLowerCase() || c.domain} {pct}% of the time ({c.vote_count} votes)
                            </p>
                          </div>
                        );
                      })}
                      {conflicts.topDonors?.length > 0 && (
                        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                          <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: '.5rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                            Top donor employers (2022–2026)
                          </p>
                          {conflicts.topDonors.map((d, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                              <span style={{ color: 'var(--text-2)' }}>{d.employer}</span>
                              <span style={{ color: 'var(--text-3)' }}>${d.total.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Panel>
            )}
            {corruptionBiases.length > 0 && (
              <Panel title="⚑ Lobbying & industry alignment" titleColor="var(--gold)" headerBg="var(--gold-dim)">
                <div style={{ padding: '.875rem 1.25rem 0' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '.875rem', lineHeight: 1.5 }}>
                    Correlation between voting record and major industry donor positions.
                  </p>
                  {corruptionBiases.map((b, i) => <BiasBar key={b.category} bias={b} delay={i * 0.05} />)}
                </div>
              </Panel>
            )}
          </section>
        )}

        {/* 3. BIAS ANALYSIS */}
        <section>
          <SectionLabel>Bias analysis</SectionLabel>
          <Panel title={hasSurvey && importantBiases.length > 0 ? 'Your priority issues' : 'Issue positions'}>
            <div style={{ padding: '1.125rem 1.25rem 0' }}>
              {(analysis?.overall_summary || pol.ai_analysis?.overall_summary) && (
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                  {analysis?.overall_summary || pol.ai_analysis?.overall_summary}
                </p>
              )}
              {standardBiases.length > 0 ? (
                <>
                  {(hasSurvey ? importantBiases : standardBiases).map((b, i) => <BiasBar key={b.category} bias={b} delay={i * 0.05} />)}
                  {hasSurvey && otherBiases.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      {showMoreTopics && (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                          <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.625rem' }}>Other topics</p>
                          {otherBiases.map((b, i) => <BiasBar key={b.category} bias={b} delay={i * 0.04} />)}
                        </div>
                      )}
                      <button onClick={() => setShowMoreTopics(x => !x)} style={{
                        marginTop: '.75rem', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        transition: 'color var(--transition)',
                      }}>
                        {showMoreTopics ? 'Show less ↑' : 'Show more topics ↓'}
                      </button>
                    </div>
                  )}
                </>
              ) : <AnalysisPrompt totalVotes={pol.total_votes} analyzing={analyzing} onRun={runAnalysis} />}
            </div>
          </Panel>
          {foreignBiases.length > 0 && (
            <Panel title="◈ Foreign influence indicators" titleColor="var(--orange)" headerBg="var(--orange-dim)">
              <div style={{ padding: '.875rem 1.25rem 0' }}>
                <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '.875rem', lineHeight: 1.5 }}>
                  Voting alignment with positions benefiting specific foreign governments.
                </p>
                {foreignBiases.map((b, i) => <BiasBar key={b.category} bias={b} delay={i * 0.05} />)}
              </div>
            </Panel>
          )}
          {biases.length > 0 && (
            <div style={{ marginTop: '.625rem' }}>
              <button onClick={runAnalysis} disabled={analyzing} style={{
                fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)',
                border: '1px solid var(--border-med)', borderRadius: 'var(--radius)',
                padding: '7px 13px', transition: 'all var(--transition)', opacity: analyzing ? .5 : 1, cursor: 'pointer',
              }}>
                {analyzing ? '◌ Re-analyzing…' : '↺ Refresh analysis'}
              </button>
            </div>
          )}
        </section>

        {/* 4. VOTE HISTORY (collapsed by default) */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '.75rem' }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Vote history · {allVotes.length} total
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <button
              onClick={votesExpanded ? () => setVotesExpanded(false) : handleShowVotes}
              style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', background: 'none', border: '1px solid var(--border-med)', borderRadius: 'var(--radius)', padding: '4px 11px', cursor: 'pointer', transition: 'all var(--transition)', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--text)'; e.currentTarget.style.color = 'var(--bg-2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}
            >
              {votesExpanded ? 'Hide ↑' : 'Show votes ↓'}
            </button>
          </div>

          {votesExpanded && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
              <div style={{ padding: '.75rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                <input
                  placeholder="Search bills…" value={search}
                  onChange={e => handleFilterChange(setSearch)(e.target.value)}
                  style={{ flex: 1, minWidth: 140, fontSize: 12, fontFamily: 'var(--font-mono)', border: '1px solid var(--border-med)', borderRadius: 'var(--radius)', padding: '5px 10px', background: 'var(--bg-2)', outline: 'none' }}
                />
                <select value={posFilter} onChange={e => handleFilterChange(setPosFilter)(e.target.value)} style={{ fontSize: 12, fontFamily: 'var(--font-mono)', border: '1px solid var(--border-med)', borderRadius: 'var(--radius)', padding: '5px 8px', background: 'var(--bg-2)', outline: 'none', cursor: 'pointer' }}>
                  <option value="">All votes</option>
                  <option value="Yes">YEA only</option>
                  <option value="No">NAY only</option>
                  <option value="Not Voting">Abstain only</option>
                </select>
                <select value={subFilter} onChange={e => handleFilterChange(setSubFilter)(e.target.value)} style={{ fontSize: 12, fontFamily: 'var(--font-mono)', border: '1px solid var(--border-med)', borderRadius: 'var(--radius)', padding: '5px 8px', background: 'var(--bg-2)', outline: 'none', cursor: 'pointer' }}>
                  {DOMAIN_FILTERS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              {pagedVotes.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No votes match your filter.</div>
              ) : pagedVotes.map((vote, i) => (
                <div key={vote.id || i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 1.25rem',
                  borderBottom: '1px solid var(--border)', animation: `fadeIn 0.3s ease ${i * 0.02}s both`,
                }}>
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 500,
                    padding: '3px 7px', borderRadius: 3, flexShrink: 0, minWidth: 34,
                    textAlign: 'center', marginTop: 1,
                    color: voteColor(vote.position), background: `${voteColor(vote.position)}18`,
                  }}>{voteShort(vote.position)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {vote.short_title || vote.title || vote.description || vote.question}
                    </p>
                    {(() => {
                      const domainKey = classifyVote(vote);
                      const d = domainKey ? getDomain(domainKey) : null;
                      const label = d ? `${d.icon} ${d.label}` : vote.primary_subject;
                      return label ? (
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', display: 'block', marginTop: 3 }}>{label}</span>
                      ) : null;
                    })()}
                  </div>
                  {vote.vote_date && (
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {new Date(vote.vote_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.75rem 1.25rem', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <button disabled={votePage === 0} onClick={() => setVotePage(p => p - 1)} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', border: '1px solid var(--border-med)', borderRadius: 'var(--radius)', padding: '5px 11px', transition: 'all var(--transition)', opacity: votePage === 0 ? .35 : 1 }}
                    onMouseEnter={e=>{if(votePage>0){e.target.style.background='var(--text)';e.target.style.color='var(--bg-2)'}}}
                    onMouseLeave={e=>{e.target.style.background='transparent';e.target.style.color='var(--text-2)'}}
                  >← Prev</button>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                    {votePage * VOTES_PER_PAGE + 1}–{Math.min((votePage + 1) * VOTES_PER_PAGE, filteredVotes.length)} of {filteredVotes.length}
                  </span>
                  <button disabled={votePage >= totalPages - 1} onClick={() => setVotePage(p => p + 1)} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', border: '1px solid var(--border-med)', borderRadius: 'var(--radius)', padding: '5px 11px', transition: 'all var(--transition)', opacity: votePage >= totalPages - 1 ? .35 : 1 }}
                    onMouseEnter={e=>{if(votePage<totalPages-1){e.target.style.background='var(--text)';e.target.style.color='var(--bg-2)'}}}
                    onMouseLeave={e=>{e.target.style.background='transparent';e.target.style.color='var(--text-2)'}}
                  >Next →</button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Vote data: Congress.gov · Donor data: FEC · Analysis: Claude AI · Ideology: DW-NOMINATE</span>
        <Link to="/reps" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', border: '1px solid var(--border-med)', borderRadius: 'var(--radius)', padding: '5px 10px' }}>← Back</Link>
      </div>
    </main>
  );
}

function Panel({ title, titleColor, headerBg, children }) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
      <div style={{ padding: '.875rem 1.25rem', borderBottom: '1px solid var(--border)', background: headerBg || 'var(--bg)' }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: titleColor || 'var(--text-3)' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function AnalysisPrompt({ totalVotes, analyzing, onRun }) {
  return (
    <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: '1rem' }}>
        {totalVotes > 0 ? `${totalVotes.toLocaleString()} votes on record — ready for analysis.` : 'Vote data syncing…'}
      </p>
      {totalVotes > 0 && (
        <button onClick={onRun} disabled={analyzing} style={{
          fontSize: 13, fontFamily: 'var(--font-mono)', color: analyzing ? 'var(--text-3)' : 'var(--text)',
          border: '1px solid var(--border-med)', borderRadius: 'var(--radius)', padding: '10px 20px',
          transition: 'all var(--transition)', opacity: analyzing ? .6 : 1,
        }}>
          {analyzing ? '◌ Analyzing with Claude…' : '◎ Run bias analysis'}
        </button>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '.75rem' }}>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}
