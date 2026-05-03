import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/react';
import { useNavigate } from 'react-router-dom';
import { saveSurvey, getSurvey } from '../services/api';

const ISSUES = [
  {
    id: 'healthcare',
    label: 'Healthcare',
    question: 'How should the US handle healthcare coverage?',
    options: [
      { value: -2, label: 'Government should provide universal coverage for all Americans' },
      { value: -1, label: 'Expand public options while keeping private insurance' },
      { value: 1, label: 'Keep healthcare primarily private with some safety nets' },
      { value: 2, label: 'Let the free market determine healthcare with minimal government role' },
    ],
  },
  {
    id: 'climate',
    label: 'Climate & Energy',
    question: 'What should the US prioritize on climate and energy?',
    options: [
      { value: -2, label: 'Rapid transition to clean energy, even at significant economic cost' },
      { value: -1, label: 'Invest in clean energy while managing economic impact' },
      { value: 1, label: 'Balance energy independence with gradual environmental improvements' },
      { value: 2, label: 'Prioritize energy production and economic growth over climate regulations' },
    ],
  },
  {
    id: 'immigration',
    label: 'Immigration',
    question: 'What approach should the US take on immigration?',
    options: [
      { value: -2, label: 'Create broad pathways to citizenship and expand legal immigration' },
      { value: -1, label: 'Reform immigration with expanded legal pathways and humane enforcement' },
      { value: 1, label: 'Strengthen border security while maintaining legal immigration' },
      { value: 2, label: 'Significantly reduce immigration and strictly enforce existing laws' },
    ],
  },
  {
    id: 'gun_control',
    label: 'Gun Policy',
    question: 'How should the US approach gun laws?',
    options: [
      { value: -2, label: 'Significantly expand gun regulations and restrictions' },
      { value: -1, label: 'Add universal background checks and close loopholes' },
      { value: 1, label: 'Enforce existing laws more strictly without new restrictions' },
      { value: 2, label: 'Protect gun rights and reduce existing restrictions' },
    ],
  },
  {
    id: 'taxes',
    label: 'Taxes & Spending',
    question: 'How should the government handle taxes and spending?',
    options: [
      { value: -2, label: 'Significantly raise taxes on wealthy individuals and corporations' },
      { value: -1, label: 'Modestly increase taxes on high earners to fund public services' },
      { value: 1, label: 'Keep taxes low and reduce government spending' },
      { value: 2, label: 'Significantly cut taxes and government programs' },
    ],
  },
  {
    id: 'defense',
    label: 'Defense & Foreign Policy',
    question: 'What should US foreign policy and defense look like?',
    options: [
      { value: -2, label: 'Reduce military spending and focus on diplomacy' },
      { value: -1, label: 'Maintain alliances and international engagement with targeted spending' },
      { value: 1, label: 'Prioritize national interests and maintain strong military' },
      { value: 2, label: 'Expand military spending and take a stronger stance internationally' },
    ],
  },
  {
    id: 'reproductive_rights',
    label: 'Reproductive Rights',
    question: 'What is your position on abortion access?',
    options: [
      { value: -2, label: 'Abortion should be legal without restrictions throughout pregnancy' },
      { value: -1, label: 'Abortion should be legal with some limitations' },
      { value: 1, label: 'Abortion should be significantly restricted with limited exceptions' },
      { value: 2, label: 'Abortion should be banned or nearly banned' },
    ],
  },
  {
    id: 'education',
    label: 'Education',
    question: 'How should the US approach public education?',
    options: [
      { value: -2, label: 'Significantly increase public school funding and universal pre-K' },
      { value: -1, label: 'Increase public education investment and teacher pay' },
      { value: 1, label: 'Expand school choice and parental control over education' },
      { value: 2, label: 'Reduce federal education role and expand private/charter options' },
    ],
  },
  {
    id: 'social_safety_net',
    label: 'Social Safety Net',
    question: 'How should the US handle social programs like welfare and food assistance?',
    options: [
      { value: -2, label: 'Significantly expand social programs and eligibility' },
      { value: -1, label: 'Strengthen and modernize existing safety net programs' },
      { value: 1, label: 'Reform programs to encourage self-sufficiency' },
      { value: 2, label: 'Reduce social programs and return responsibility to individuals' },
    ],
  },
  {
    id: 'criminal_justice',
    label: 'Criminal Justice',
    question: 'What should be the focus of the criminal justice system?',
    options: [
      { value: -2, label: 'Significant reform: reduce incarceration, invest in communities' },
      { value: -1, label: 'Reform sentencing and invest in rehabilitation' },
      { value: 1, label: 'Focus on law enforcement and maintaining public safety' },
      { value: 2, label: 'Strengthen penalties and expand law enforcement capabilities' },
    ],
  },
];

const IMPORTANCE_LABELS = {
  3: 'Very important to me',
  2: 'Somewhat important',
  1: 'Not very important',
};

export default function Survey() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState({});
  const [importance, setImportance] = useState({});
  const [step, setStep] = useState(0); // 0 = intro, 1..N = questions, N+1 = done
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const totalSteps = ISSUES.length;
  const currentIssue = ISSUES[step - 1];

  useEffect(() => {
    // Load existing survey if user has one
    async function load() {
      try {
        const existing = await getSurvey(user.id);
        if (existing?.answers) {
          setAnswers(existing.answers);
          setImportance(existing.importance || {});
        }
      } catch {}
      setLoading(false);
    }
    if (user) load();
  }, [user]);

  function handleAnswer(issueId, value) {
    setAnswers(prev => ({ ...prev, [issueId]: value }));
    if (!importance[issueId]) {
      setImportance(prev => ({ ...prev, [issueId]: 2 })); // default: somewhat important
    }
  }

  function handleImportance(issueId, value) {
    setImportance(prev => ({ ...prev, [issueId]: value }));
  }

  async function handleFinish() {
    setSaving(true);
    try {
      await saveSurvey(user.id, { answers, importance });
      setStep(totalSteps + 1);
    } catch (err) {
      console.error('Failed to save survey:', err);
    }
    setSaving(false);
  }

  if (loading) return <LoadingState />;

  // Intro screen
  if (step === 0) {
    return (
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '4rem 1.5rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)',
            letterSpacing: '.1em', textTransform: 'uppercase',
            border: '1px solid var(--border-med)', borderRadius: 20,
            padding: '5px 16px', marginBottom: '2rem',
            background: 'var(--bg-2)',
          }}>
            ◎ Your values · Private & secure
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.05,
            marginBottom: '1.25rem',
          }}>
            Where do <em style={{ fontStyle: 'italic', color: 'var(--red)' }}>you</em> stand?
          </h1>

          <p style={{ fontSize: 17, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '1rem' }}>
            Answer {totalSteps} questions about the issues that matter to you.
            Your responses are private — only you can see them.
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.65, marginBottom: '2.5rem' }}>
            After completing the survey, you'll see how closely your values align
            with each of your representatives — scored by the issues you care about most.
          </p>

          <button onClick={() => setStep(1)} style={{
            height: 52, padding: '0 2.5rem',
            background: 'var(--text)', color: 'var(--bg-2)',
            borderRadius: 'var(--radius)', fontSize: 15, fontWeight: 500,
            cursor: 'pointer', transition: 'all var(--transition)',
            border: 'none',
          }}>
            Start the survey →
          </button>

          {Object.keys(answers).length > 0 && (
            <p style={{ marginTop: '1rem', fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              You've answered {Object.keys(answers).length} of {totalSteps} questions before.
            </p>
          )}
        </div>
      </main>
    );
  }

  // Done screen
  if (step === totalSteps + 1) {
    return (
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: '1.5rem' }}>✓</div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3rem)',
          fontWeight: 900, letterSpacing: '-.02em', marginBottom: '1rem',
        }}>
          Your values are saved.
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          Now see how your representatives measure up. Your alignment scores are calculated
          based on the issues you care about most.
        </p>
        <button onClick={() => navigate('/reps')} style={{
          height: 52, padding: '0 2rem',
          background: 'var(--text)', color: 'var(--bg-2)',
          borderRadius: 'var(--radius)', fontSize: 15, fontWeight: 500,
          cursor: 'pointer', border: 'none',
        }}>
          See my representatives →
        </button>
      </main>
    );
  }

  // Question screen
  const answered = answers[currentIssue.id] !== undefined;
  const progress = ((step - 1) / totalSteps) * 100;

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>

      {/* Progress bar */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            Question {step} of {totalSteps}
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
        fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
        fontWeight: 700, letterSpacing: '-.015em', lineHeight: 1.2,
        marginBottom: '2rem',
      }}>
        {currentIssue.question}
      </h2>

      {/* Answer options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '2rem' }}>
        {currentIssue.options.map(option => {
          const selected = answers[currentIssue.id] === option.value;
          return (
            <button
              key={option.value}
              onClick={() => handleAnswer(currentIssue.id, option.value)}
              style={{
                padding: '1rem 1.25rem',
                textAlign: 'left', cursor: 'pointer',
                background: selected ? 'var(--text)' : 'var(--bg-2)',
                color: selected ? 'var(--bg-2)' : 'var(--text)',
                border: `1.5px solid ${selected ? 'var(--text)' : 'var(--border-med)'}`,
                borderRadius: 'var(--radius-lg)',
                fontSize: 14, lineHeight: 1.5,
                transition: 'all var(--transition)',
                boxShadow: selected ? 'none' : 'var(--shadow)',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Importance selector — only show after answering */}
      {answered && (
        <div style={{
          padding: '1rem 1.25rem',
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', marginBottom: '2rem',
          boxShadow: 'var(--shadow)',
          animation: 'fadeUp 0.3s ease both',
        }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: '0.75rem' }}>
            How important is this issue to you?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {[3, 2, 1].map(val => (
              <button
                key={val}
                onClick={() => handleImportance(currentIssue.id, val)}
                style={{
                  flex: 1, padding: '8px 4px', fontSize: 12,
                  fontFamily: 'var(--font-mono)', cursor: 'pointer',
                  background: (importance[currentIssue.id] || 2) === val ? 'var(--text)' : 'transparent',
                  color: (importance[currentIssue.id] || 2) === val ? 'var(--bg-2)' : 'var(--text-2)',
                  border: `1px solid ${(importance[currentIssue.id] || 2) === val ? 'var(--text)' : 'var(--border-med)'}`,
                  borderRadius: 'var(--radius)', transition: 'all var(--transition)',
                  textAlign: 'center',
                }}
              >
                {IMPORTANCE_LABELS[val]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
          style={{
            fontSize: 13, fontFamily: 'var(--font-mono)', cursor: 'pointer',
            color: step === 1 ? 'var(--text-3)' : 'var(--text-2)',
            border: '1px solid var(--border-med)', borderRadius: 'var(--radius)',
            padding: '8px 16px', background: 'transparent',
            opacity: step === 1 ? 0.4 : 1,
          }}
        >
          ← Back
        </button>

        <button
          onClick={() => {
            if (step === totalSteps) handleFinish();
            else setStep(s => s + 1);
          }}
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

      {/* Skip option */}
      {!answered && (
        <p style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            onClick={() => setStep(s => s + 1)}
            style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Skip this question
          </button>
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
