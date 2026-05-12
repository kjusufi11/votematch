import React from 'react';
import { Link } from 'react-router-dom';

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: '3rem' }}>
      <h2 style={{
        fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3.5vw, 2.1rem)',
        fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.15, marginBottom: '1rem',
      }}>{title}</h2>
      <div style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.75 }}>
        {children}
      </div>
    </section>
  );
}

function P({ children }) { return <p style={{ margin: '0 0 .85rem' }}>{children}</p>; }

export default function AboutPage() {
  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '4rem 1.5rem 5rem' }}>

      <div style={{ marginBottom: '3.5rem' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)',
          letterSpacing: '.1em', textTransform: 'uppercase',
          border: '1px solid var(--border-med)', borderRadius: 20,
          padding: '5px 16px', marginBottom: '1.5rem', background: 'var(--bg-2)',
        }}>
          About
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
          fontWeight: 900, letterSpacing: '-.025em', lineHeight: 1.05, marginBottom: '1.25rem',
        }}>
          A simpler way to understand who represents you.
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 0 }}>
          VoteMatch cuts through political noise with data. Enter your ZIP — see your representatives,
          what they vote for, and how closely that matches what you actually believe.
        </p>
      </div>

      <Section title="What VoteMatch does">
        <P>
          VoteMatch shows you the real voting record of every US representative tied to your ZIP code.
          For each member of Congress, we analyze hundreds of roll-call votes and break down
          their ideological patterns across healthcare, climate, immigration, defense, and more.
        </P>
        <P>
          If you take the survey, you get a match score — a percentage showing how closely each
          representative's actual votes align with your stated positions, weighted by the issues
          you care about most.
        </P>
      </Section>

      <Section title="How it works">
        <P>
          When you enter your ZIP, we call Google Civic Information to identify your federal and state
          representatives. We fetch their vote records from Congress.gov, then run a Claude AI analysis
          to surface ideological patterns across issue areas.
        </P>
        <P>
          Survey answers are compared directly to vote records — we calculate agreement percentages
          for each issue area and weight them by your stated importance ratings.
          The extended survey (optional, ~5 min) adds policy depth and deal-breaker signals
          that further sharpen the match score.
        </P>
      </Section>

      <Section title="Who built this">
        <P>
          VoteMatch is an independent civic technology project. It was built to give regular people
          the same quality of political intelligence that campaigns and lobbyists have always had —
          without the spin, without paywalls, and without ads.
        </P>
        <P>
          Questions or feedback:{' '}
          <a href="mailto:privacy@votematch.app" style={{ color: 'var(--text)', textDecoration: 'underline' }}>
            privacy@votematch.app
          </a>
        </P>
      </Section>

      <Section title="Data sources">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
          {[
            { name: 'Congress.gov', desc: 'Official vote records, bills, and legislative data from the Library of Congress', url: 'https://www.congress.gov' },
            { name: 'Google Civic Information', desc: 'Representative lookup by ZIP code', url: 'https://developers.google.com/civic-information' },
            { name: 'Federal Register', desc: 'Executive orders and presidential documents', url: 'https://www.federalregister.gov' },
            { name: 'FEC Open Data', desc: 'Campaign finance and donor data for conflict-of-interest detection', url: 'https://www.fec.gov/data/' },
            { name: 'Claude AI (Anthropic)', desc: 'AI analysis of voting patterns and executive order summaries', url: 'https://www.anthropic.com' },
          ].map(source => (
            <div key={source.name} style={{
              padding: '.875rem 1.125rem',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{source.name}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '3px 0 0', lineHeight: 1.5 }}>{source.desc}</p>
                </div>
                <a href={source.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  ↗ Visit
                </a>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="What we don't do">
        <ul style={{ padding: '0 0 0 1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'We don\'t take a political side. Match scores reflect your survey answers against real votes — not our opinion.',
            'We don\'t sell your data or run ads. The service is free and funded independently.',
            'We don\'t editorialize. Vote records and executive order summaries are factual and sourced directly from government data.',
          ].map((item, i) => (
            <li key={i} style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.65 }}>{item}</li>
          ))}
        </ul>
      </Section>

      {/* Product Hunt badge placeholder */}
      <div style={{
        padding: '1.5rem', background: 'var(--bg-2)', border: '1px solid var(--border-med)',
        borderRadius: 'var(--radius-lg)', textAlign: 'center', marginBottom: '2rem',
      }}>
        <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: '.75rem' }}>
          Product Hunt launch coming soon
        </p>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          border: '1px solid var(--border-med)', borderRadius: 'var(--radius)',
          padding: '8px 16px', background: 'var(--bg)',
        }}>
          <span style={{ fontSize: 20 }}>🚀</span>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>VoteMatch</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>See how your reps really vote</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link to="/" style={{
          height: 42, padding: '0 1.5rem', display: 'inline-flex', alignItems: 'center',
          background: 'var(--text)', color: 'var(--bg-2)',
          borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 500, textDecoration: 'none',
        }}>Try VoteMatch →</Link>
        <Link to="/privacy" style={{
          height: 42, padding: '0 1.25rem', display: 'inline-flex', alignItems: 'center',
          background: 'transparent', color: 'var(--text-2)',
          borderRadius: 'var(--radius)', fontSize: 14, textDecoration: 'none',
          border: '1px solid var(--border-med)',
        }}>Privacy Policy</Link>
      </div>
    </main>
  );
}
