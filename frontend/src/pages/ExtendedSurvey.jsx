import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getExtendedSurvey, saveExtendedSurvey } from '../services/api';

const DOMAIN_LABELS = {
  healthcare: 'Healthcare', climate: 'Climate & Energy', immigration: 'Immigration',
  gun_policy: 'Gun Policy', taxes: 'Taxes & Spending', defense: 'Defense & Foreign Policy',
  reproductive_rights: 'Reproductive Rights', education: 'Education',
  safety_net: 'Social Safety Net', criminal_justice: 'Criminal Justice',
  voting_rights: 'Voting & Democracy', infrastructure: 'Infrastructure',
};
const DOMAIN_IDS = Object.keys(DOMAIN_LABELS);
const SECTION_TITLES = ['', 'Demographics', 'Political Engagement', 'Deal Breakers', 'Policy Depth', 'Research Consent'];

const DEMO_FIELDS = [
  { id: 'age_range', label: 'Age range', why: 'Policy priorities shift across generations — this helps reveal those patterns.', options: ['18–24', '25–34', '35–44', '45–54', '55–64', '65+'] },
  { id: 'income_range', label: 'Household income', why: 'Economic circumstances shape how policies affect people differently.', options: ['Under $30k', '$30k–$60k', '$60k–$100k', '$100k–$150k', '$150k+', 'Prefer not to say'] },
  { id: 'education', label: 'Highest education completed', why: 'Educational background correlates with many policy views in civic research.', options: ['High school or less', 'Some college', "Bachelor's degree", 'Graduate degree'] },
  { id: 'community_type', label: 'Community type', why: 'Urban, suburban, and rural communities have distinct policy needs.', options: ['Urban', 'Suburban', 'Small town', 'Rural'] },
  { id: 'employment', label: 'Employment status', why: 'Your work situation affects which economic policies feel most relevant.', options: ['Private sector', 'Public sector', 'Self-employed', 'Student', 'Retired', 'Not currently employed'] },
];

const ENGAGEMENT_QUESTIONS = [
  { id: 'voting_frequency', label: 'How often do you vote?', options: [
    { value: 'every', label: 'Every election, including primaries and local races' },
    { value: 'most', label: 'Most general elections' },
    { value: 'occasionally', label: 'Occasionally — major elections mainly' },
    { value: 'rarely', label: 'Rarely or never' },
  ]},
  { id: 'contacted_rep', label: 'Have you ever contacted or written to a representative?', options: [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ]},
  { id: 'party_id', label: 'How would you describe your political identity?', options: [
    { value: 'strong_dem', label: 'Strong Democrat' },
    { value: 'lean_dem', label: 'Lean Democrat' },
    { value: 'independent', label: 'Independent / no party' },
    { value: 'lean_rep', label: 'Lean Republican' },
    { value: 'strong_rep', label: 'Strong Republican' },
    { value: 'other', label: 'Other / third party' },
  ]},
  { id: 'cross_party', label: 'Would you vote for a candidate from the opposing party?', options: [
    { value: 'yes', label: 'Yes — I vote for the person, not the party' },
    { value: 'depends', label: 'Depends on the candidate and issues' },
    { value: 'no', label: 'No — I consistently vote for my party' },
  ]},
];

const POLICY_QUESTIONS = [
  { id: 'healthcare', label: 'Healthcare system', question: 'If you had to choose one approach to healthcare coverage, which would you prefer?', options: [
    { value: 'single_payer', label: 'Single-payer (Medicare for All)', desc: 'Government covers everyone through taxes; eliminates private insurance as primary coverage' },
    { value: 'hybrid', label: 'Public option + private market', desc: 'A government plan competes alongside private insurance — people choose their preferred option' },
    { value: 'private', label: 'Private market with safety nets', desc: 'Primarily private insurance; government assists only those who truly cannot afford it' },
  ]},
  { id: 'trade', label: 'Trade policy', question: 'What should guide US trade policy?', options: [
    { value: 'free_trade', label: 'Free trade agreements', desc: 'Open markets and low tariffs — promotes global competition and lower consumer prices' },
    { value: 'case_by_case', label: 'Strategic case-by-case deals', desc: 'Negotiate based on national interests — neither ideologically free nor protectionist' },
    { value: 'protectionist', label: 'Protective tariffs', desc: 'Higher tariffs to protect American manufacturers and bring jobs back from overseas' },
  ]},
  { id: 'immigration', label: 'Undocumented immigrants', question: 'What should happen to undocumented immigrants currently living in the US?', options: [
    { value: 'path_citizenship', label: 'Path to citizenship', desc: 'A legal process to earn legal status and eventually citizenship for those who qualify' },
    { value: 'guest_worker', label: 'Guest worker program', desc: 'Legal work authorization tied to employment, without a path to permanent residence' },
    { value: 'deportation', label: 'Enforcement and deportation', desc: 'Enforce existing immigration law and remove those without legal authorization' },
  ]},
  { id: 'defense', label: 'Defense budget', question: 'What should happen to the US military budget over the next 4 years?', options: [
    { value: 'reduce', label: 'Reduce spending', desc: 'Cut the defense budget and redirect funds to domestic priorities like healthcare and education' },
    { value: 'maintain', label: 'Maintain current levels', desc: 'Keep defense funding roughly stable, adjusting for inflation' },
    { value: 'increase', label: 'Increase significantly', desc: 'Invest more in military readiness, technology, and deterrence against adversaries' },
  ]},
  { id: 'tax', label: 'Tax structure', question: 'Which approach to taxation do you think is most fair?', options: [
    { value: 'wealth_tax', label: 'Wealth tax', desc: 'An annual tax on total accumulated wealth above a high threshold, in addition to income tax' },
    { value: 'progressive', label: 'Progressive income tax', desc: 'Higher earners pay higher rates — the current US system, adjusted and updated' },
    { value: 'flat', label: 'Flat tax', desc: 'Everyone pays the same percentage of income, regardless of earnings level' },
  ]},
];

function toggleList(arr, id) {
  return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
}

export default function ExtendedSurvey() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [section, setSection] = useState(0);
  const [demographics, setDemographics] = useState({});
  const [engagement, setEngagement] = useState({});
  const [dealBreakers, setDealBreakers] = useState({ must_oppose: [], flexible: [] });
  const [policyDepth, setPolicyDepth] = useState({});
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const d = await getExtendedSurvey(user.id);
        if (d) {
          if (d.demographics) setDemographics(d.demographics);
          if (d.engagement) setEngagement(d.engagement);
          if (d.deal_breakers) setDealBreakers(d.deal_breakers);
          if (d.policy_depth) setPolicyDepth(d.policy_depth);
          if (d.research_consent != null) setConsent(d.research_consent);
          if (d.completed_at) setSection(6);
        }
      } catch {}
      setLoading(false);
    }
    if (user) load();
  }, [user]);

  async function saveProgress(complete) {
    setSaving(true);
    try {
      await saveExtendedSurvey(user.id, {
        demographics,
        engagement,
        deal_breakers: dealBreakers,
        policy_depth: policyDepth,
        research_consent: consent,
        completed: complete,
      });
    } catch {}
    setSaving(false);
  }

  async function handleNext() {
    if (section >= 5) {
      await saveProgress(true);
      setSection(6);
    } else {
      await saveProgress(false);
      setSection(s => s + 1);
    }
  }

  function handleBack() {
    if (section === 1) {
      setSection(0);
    } else {
      setSection(s => s - 1);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  if (section === 0) {
    return (
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '4rem 1.5rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)',
            letterSpacing: '.1em', textTransform: 'uppercase',
            border: '1px solid var(--border-med)', borderRadius: 20,
            padding: '5px 16px', marginBottom: '2rem', background: 'var(--bg-2)',
          }}>
            ◎ 5 sections · ~5 minutes · All optional
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.05, marginBottom: '1.25rem',
          }}>
            Get a more accurate match score
          </h1>

          <p style={{ fontSize: 17, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '1rem' }}>
            The basic survey captures your policy positions. This extended survey adds context —
            who you are, what you care about most, and where you draw hard lines.
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.65, marginBottom: '2.5rem' }}>
            Every section is optional. Skip anything you're not comfortable with.
            Your answers improve the accuracy of your representative match scores and
            contribute to aggregate civic research.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setSection(1)} style={{
              height: 52, padding: '0 2.5rem',
              background: 'var(--text)', color: 'var(--bg-2)',
              borderRadius: 'var(--radius)', fontSize: 15, fontWeight: 500,
              cursor: 'pointer', border: 'none',
            }}>
              Start full survey →
            </button>
            <button onClick={() => navigate('/survey')} style={{
              height: 52, padding: '0 2rem',
              background: 'transparent', color: 'var(--text-2)',
              borderRadius: 'var(--radius)', fontSize: 14,
              cursor: 'pointer', border: '1px solid var(--border-med)',
            }}>
              Back to basic survey
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (section === 6) {
    return (
      <main style={{ maxWidth: 620, margin: '0 auto', padding: '5rem 1.5rem', textAlign: 'center' }}>
        <div style={{
          fontSize: 32, fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
          marginBottom: '1.5rem',
        }}>◎</div>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.75rem)',
          fontWeight: 900, letterSpacing: '-.02em', marginBottom: '1rem',
        }}>
          Full survey complete.
        </h1>

        <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '.75rem' }}>
          Your extended responses are saved. We'll use this context to sharpen your match scores
          and surface patterns that the basic survey alone can't capture.
        </p>

        {consent && (
          <p style={{
            fontSize: 13, color: 'var(--green)', lineHeight: 1.6,
            padding: '10px 16px', background: 'var(--green-dim)',
            border: '1px solid var(--green)', borderRadius: 'var(--radius)',
            display: 'inline-block', marginBottom: '1.5rem',
          }}>
            Thank you for consenting to research — your anonymized responses will contribute to aggregate civic data.
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
          <button onClick={() => navigate('/reps')} style={{
            height: 46, padding: '0 1.75rem', background: 'var(--text)', color: 'var(--bg-2)',
            borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none',
          }}>
            See my representatives →
          </button>
          <button onClick={() => setSection(1)} style={{
            height: 46, padding: '0 1.75rem', background: 'transparent', color: 'var(--text-2)',
            borderRadius: 'var(--radius)', fontSize: 14, cursor: 'pointer', border: '1px solid var(--border-med)',
          }}>
            Update my answers
          </button>
        </div>
      </main>
    );
  }

  const progressPct = ((section - 1) / 5) * 100;

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '3rem 1.5rem 6rem' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            Section {section} of 5
          </span>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            {SECTION_TITLES[section]}
          </span>
        </div>
        <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 2 }}>
          <div style={{
            height: '100%', width: `${progressPct}%`,
            background: 'var(--red)', borderRadius: 2,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {section === 1 && <SectionDemographics demographics={demographics} setDemographics={setDemographics} />}
      {section === 2 && <SectionEngagement engagement={engagement} setEngagement={setEngagement} />}
      {section === 3 && <SectionDealBreakers dealBreakers={dealBreakers} setDealBreakers={setDealBreakers} />}
      {section === 4 && <SectionPolicyDepth policyDepth={policyDepth} setPolicyDepth={setPolicyDepth} />}
      {section === 5 && <SectionConsent consent={consent} setConsent={setConsent} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3rem' }}>
        <button onClick={handleBack} style={{
          fontSize: 13, fontFamily: 'var(--font-mono)', cursor: 'pointer',
          color: 'var(--text-2)',
          border: '1px solid var(--border-med)', borderRadius: 'var(--radius)',
          padding: '8px 16px', background: 'transparent',
        }}>
          ← Back
        </button>

        <button onClick={handleNext} disabled={saving} style={{
          fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer',
          color: 'var(--bg-2)', background: 'var(--text)',
          border: 'none', borderRadius: 'var(--radius)',
          padding: '10px 24px', transition: 'all var(--transition)',
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving…' : section === 5 ? 'Complete survey →' : 'Continue →'}
        </button>
      </div>
    </main>
  );
}

function SectionDemographics({ demographics, setDemographics }) {
  return (
    <div>
      <h2 style={{
        fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
        fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.15, marginBottom: '.75rem',
      }}>
        About you
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: '2.5rem' }}>
        All optional. We ask because policy outcomes affect different groups differently —
        this context makes aggregate research more meaningful.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {DEMO_FIELDS.map(field => (
          <div key={field.id}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              {field.label}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', lineHeight: 1.55, marginBottom: 12 }}>
              {field.why}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {field.options.map(opt => {
                const selected = demographics[field.id] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setDemographics(prev => ({
                      ...prev,
                      [field.id]: prev[field.id] === opt ? null : opt,
                    }))}
                    style={{
                      padding: '6px 16px', fontSize: 13, cursor: 'pointer',
                      borderRadius: 20, border: `1px solid ${selected ? 'var(--text)' : 'var(--border-med)'}`,
                      background: selected ? 'var(--text)' : 'var(--bg-2)',
                      color: selected ? 'var(--bg-2)' : 'var(--text-2)',
                      transition: 'all var(--transition)',
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionEngagement({ engagement, setEngagement }) {
  return (
    <div>
      <h2 style={{
        fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
        fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.15, marginBottom: '2.5rem',
      }}>
        Political engagement
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {ENGAGEMENT_QUESTIONS.map(q => (
          <div key={q.id}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.45, marginBottom: 12 }}>
              {q.label}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {q.options.map(opt => {
                const selected = engagement[q.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setEngagement(prev => ({ ...prev, [q.id]: opt.value }))}
                    style={{
                      padding: '1rem 1.25rem', textAlign: 'left', cursor: 'pointer',
                      background: selected ? 'var(--text)' : 'var(--bg-2)',
                      color: selected ? 'var(--bg-2)' : 'var(--text)',
                      border: `1.5px solid ${selected ? 'var(--text)' : 'var(--border-med)'}`,
                      borderRadius: 'var(--radius-lg)', fontSize: 14, lineHeight: 1.55,
                      transition: 'all var(--transition)', boxShadow: selected ? 'none' : 'var(--shadow)',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionDealBreakers({ dealBreakers, setDealBreakers }) {
  function toggleOppose(id) {
    setDealBreakers(prev => ({ ...prev, must_oppose: toggleList(prev.must_oppose, id) }));
  }
  function toggleFlexible(id) {
    setDealBreakers(prev => ({ ...prev, flexible: toggleList(prev.flexible, id) }));
  }

  return (
    <div>
      <h2 style={{
        fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
        fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.15, marginBottom: '2.5rem',
      }}>
        Deal breakers & compromises
      </h2>

      <div style={{ marginBottom: '2.5rem' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
          I would vote against an incumbent regardless of party if they were on the wrong side of…
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14, lineHeight: 1.5 }}>
          Select all that apply.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DOMAIN_IDS.map(id => {
            const selected = dealBreakers.must_oppose.includes(id);
            return (
              <button
                key={id}
                onClick={() => toggleOppose(id)}
                style={{
                  padding: '6px 16px', fontSize: 13, cursor: 'pointer',
                  borderRadius: 20,
                  border: `1px solid ${selected ? 'var(--red)' : 'var(--border-med)'}`,
                  background: selected ? 'var(--red-dim)' : 'var(--bg-2)',
                  color: selected ? 'var(--red)' : 'var(--text-2)',
                  transition: 'all var(--transition)',
                }}
              >
                {DOMAIN_LABELS[id]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
          I'm willing to compromise on…
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14, lineHeight: 1.5 }}>
          Select all that apply.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DOMAIN_IDS.map(id => {
            const selected = dealBreakers.flexible.includes(id);
            return (
              <button
                key={id}
                onClick={() => toggleFlexible(id)}
                style={{
                  padding: '6px 16px', fontSize: 13, cursor: 'pointer',
                  borderRadius: 20,
                  border: `1px solid ${selected ? 'var(--green)' : 'var(--border-med)'}`,
                  background: selected ? 'var(--green-dim)' : 'var(--bg-2)',
                  color: selected ? 'var(--green)' : 'var(--text-2)',
                  transition: 'all var(--transition)',
                }}
              >
                {DOMAIN_LABELS[id]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SectionPolicyDepth({ policyDepth, setPolicyDepth }) {
  return (
    <div>
      <h2 style={{
        fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
        fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.15, marginBottom: '.75rem',
      }}>
        Policy preferences
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: '2.5rem' }}>
        These questions go deeper than the basic survey and improve the precision of your match scores.
        All optional.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
        {POLICY_QUESTIONS.map(q => (
          <div key={q.id}>
            <p style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
              textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 6,
            }}>
              {q.label}
            </p>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.45, marginBottom: 12 }}>
              {q.question}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {q.options.map(opt => {
                const selected = policyDepth[q.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setPolicyDepth(prev => ({ ...prev, [q.id]: opt.value }))}
                    style={{
                      padding: '1rem 1.25rem', textAlign: 'left', cursor: 'pointer',
                      background: selected ? 'var(--text)' : 'var(--bg-2)',
                      color: selected ? 'var(--bg-2)' : 'var(--text)',
                      border: `1.5px solid ${selected ? 'var(--text)' : 'var(--border-med)'}`,
                      borderRadius: 'var(--radius-lg)',
                      transition: 'all var(--transition)', boxShadow: selected ? 'none' : 'var(--shadow)',
                    }}
                  >
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: 4, lineHeight: 1.4 }}>
                      {opt.label}
                    </p>
                    <p style={{
                      fontSize: 12, margin: 0, lineHeight: 1.55,
                      color: selected ? 'rgba(255,255,255,0.7)' : 'var(--text-3)',
                    }}>
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionConsent({ consent, setConsent }) {
  return (
    <div>
      <h2 style={{
        fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
        fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.15, marginBottom: '1.5rem',
      }}>
        Research consent
      </h2>

      <ul style={{ padding: '0 0 0 1.25rem', margin: '0 0 2rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          'Your data is never sold or shared with third parties.',
          'No personally identifiable information is included in research outputs.',
          'Only aggregate statistics are published — individual responses are never surfaced.',
          'You can withdraw consent at any time by returning to this page.',
        ].map((item, i) => (
          <li key={i} style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>
            {item}
          </li>
        ))}
      </ul>

      <button
        onClick={() => setConsent(c => !c)}
        style={{
          width: '100%', padding: '1.25rem 1.5rem', textAlign: 'left',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem',
          background: consent ? 'var(--green-dim)' : 'var(--bg-2)',
          border: `1.5px solid ${consent ? 'var(--green)' : 'var(--border-med)'}`,
          borderRadius: 'var(--radius-lg)', transition: 'all var(--transition)',
          boxShadow: consent ? 'none' : 'var(--shadow)',
        }}
      >
        <span style={{
          width: 20, height: 20, borderRadius: 4, flexShrink: 0,
          border: `2px solid ${consent ? 'var(--green)' : 'var(--border-med)'}`,
          background: consent ? 'var(--green)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all var(--transition)',
        }}>
          {consent && (
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span style={{ fontSize: 14, fontWeight: 500, color: consent ? 'var(--green)' : 'var(--text)', lineHeight: 1.5 }}>
          I consent to my anonymized survey responses being used for aggregate civic research.
        </span>
      </button>

      <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.65, marginTop: '1rem' }}>
        Consent is optional. Your survey will be saved and improve your match score regardless of this choice.
      </p>
    </div>
  );
}
