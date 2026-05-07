import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import BiasBar from './BiasBar';
import Avatar from './Avatar';
import { triggerAnalysis, getAlignmentForPolitician } from '../services/api';

const partyColor = p => p === 'D' ? 'var(--party-d)' : p === 'R' ? 'var(--party-r)' : 'var(--party-i)';
const partyDim   = p => p === 'D' ? 'var(--party-d-dim)' : p === 'R' ? 'var(--party-r-dim)' : 'var(--party-i-dim)';
const partyLabel = p => p === 'D' ? 'Democrat' : p === 'R' ? 'Republican' : p === 'I' ? 'Independent' : p || '—';

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

export default function RepresentativeCard({ rep, index, alignment: alignmentProp, surveyImportance }) {
  const [analyzing,      setAnalyzing]     = useState(false);
  const [analysis,       setAnalysis]      = useState(rep.profile?.aiAnalysis || null);
  const [biases,         setBiases]        = useState(rep.profile?.biasScores || []);
  const [error,          setError]         = useState('');
  const [expanded,       setExpanded]      = useState(false);
  const [showMoreTopics, setShowMoreTopics] = useState(false);
  const [alignmentData,  setAlignmentData] = useState(alignmentProp || null);

  useEffect(() => {
    if (alignmentProp?.score != null) { setAlignmentData(alignmentProp); return; }
    const id = rep.profile?.id;
    if (!id) return;
    const stored = localStorage.getItem('votemap_user');
    if (!stored) return;
    try {
      const u = JSON.parse(stored);
      if (!u?.id) return;
      getAlignmentForPolitician(id, u.id)
        .then(data => { if (data?.score != null) setAlignmentData(data); })
        .catch(() => {});
    } catch {}
  }, [rep.profile?.id, alignmentProp?.score]);

  const profile = rep.profile;
  const party   = rep.party || profile?.party;

  async function runAnalysis() {
    if (!profile?.id) return;
    setAnalyzing(true); setError('');
    try {
      const result = await triggerAnalysis(profile.id);
      if (result.analysis) { setAnalysis(result.analysis); setBiases(result.analysis.biases || []); }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Analysis failed. Please try again.';
      setError(typeof msg === 'string' ? msg.slice(0, 120) : 'Analysis failed. Please try again.');
    } finally { setAnalyzing(false); }
  }

  const hasSurvey    = surveyImportance != null && Object.keys(surveyImportance).length > 0;
  const surveyLoaded = surveyImportance !== undefined;
  const notLoggedIn  = surveyImportance === null;
  const showSurveyCta = surveyLoaded && (notLoggedIn || !hasSurvey);

  const { importantBiases, otherBiases } = useMemo(() => {
    if (!hasSurvey || biases.length === 0) return { importantBiases: biases, otherBiases: [] };
    const important = biases.filter(b => {
      const cat = b.category.toLowerCase();
      return Object.entries(surveyImportance).some(([id, imp]) =>
        imp >= 2 && (SURVEY_BIAS_KEYWORDS[id] || []).some(kw => cat.includes(kw))
      );
    });
    if (important.length < 2) return { importantBiases: biases, otherBiases: [] };
    const impSet = new Set(important.map(b => b.category));
    return { importantBiases: important, otherBiases: biases.filter(b => !impSet.has(b.category)) };
  }, [biases, hasSurvey, surveyImportance]);

  return (
    <article style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      boxShadow: 'var(--shadow)', transition: 'box-shadow var(--transition), border-color var(--transition)',
      animation: `fadeUp 0.45s ease ${index * 0.08}s both`,
      marginBottom: '1rem',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-med)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
    >
      {/* Header */}
      <div style={{
        padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: '.875rem', alignItems: 'flex-start' }}>
          <Avatar id={profile?.id} name={rep.name} party={party} size={48} fontSize={15} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, letterSpacing: '-.01em' }}>
                {profile ? (
                  <Link to={`/politician/${profile.id}`} style={{ transition: 'color var(--transition)' }}
                    onMouseEnter={e => e.target.style.color = 'var(--red)'}
                    onMouseLeave={e => e.target.style.color = 'var(--text)'}
                  >{rep.name}</Link>
                ) : rep.name}
              </h2>
              <span style={{
                fontSize: 11, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 3,
                background: partyDim(party), color: partyColor(party),
              }}>{partyLabel(party)}</span>
              {alignmentData?.score != null && (
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', padding: '2px 10px', borderRadius: 20,
                  background: alignmentData.score >= 60 ? 'var(--green-dim)' : alignmentData.score >= 40 ? 'var(--amber-dim)' : 'var(--red-dim)',
                  color: alignmentData.score >= 60 ? 'var(--green)' : alignmentData.score >= 40 ? 'var(--amber)' : 'var(--red)',
                  fontWeight: 500,
                }}>
                  {alignmentData.score}% match
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>{rep.office}</p>
            {profile && (
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {[
                  profile.totalVotes && `${profile.totalVotes.toLocaleString()} votes`,
                  profile.partyLoyaltyPct && `${profile.partyLoyaltyPct}% party loyalty`,
                  profile.missedVotesPct && `${profile.missedVotesPct}% missed`,
                ].filter(Boolean).map((s, i) => (
                  <span key={i} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
          {rep.url && (
            <a href={rep.url} target="_blank" rel="noreferrer" style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)',
              border: '1px solid var(--border-med)', borderRadius: 'var(--radius)', padding: '5px 10px',
              transition: 'all var(--transition)',
            }}
              onMouseEnter={e => { e.target.style.background = 'var(--text)'; e.target.style.color = 'var(--bg-2)'; }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text-2)'; }}
            >Official site ↗</a>
          )}
          {profile?.id && (
            <Link to={`/politician/${profile.id}`} style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)',
              border: '1px solid var(--border-med)', borderRadius: 'var(--radius)', padding: '5px 10px',
              transition: 'all var(--transition)',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--text)'; e.currentTarget.style.color = 'var(--bg-2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}
            >Full profile →</Link>
          )}
        </div>
      </div>

      {/* Bias body */}
      <div style={{ padding: '1.25rem 1.5rem' }}>
        {showSurveyCta ? (
          <div style={{ textAlign: 'center', padding: '.75rem 0' }}>
            <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: '1rem' }}>
              {notLoggedIn
                ? 'Sign in and take the values survey to see which issues this rep votes on that matter most to you.'
                : 'Take the values survey to see this rep\'s positions on the issues that matter most to you.'}
            </p>
            <Link to="/survey" style={{
              display: 'inline-block', fontSize: 12, fontFamily: 'var(--font-mono)',
              color: 'var(--text)', border: '1px solid var(--border-med)',
              borderRadius: 'var(--radius)', padding: '7px 16px',
              transition: 'all var(--transition)',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--text)'; e.currentTarget.style.color = 'var(--bg-2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text)'; }}
            >Take the survey →</Link>
          </div>
        ) : biases.length > 0 ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                {hasSurvey ? 'Your priority issues' : 'Detected voting patterns'}
              </span>
              {hasSurvey && otherBiases.length > 0 ? (
                <button onClick={() => setShowMoreTopics(x => !x)} style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  transition: 'color var(--transition)',
                }}>
                  {showMoreTopics ? 'Show less ↑' : 'Show more topics ↓'}
                </button>
              ) : !hasSurvey ? (
                <button onClick={() => setExpanded(x => !x)} style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  transition: 'color var(--transition)',
                }}>
                  {expanded ? 'Show less ↑' : `Show all ${biases.length} ↓`}
                </button>
              ) : null}
            </div>
            {analysis?.overall_summary && (
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                {analysis.overall_summary}
              </p>
            )}
            {/* Priority or all biases */}
            {(hasSurvey ? importantBiases : (expanded ? biases : biases.slice(0, 4))).map((b, i) => (
              <BiasBar key={b.category} bias={b} delay={i * 0.04} />
            ))}
            {/* Other topics (survey mode) */}
            {hasSurvey && showMoreTopics && otherBiases.length > 0 && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.625rem' }}>
                  Other topics
                </p>
                {otherBiases.map((b, i) => <BiasBar key={b.category} bias={b} delay={i * 0.04} />)}
              </div>
            )}
            {/* Anomalies (non-survey mode, expanded) */}
            {!hasSurvey && expanded && analysis?.anomalies?.length > 0 && (
              <div style={{ marginTop: '1rem', padding: '.875rem 1rem', background: 'var(--amber-dim)', border: '1px solid rgba(181,106,0,.2)', borderRadius: 'var(--radius)' }}>
                <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--amber)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>Notable exceptions</p>
                {analysis.anomalies.map((a, i) => (
                  <p key={i} style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, paddingLeft: '.875rem', borderLeft: '2px solid var(--amber-dim)', marginBottom: 5 }}>{a}</p>
                ))}
              </div>
            )}
          </>
        ) : profile ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: '1rem' }}>
              {profile.totalVotes > 0 ? `${profile.totalVotes.toLocaleString()} votes on record — analysis not yet run.` : 'Vote data syncing…'}
            </p>
            {profile.totalVotes > 0 && (
              <button onClick={runAnalysis} disabled={analyzing} style={{
                fontSize: 12, fontFamily: 'var(--font-mono)',
                color: analyzing ? 'var(--text-3)' : 'var(--text)',
                border: '1px solid var(--border-med)', borderRadius: 'var(--radius)', padding: '8px 18px',
                transition: 'all var(--transition)',
              }}>
                {analyzing ? '◌ Analyzing with Claude…' : '◎ Run bias analysis'}
              </button>
            )}
            {error && <p style={{ marginTop: 8, fontSize: 12, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>{error}</p>}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '.75rem 0' }}>
            Vote data loading — refresh in a moment.
          </p>
        )}
      </div>
    </article>
  );
}
