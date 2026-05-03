import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import BiasBar from '../components/BiasBar';
import { getPolitician, getPoliticianVotes, triggerAnalysis, getErrorMessage } from '../services/api';

const PC = { D: 'var(--party-d)', R: 'var(--party-r)', I: 'var(--party-i)' };
const PD = { D: 'var(--party-d-dim)', R: 'var(--party-r-dim)', I: 'var(--party-i-dim)' };
const PL = { D: 'Democrat', R: 'Republican', I: 'Independent' };

const voteColor = pos => pos === 'Yes' || pos === 'Yea' ? 'var(--green)' : pos === 'No' || pos === 'Nay' ? 'var(--red)' : pos === 'Not Voting' ? 'var(--text-3)' : 'var(--amber)';
const voteShort = pos => pos === 'Yes' || pos === 'Yea' ? 'YEA' : pos === 'No' || pos === 'Nay' ? 'NAY' : pos === 'Not Voting' ? 'ABS' : 'PRE';

const SUBJECTS = ['', 'Health', 'Armed Forces', 'Taxation', 'Environmental', 'Immigration', 'Crime', 'Civil Rights', 'International', 'Education', 'Finance', 'Energy'];

export default function PoliticianProfile() {
  const { id } = useParams();
  const [pol,           setPol]           = useState(null);
  const [allVotes,      setAllVotes]      = useState([]);
  const [biases,        setBiases]        = useState([]);
  const [analysis,      setAnalysis]      = useState(null);
  const [analyzing,     setAnalyzing]     = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [alignment,     setAlignment]     = useState(null);
  const [alignLoading,  setAlignLoading]  = useState(false);
  // Vote filters
  const [search,    setSearch]    = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [subFilter, setSubFilter] = useState('');
  const [votePage,  setVotePage]  = useState(0);
  const VOTES_PER_PAGE = 15;

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
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }

    // Load alignment separately so it doesn't block the page
    loadAlignment();
  }

  async function loadAlignment() {
    try {
      const stored = localStorage.getItem('votemap_user');
      if (!stored) return;
      const user = JSON.parse(stored);
      if (!user?.id) return;
      setAlignLoading(true);
	const API = (import.meta.env.VITE_API_URL || 'https://votemap-production.up.railway.app').replace(/\/api$/, '');      
	const token = localStorage.getItem('votemap_token');
      const res = await fetch(`${API}/api/politicians/${id}/alignment?userId=${user.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAlignment(data);
      }
    } catch (err) {
      console.warn('Alignment load failed:', err.message);
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

  // Filtered votes
  const filteredVotes = useMemo(() => {
    return allVotes.filter(v => {
      const title = (v.short_title || v.title || v.description || '').toLowerCase();
      const subject = (v.primary_subject || '').toLowerCase();
      if (search && !title.includes(search.toLowerCase()) && !subject.includes(search.toLowerCase())) return false;
      if (posFilter && v.position !== posFilter) return false;
      if (subFilter && !subject.includes(subFilter.toLowerCase())) return false;
      return true;
    });
  }, [allVotes, search, posFilter, subFilter]);

  const pagedVotes = filteredVotes.slice(votePage * VOTES_PER_PAGE, (votePage + 1) * VOTES_PER_PAGE);
  const totalPages = Math.ceil(filteredVotes.length / VOTES_PER_PAGE);

  function handleFilterChange(setter) {
    return (val) => { setter(val); setVotePage(0); };
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading profile…</div>;
  if (error)   return <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--red)', fontSize: 14 }}>{error} — <Link to="/">Go home</Link></div>;
  if (!pol)    return null;

  const ini = `${pol.first_name?.[0] || ''}${pol.last_name?.[0] || ''}`;
  const dw  = pol.dw_nominate;
  const dwPct = dw != null ? ((dw + 1) / 2 * 100).toFixed(1) : null;
  const dwColor = dw < -.1 ? 'var(--blue)' : dw > .1 ? 'var(--red)' : 'var(--amber)';

  const corruptionBiases = biases.filter(b => b.flag === 'corruption');
  const foreignBiases    = biases.filter(b => b.flag === 'foreign');
  const standardBiases   = biases.filter(b => !b.flag);

  // Alignment score color
  const scoreColor = alignment?.score >= 70 ? 'var(--green)' : alignment?.score >= 45 ? 'var(--amber)' : 'var(--red)';

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
      <Link to="/reps" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', marginBottom: '1.75rem', transition: 'color var(--transition)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-2)'}
      >← Back to my representatives</Link>

      {/* Profile header */}
      <header className="animate-fade-up" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', marginBottom: '2.25rem', flexWrap: 'wrap' }}>
        <div style={{
          width: 76, height: 76, borderRadius: '50%', flexShrink: 0,
          background: PD[pol.party] || 'var(--bg-3)', color: PC[pol.party] || 'var(--text-2)',
          border: `1px solid ${PC[pol.party] || 'var(--border-med)'}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700,
        }}>{ini}</div>
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

      {/* Two column — collapses to single on mobile via .profile-grid CSS class */}
      <div className="profile-grid">

        {/* LEFT: Vote history */}
        <section>
          <SectionLabel>Vote history · {allVotes.length} loaded · {filteredVotes.length} shown</SectionLabel>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>

            {/* Filters toolbar */}
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
                {SUBJECTS.map(s => <option key={s} value={s}>{s || 'All subjects'}</option>)}
              </select>
            </div>

            {/* Vote rows */}
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
                  {vote.primary_subject && (
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', display: 'block', marginTop: 3 }}>{vote.primary_subject}</span>
                  )}
                </div>
                {vote.vote_date && (
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {new Date(vote.vote_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            ))}

            {/* Pagination */}
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
        </section>

        {/* RIGHT: Analysis */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* YOUR ALIGNMENT — shown if logged in */}
          {(alignment || alignLoading) && (
            <>
              <SectionLabel>Your alignment</SectionLabel>
              <Panel title="How well do they represent you?">
                <div style={{ padding: '1.125rem 1.25rem' }}>
                  {alignLoading ? (
                    <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Calculating…</p>
                  ) : alignment?.score == null ? (
                    <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                      Complete the <Link to="/survey" style={{ color: 'var(--text-2)' }}>values survey</Link> to see your alignment score.
                    </p>
                  ) : (
                    <>
                      {/* Overall score */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                        <div style={{
                          width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                          border: `2px solid ${scoreColor}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 900,
                          color: scoreColor,
                        }}>{alignment.score}%</div>
                        <div>
                          <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 2 }}>
                            {alignment.score >= 70 ? 'Strong match' : alignment.score >= 45 ? 'Partial match' : 'Low match'}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                            Based on {alignment.issuesAnalyzed} issue{alignment.issuesAnalyzed !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {/* Per-domain breakdown */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
                        {alignment.breakdown
                          .filter(d => d.hasUserAnswer && d.agreementPct !== null)
                          .map(domain => {
                            const pct = domain.agreementPct;
                            const color = pct >= 70 ? 'var(--green)' : pct >= 45 ? 'var(--amber)' : 'var(--red)';
                            return (
                              <div key={domain.domain}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                                    {domain.icon} {domain.label}
                                  </span>
                                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color, fontWeight: 600 }}>
                                    {pct}%
                                  </span>
                                </div>
                                <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                                  <div style={{
                                    height: '100%', width: `${pct}%`,
                                    background: color,
                                    borderRadius: 2,
                                    transition: 'width 0.6s ease',
                                  }} />
                                </div>
                                <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginTop: 2 }}>
                                  {domain.voteCount} votes analyzed
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    </>
                  )}
                </div>
              </Panel>
            </>
          )}

          {/* Standard biases */}
          <SectionLabel>Voting pattern analysis</SectionLabel>
          <Panel title="Issue positions">
            <div style={{ padding: '1.125rem 1.25rem 0' }}>
              {(analysis?.overall_summary || pol.ai_analysis?.overall_summary) && (
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                  {analysis?.overall_summary || pol.ai_analysis?.overall_summary}
                </p>
              )}
              {standardBiases.length > 0
                ? standardBiases.map((b, i) => <BiasBar key={b.category} bias={b} delay={i * 0.05} />)
                : <AnalysisPrompt totalVotes={pol.total_votes} analyzing={analyzing} onRun={runAnalysis} />
              }
            </div>
          </Panel>

          {/* Corruption */}
          {corruptionBiases.length > 0 && (
            <Panel title="⚑ Lobbying & corruption indicators" titleColor="var(--gold)" headerBg="var(--gold-dim)">
              <div style={{ padding: '.875rem 1.25rem 0' }}>
                <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '.875rem', lineHeight: 1.5 }}>
                  Correlation between voting record and major industry donor positions.
                </p>
                {corruptionBiases.map((b, i) => <BiasBar key={b.category} bias={b} delay={i * 0.05} />)}
              </div>
            </Panel>
          )}

          {/* Foreign influence */}
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

          {/* Run/refresh analysis button */}
          {biases.length > 0 && (
            <button onClick={runAnalysis} disabled={analyzing} style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)',
              border: '1px solid var(--border-med)', borderRadius: 'var(--radius)',
              padding: '8px 14px', transition: 'all var(--transition)', opacity: analyzing ? .5 : 1,
              alignSelf: 'flex-start',
            }}>
              {analyzing ? '◌ Re-analyzing…' : '↺ Refresh analysis'}
            </button>
          )}

          {/* Ideology meter */}
          {dw != null && (
            <Panel title="DW-NOMINATE ideology score">
              <div style={{ padding: '1.125rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
                  <span style={{ color: 'var(--blue)' }}>← Liberal</span>
                  <span style={{ color: 'var(--text-3)' }}>Political science metric</span>
                  <span style={{ color: 'var(--red)' }}>Conservative →</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, position: 'relative', marginBottom: '.5rem' }}>
                  <div style={{ position: 'absolute', left: '50%', top: -3, width: 1, height: 10, background: 'var(--border-med)' }} />
                  <div style={{ position: 'absolute', top: '50%', left: `${dwPct}%`, transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: '50%', background: dwColor, border: '2px solid var(--bg-2)', boxShadow: 'var(--shadow)' }} />
                </div>
                <div style={{ textAlign: 'center', fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 500, color: dwColor, marginTop: '.5rem' }}>
                  {dw > 0 ? '+' : ''}{dw.toFixed(2)}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: '.625rem', lineHeight: 1.5 }}>
                  Based on lifetime voting record. −1.0 = most liberal, +1.0 = most conservative.
                </p>
              </div>
            </Panel>
          )}
        </section>
      </div>

      <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>Vote data: ProPublica · Analysis: Claude AI · Ideology: DW-NOMINATE</span>
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
