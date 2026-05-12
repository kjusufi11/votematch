import React, { useEffect, useState } from 'react';

export default function InstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only show on second+ visit
    const visits = parseInt(localStorage.getItem('vm_visit_count') || '0', 10) + 1;
    localStorage.setItem('vm_visit_count', String(visits));
    const alreadyDismissed = localStorage.getItem('vm_install_dismissed') === '1';

    if (alreadyDismissed || visits < 2) return;

    const handler = e => {
      e.preventDefault();
      setPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    setVisible(false);
    setDismissed(true);
    localStorage.setItem('vm_install_dismissed', '1');
  }

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') localStorage.setItem('vm_install_dismissed', '1');
    setVisible(false);
  }

  if (!visible || dismissed) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '1rem', left: '50%', transform: 'translateX(-50%)',
      zIndex: 200, width: 'calc(100% - 2rem)', maxWidth: 420,
      background: 'var(--text)', color: 'var(--bg-2)',
      borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem',
      boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      display: 'flex', alignItems: 'center', gap: '1rem',
      animation: 'fadeUp 0.3s ease both',
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>
          Add VoteMatch to your home screen
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>
          Quick access to your representatives — works offline
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={dismiss} style={{
          background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
          color: 'rgba(255,255,255,0.7)', borderRadius: 'var(--radius)',
          fontSize: 12, padding: '5px 10px', cursor: 'pointer',
        }}>Later</button>
        <button onClick={install} style={{
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.4)',
          color: 'white', borderRadius: 'var(--radius)',
          fontSize: 12, fontWeight: 600, padding: '5px 12px', cursor: 'pointer',
        }}>Install</button>
      </div>
    </div>
  );
}
