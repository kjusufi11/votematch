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

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            Effective date: {EFFECTIVE_DATE}
          </p>
        </div>

        <Section title="Acceptance">
          <P>
            By using VoteMatch ("the Service"), you agree to these Terms of Service. If you do not agree,
            do not use the Service. VoteMatch is operated as a civic information tool — its purpose is to
            help you understand how your representatives vote and compare that record to your own positions.
          </P>
        </Section>

        <Section title="Eligibility">
          <P>
            The Service is intended for residents of the United States who are at least 13 years of age.
            By using the Service, you represent that you meet these requirements.
          </P>
        </Section>

        <Section title="What VoteMatch provides">
          <P>VoteMatch provides:</P>
          <UL items={[
            'Representative lookup by ZIP code using public government data',
            'Voting record data sourced from Congress.gov, ProPublica, and other public sources',
            'Alignment scores calculated by comparing your survey answers to legislative vote records',
            'Executive order and bill tracking using Federal Register and Congress.gov data',
            'Optional email alerts when representatives vote on issues you care about',
          ]} />
          <P>
            VoteMatch is an informational tool. It does not provide legal, political, or voting advice.
            All voting records and political data are sourced from public government databases and are
            presented as-is. We make reasonable efforts to ensure accuracy, but we cannot guarantee that
            all data is complete or up to date.
          </P>
        </Section>

        <Section title="Data accuracy and limitations">
          <P>
            Legislative vote records, bill titles, and representative information are retrieved from
            third-party government APIs. VoteMatch does not independently verify this data and is not
            responsible for errors or omissions in source data.
            Alignment scores are computational estimates — they reflect voting patterns and stated positions,
            not guaranteed predictions of how a representative will vote on any future issue.
          </P>
        </Section>

        <Section title="Your account">
          <P>
            You are responsible for maintaining the confidentiality of your account credentials.
            You agree not to share your account with others or use another user's account without permission.
            We reserve the right to suspend or terminate accounts that violate these Terms.
          </P>
        </Section>

        <Section title="Acceptable use">
          <P>You agree not to:</P>
          <UL items={[
            'Use the Service to harass, intimidate, or target any individual or group',
            'Attempt to scrape, reverse-engineer, or systematically extract data from the Service',
            'Circumvent rate limits, authentication, or other technical controls',
            'Use the Service for commercial purposes without our prior written consent',
            'Submit false or misleading survey responses to manipulate aggregate research data',
          ]} />
        </Section>

        <Section title="Intellectual property">
          <P>
            The VoteMatch name, logo, and interface design are proprietary. Public government data
            displayed through the Service remains in the public domain. Your survey responses belong
            to you — we use them solely to provide the Service and (with your explicit consent)
            for aggregate civic research.
          </P>
        </Section>

        <Section title="Disclaimer of warranties">
          <P>
            The Service is provided "as is" and "as available" without warranties of any kind,
            express or implied. We do not warrant that the Service will be uninterrupted, error-free,
            or that any particular information is accurate, complete, or current.
          </P>
        </Section>

        <Section title="Limitation of liability">
          <P>
            To the maximum extent permitted by law, VoteMatch and its operators shall not be liable
            for any indirect, incidental, special, consequential, or punitive damages arising from your
            use of or inability to use the Service. In no event shall our total liability exceed the
            amount you paid us in the twelve months preceding the claim (which, as the Service is free,
            will be $0 for most users).
          </P>
        </Section>

        <Section title="Changes to the Service">
          <P>
            We reserve the right to modify, suspend, or discontinue any part of the Service at any time.
            We will make reasonable efforts to notify users of significant changes.
          </P>
        </Section>

        <Section title="Changes to these Terms">
          <P>
            We may update these Terms from time to time. Material changes will be communicated via
            email to registered users and by updating the effective date above. Continued use of the
            Service after changes are posted constitutes acceptance.
          </P>
        </Section>

        <Section title="Governing law">
          <P>
            These Terms are governed by the laws of the United States. Any disputes will be resolved
            in federal or state courts of competent jurisdiction.
          </P>
        </Section>

        <Section title="Contact">
          <P>
            Questions about these Terms:{' '}
            <a href="mailto:privacy@votematch.app" style={{ color: 'var(--text)', textDecoration: 'underline' }}>
              privacy@votematch.app
            </a>
          </P>
        </Section>

        <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <Link to="/privacy" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
            Also see: Privacy Policy →
          </Link>
        </div>
    </main>
  );
}
