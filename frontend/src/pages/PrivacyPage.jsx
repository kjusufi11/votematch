import React from 'react';
import { Link } from 'react-router-dom';

const EFFECTIVE_DATE = 'May 12, 2026';

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <h2 style={{
        fontFamily: 'var(--font-display)', fontSize: '1.35rem',
        fontWeight: 700, letterSpacing: '-.015em', marginBottom: '.75rem',
        color: 'var(--text)',
      }}>{title}</h2>
      <div style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.75 }}>
        {children}
      </div>
    </section>
  );
}

function P({ children }) {
  return <p style={{ margin: '0 0 .85rem' }}>{children}</p>;
}

function UL({ items }) {
  return (
    <ul style={{ padding: '0 0 0 1.25rem', margin: '0 0 .85rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem 2rem' }}>
        <div style={{ marginBottom: '3rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)',
            letterSpacing: '.1em', textTransform: 'uppercase',
            border: '1px solid var(--border-med)', borderRadius: 20,
            padding: '5px 16px', marginBottom: '1.5rem', background: 'var(--bg-2)',
          }}>
            Legal
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.1, marginBottom: '.75rem',
          }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            Effective date: {EFFECTIVE_DATE}
          </p>
        </div>

        <Section title="Who we are">
          <P>
            VoteMatch ("we," "us," or "our") is a civic technology tool that helps US residents understand how
            their elected representatives vote and compare those votes against their own policy positions.
            Our contact for privacy matters is{' '}
            <a href="mailto:privacy@votematch.app" style={{ color: 'var(--text)', textDecoration: 'underline' }}>
              privacy@votematch.app
            </a>.
          </P>
        </Section>

        <Section title="What we collect">
          <P>We collect only what is necessary to provide the service:</P>
          <UL items={[
            'Email address and hashed password (if you create an account)',
            'Your ZIP code, used to look up your representatives',
            'Your survey answers — policy positions and importance ratings you submit voluntarily',
            'Extended survey responses if you choose to complete the full survey (demographics, engagement, policy depth, research consent)',
            'Notification preferences (vote alert opt-in/out)',
            'Standard server logs: IP address, browser type, pages visited, timestamps — retained for 30 days',
          ]} />
        </Section>

        <Section title="How we use your data">
          <P>We use your data to:</P>
          <UL items={[
            'Calculate alignment scores between your positions and your representatives' voting records',
            'Send vote alert emails when your representatives vote on issues you marked as important (only if you opt in)',
            'Improve the accuracy of match scores over time',
            'Produce aggregate, anonymized civic research statistics (only if you explicitly consent in the extended survey)',
          ]} />
          <P>We do not use your data for advertising, behavioral tracking, or any purpose beyond the above.</P>
        </Section>

        <Section title="Research and anonymized data">
          <P>
            If you complete the extended survey and check the research consent box, we may include your responses
            in aggregate statistical analysis of civic attitudes across demographics and geographies.
            Individual responses are never published or shared. No personally identifiable information
            is included in any research output. You can withdraw consent at any time by returning to the
            extended survey page and unchecking the consent box.
          </P>
        </Section>

        <Section title="Data sharing">
          <P>We do not sell, rent, or share your personal data with third parties, except:</P>
          <UL items={[
            'Service providers who process data on our behalf (database hosting on Railway, email delivery) — under data processing agreements',
            'If required by law, court order, or to protect against fraud or abuse',
          ]} />
          <P>
            We use public government APIs (Congress.gov, Google Civic, Federal Register) to retrieve
            representative and vote data. No personal information is sent to these services.
          </P>
        </Section>

        <Section title="Data retention">
          <P>
            Your account data and survey responses are retained for as long as your account is active.
            If you delete your account (by emailing us at{' '}
            <a href="mailto:privacy@votematch.app" style={{ color: 'var(--text)', textDecoration: 'underline' }}>privacy@votematch.app</a>),
            we delete all associated personal data within 30 days.
            Server logs are deleted after 30 days.
          </P>
        </Section>

        <Section title="Security">
          <P>
            Passwords are hashed using bcrypt before storage. We do not store plaintext passwords.
            All data is transmitted over HTTPS. We use industry-standard security practices for database access
            and environment variable management.
          </P>
        </Section>

        <Section title="Your rights">
          <P>You have the right to:</P>
          <UL items={[
            'Access the personal data we hold about you',
            'Correct inaccurate data',
            'Delete your account and all associated data',
            'Withdraw research consent at any time',
            'Opt out of vote alert emails at any time',
          ]} />
          <P>
            To exercise any of these rights, email{' '}
            <a href="mailto:privacy@votematch.app" style={{ color: 'var(--text)', textDecoration: 'underline' }}>
              privacy@votematch.app
            </a>.
          </P>
        </Section>

        <Section title="Cookies and tracking">
          <P>
            We do not use third-party advertising cookies or tracking pixels.
            We store your authentication token in localStorage to keep you signed in across sessions.
            We do not use analytics services that build cross-site behavioral profiles.
          </P>
        </Section>

        <Section title="Changes to this policy">
          <P>
            If we make material changes to this policy, we will update the effective date at the top
            and, where appropriate, notify registered users by email. Continued use of VoteMatch after
            changes are posted constitutes acceptance of the updated policy.
          </P>
        </Section>

        <Section title="Contact">
          <P>
            Questions about this privacy policy or your data:{' '}
            <a href="mailto:privacy@votematch.app" style={{ color: 'var(--text)', textDecoration: 'underline' }}>
              privacy@votematch.app
            </a>
          </P>
        </Section>

        <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <Link to="/terms" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
            Also see: Terms of Service →
          </Link>
        </div>
    </main>
  );
}
