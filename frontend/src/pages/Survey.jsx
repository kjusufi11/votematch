import { useAuth } from '../contexts/AuthContext';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveSurvey, getSurvey } from '../services/api';

const ISSUES = [
  {
    id: 'healthcare',
    label: 'Healthcare',
    question: 'How should Americans get healthcare coverage?',
    options: [
      { value: -2, label: 'The government should guarantee coverage for every American, funded through taxes' },
      { value: -1, label: 'People should be able to choose between a government plan and private insurance' },
      { value: 1,  label: 'Private insurance should be the main option, with government help for those who truly cannot afford it' },
      { value: 2,  label: 'Healthcare decisions should be left to individuals and the market, with minimal government involvement' },
    ],
  },
  {
    id: 'climate',
    label: 'Climate & Energy',
    question: 'What should be the priority for US energy and environmental policy?',
    options: [
      { value: -2, label: 'Rapidly transition to clean energy sources, even if it raises costs or disrupts existing industries' },
      { value: -1, label: 'Invest significantly in clean energy while managing the economic transition carefully' },
      { value: 1,  label: 'Expand domestic energy production of all types while making gradual environmental improvements' },
      { value: 2,  label: 'Prioritize energy production and affordability — environmental regulations should not limit that' },
    ],
  },
  {
    id: 'immigration',
    label: 'Immigration',
    question: 'What should US immigration policy focus on?',
    options: [
      { value: -2, label: 'Create more pathways for people to come legally and address the status of those already here' },
      { value: -1, label: 'Reform the system to make legal immigration easier while enforcing laws humanely' },
      { value: 1,  label: 'Secure the border first, then consider reforms to the legal immigration system' },
      { value: 2,  label: 'Significantly reduce the number of people coming in and strictly enforce existing immigration law' },
    ],
  },
  {
    id: 'gun_policy',
    label: 'Gun Policy',
    question: 'How should the US approach gun ownership and safety?',
    options: [
      { value: -2, label: 'Significantly expand gun safety laws, including restrictions on certain weapons and ownership requirements' },
      { value: -1, label: 'Add common-sense measures like universal background checks and closing known loopholes' },
      { value: 1,  label: 'Enforce existing laws more effectively without creating new restrictions on gun ownership' },
      { value: 2,  label: 'Protect the right to own and carry firearms and roll back existing restrictions where possible' },
    ],
  },
  {
    id: 'taxes',
    label: 'Taxes & Government Spending',
    question: 'How should the government balance taxes and public spending?',
    options: [
      { value: -2, label: 'Raise taxes on high earners and corporations to fund more robust public services and programs' },
      { value: -1, label: 'Modestly increase taxes where needed to maintain and improve public services' },
      { value: 1,  label: 'Keep taxes low and find ways to reduce government spending and the national debt' },
      { value: 2,  label: 'Significantly cut taxes and reduce the size and scope of government programs' },
    ],
  },
  {
    id: 'defense',
    label: 'Defense & Foreign Policy',
    question: 'What role should the US play in the world?',
    options: [
      { value: -2, label: 'Reduce military spending and focus on diplomacy and international cooperation' },
      { value: -1, label: 'Maintain strong alliances and international engagement while being selective about military action' },
      { value: 1,  label: 'Prioritize American national interests and maintain a strong military to back them up' },
      { value: 2,  label: 'Significantly increase military strength and take a more assertive stance in foreign affairs' },
    ],
  },
  {
    id: 'reproductive_rights',
    label: 'Reproductive Rights',
    question: 'How should abortion be handled legally in the US?',
    options: [
      { value: -2, label: 'Abortion should be a legal medical decision between a patient and their doctor, without government restrictions' },
      { value: -1, label: 'Abortion should be legal, with some limitations at later stages of pregnancy' },
      { value: 1,  label: 'Abortion should be significantly restricted, with exceptions for specific circumstances' },
      { value: 2,  label: 'Abortion should be prohibited or nearly prohibited in most or all cases' },
    ],
  },
  {
    id: 'education',
    label: 'Education',
    question: 'What should guide how the US approaches K-12 education?',
    options: [
      { value: -2, label: 'Significantly increase federal investment in public schools to ensure equal quality for all students' },
      { value: -1, label: 'Increase public school funding and teacher pay to strengthen the existing system' },
      { value: 1,  label: 'Give families more options through charter schools and school choice programs' },
      { value: 2,  label: 'Reduce federal involvement and give states and families full control over education decisions' },
    ],
  },
  {
    id: 'safety_net',
    label: 'Social Safety Net',
    question: 'How should the government support people who are struggling financially?',
    options: [
      { value: -2, label: 'Expand programs like food assistance, housing support, and welfare to reach more people who need help' },
      { value: -1, label: 'Strengthen existing programs and make them easier to access for those who qualify' },
      { value: 1,  label: 'Reform programs to have clear work requirements and timelines to encourage self-sufficiency' },
      { value: 2,  label: 'Significantly reduce government assistance programs and return that responsibility to communities and individuals' },
    ],
  },
  {
    id: 'criminal_justice',
    label: 'Criminal Justice',
    question: 'What should be the focus of the criminal justice system?',
    options: [
      { value: -2, label: 'Reduce incarceration, address root causes of crime, and invest in rehabilitation and community support' },
      { value: -1, label: 'Reform sentencing guidelines and expand rehabilitation programs while maintaining public safety' },
      { value: 1,  label: 'Prioritize law enforcement and public safety, with strong consequences for criminal behavior' },
      { value: 2,  label: 'Increase penalties, expand law enforcement capabilities, and take a tougher stance on crime' },
    ],
  },
];

const IMPORTANCE_LABELS = {
  3: 'Very important to me',
  2: 'Somewhat important',
  1: 'Not very important',
};

export default function Survey() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [answers, setAnswers]     = useState({});
  const [importance, setImportance] = useState({});
  const [step, setStep]           = useState(0);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [saved, setSaved]         = useState(false);

  const totalSteps  = ISSUES.length;
  const currentIssue = ISSUES[step - 1];

  useEffect(() => {
    async function load() {
      try {
        const existing = await getSurvey(user.id);
        if (existing?.answers) {
          setAnswers(existing.answers);
          setImportance(existing.importance || {});
          // If all questions answered, show completion screen
          const answeredCount = Object.keys(existing.answers).length;
          if (answeredCount >= ISSUES.length) {
            setStep(ISSUES.length + 1);
          }
        }
      } catch {}
      setLoading(false);
    }
    if (user) load();
  }, [user]);

  function handleAnswer(issueId, value) {
    setAnswers(prev => ({ ...prev, [issueId]: value }));
    if (!importance[issueId]) setImportance(prev => ({ ...prev, [issueId]: 2 }));
  }

  function handleImportance(issueId, value) {
    setImportance(prev => ({ ...prev, [issueId]: value }));
  }

  async function handleFinish() {
    setSaving(true);
    try {
      await saveSurvey(user.id, { answers, importance });
      setSaved(true);
      setStep(totalSteps + 1);
    } catch (err) {
      console.error('Failed to save survey:', err);
    }
    setSaving(false);
  }

  if (loading) return <LoadingState />;

  // Intro
  if (step === 0) {
    const answeredCount = Object.keys(answers).length;
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
            ◎ Private · Only you can see your answers
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.05, marginBottom: '1.25rem',
          }}>
            Where do <em style={{ fontStyle: 'italic', color: 'var(--red)' }}>you</em> stand?
          </h1>

          <p style={{ fontSize: 17, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '1rem' }}>
            Answer {totalSteps} questions about policy issues that matter to you.
            There are no right or wrong answers — just your honest opinion.
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.65, marginBottom: '2.5rem' }}>
            When you're done, you'll see how closely each of your representatives
            actually votes in line with what you believe — weighted by the issues
            you care about most.
          </p>

          <button onClick={() => setStep(answeredCount > 0 ? 1 : 1)} style={{
            height: 52, padding: '0 2.5rem',
            background: 'var(--text)', color: 'var(--bg-2)',
            borderRadius: 'var(--radius)', fontSize: 15, fontWeight: 500,
            cursor: 'pointer', border: 'none',
          }}>
            {answeredCount > 0 ? `Continue survey (${answeredCount}/${totalSteps} done) →` : 'Start the survey →'}
          </button>
        </div>
      </main>
    );
  }

  // Done — show summary of answers
  if (step === totalSteps + 1) {
    return (
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '4rem 1.5rem 6rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ fontSize: 40, marginBottom: '1rem' }}>✓</div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.75rem)',
            fontWeight: 900, letterSpacing: '-.02em', marginBottom: '1rem',
          }}>Your values are saved.</h1>
          <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '.75rem' }}>
            We use your answers to calculate how closely each of your representatives
            votes in line with what you believe — weighted by the issues you marked most important.
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: '2rem' }}>
            Alignment scores will appear on your representatives profiles. You can update your answers anytime.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/reps')} style={{
              height: 46, padding: '0 1.75rem', background: 'var(--text)', color: 'var(--bg-2)',
              borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none',
            }}>See my representatives →</button>
            <button onClick={() => setStep(1)} style={{
              height: 46, padding: '0 1.75rem', background: 'transparent', color: 'var(--text-2)',
              borderRadius: 'var(--radius)', fontSize: 14, cursor: 'pointer', border: '1px solid var(--border-med)',
            }}>Update my answers</button>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Your answers</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          {ISSUES.map(issue => {
            const answer = answers[issue.id];
            const imp = importance[issue.id] || 2;
            const selectedOption = issue.options.find(o => o.value === answer);
            return (
              <div key={issue.id} style={{
                padding: '1rem 1.25rem', marginBottom: 8,
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 4 }}>{issue.label}</p>
                    <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
                      {selectedOption ? selectedOption.label : <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Skipped</span>}
                    </p>
                  </div>
                  {selectedOption && (
                    <span style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', padding: '3px 8px',
                      borderRadius: 20, flexShrink: 0,
                      background: imp === 3 ? 'var(--red-dim)' : imp === 2 ? 'var(--amber-dim)' : 'var(--bg-3)',
                      color: imp === 3 ? 'var(--red)' : imp === 2 ? 'var(--amber)' : 'var(--text-3)',
                    }}>
                      {imp === 3 ? 'Very important' : imp === 2 ? 'Somewhat important' : 'Not very important'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    );
  }

  // Question
  const answered = answers[currentIssue.id] !== undefined;
  const progress = ((step - 1) / totalSteps) * 100;

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>
      {/* Progress */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            {step} of {totalSteps}
          </span>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            {currentIssue.label}
          </span>
        </div>
        <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 2 }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: 'var(--red)', borderRadius: 2,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Question */}
      <h2 style={{
        fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 3.5vw, 2.1rem)',
        fontWeight: 700, letterSpacing: '-.015em', lineHeight: 1.25,
        marginBottom: '2rem',
      }}>
        {currentIssue.question}
      </h2>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '2rem' }}>
        {currentIssue.options.map(option => {
          const selected = answers[currentIssue.id] === option.value;
          return (
            <button key={option.value} onClick={() => handleAnswer(currentIssue.id, option.value)} style={{
              padding: '1rem 1.25rem', textAlign: 'left', cursor: 'pointer',
              background: selected ? 'var(--text)' : 'var(--bg-2)',
              color: selected ? 'var(--bg-2)' : 'var(--text)',
              border: `1.5px solid ${selected ? 'var(--text)' : 'var(--border-med)'}`,
              borderRadius: 'var(--radius-lg)', fontSize: 14, lineHeight: 1.55,
              transition: 'all var(--transition)', boxShadow: selected ? 'none' : 'var(--shadow)',
            }}>
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Importance */}
      {answered && (
        <div style={{
          padding: '1rem 1.25rem', background: 'var(--bg-2)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          marginBottom: '2rem', boxShadow: 'var(--shadow)',
          animation: 'fadeUp 0.3s ease both',
        }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: '.75rem' }}>
            How important is this issue to you personally?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {[3, 2, 1].map(val => (
              <button key={val} onClick={() => handleImportance(currentIssue.id, val)} style={{
                flex: 1, padding: '8px 4px', fontSize: 12,
                fontFamily: 'var(--font-mono)', cursor: 'pointer',
                background: (importance[currentIssue.id] || 2) === val ? 'var(--text)' : 'transparent',
                color: (importance[currentIssue.id] || 2) === val ? 'var(--bg-2)' : 'var(--text-2)',
                border: `1px solid ${(importance[currentIssue.id] || 2) === val ? 'var(--text)' : 'var(--border-med)'}`,
                borderRadius: 'var(--radius)', transition: 'all var(--transition)', textAlign: 'center',
              }}>
                {IMPORTANCE_LABELS[val]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} style={{
          fontSize: 13, fontFamily: 'var(--font-mono)', cursor: 'pointer',
          color: step === 1 ? 'var(--text-3)' : 'var(--text-2)',
          border: '1px solid var(--border-med)', borderRadius: 'var(--radius)',
          padding: '8px 16px', background: 'transparent', opacity: step === 1 ? 0.4 : 1,
        }}>← Back</button>

        <button
          onClick={() => { if (step === totalSteps) handleFinish(); else setStep(s => s + 1); }}
          disabled={!answered || saving}
          style={{
            fontSize: 14, fontWeight: 500, cursor: answered ? 'pointer' : 'not-allowed',
            color: answered ? 'var(--bg-2)' : 'var(--text-3)',
            background: answered ? 'var(--text)' : 'var(--bg-3)',
            border: 'none', borderRadius: 'var(--radius)',
            padding: '10px 24px', transition: 'all var(--transition)',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : step === totalSteps ? 'Finish →' : 'Next →'}
        </button>
      </div>

      {!answered && (
        <p style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button onClick={() => setStep(s => s + 1)} style={{
            fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
            background: 'none', border: 'none', cursor: 'pointer',
          }}>Skip this question</button>
        </p>
      )}
    </main>
  );
}

function LoadingState() {
  return (
    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      Loading your survey…
    </div>
  );
}
