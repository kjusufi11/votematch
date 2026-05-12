import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer style={{
      marginTop: '6rem',
      borderTop: '1px solid var(--border)',
      padding: '2rem 1.5rem',
      textAlign: 'center',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '1.5rem', flexWrap: 'wrap',
        fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
      }}>
        <span>© {new Date().getFullYear()} VoteMatch</span>
        <Link to="/privacy" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Privacy Policy</Link>
        <Link to="/terms" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Terms of Service</Link>
        <a href="mailto:privacy@votematch.app" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>privacy@votematch.app</a>
      </div>
    </footer>
  );
}
