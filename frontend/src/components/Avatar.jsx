import React, { useState } from 'react';

const PC = { D: 'var(--party-d)', R: 'var(--party-r)', I: 'var(--party-i)' };
const PD = { D: 'var(--party-d-dim)', R: 'var(--party-r-dim)', I: 'var(--party-i-dim)' };

// Official congressional headshots — 200x250 JPEGs, keyed by bioguide ID.
function bioguidePhotoUrl(id) {
  return `https://bioguide.congress.gov/bioguide/photo/${id[0]}/${id}.jpg`;
}

export default function Avatar({ id, name, party, size = 48, fontSize = 15 }) {
  const [imgFailed, setImgFailed] = useState(false);

  const initials = (name || '')
    .split(' ')
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const style = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    background: PD[party] || 'var(--bg-3)',
    color: PC[party] || 'var(--text-2)',
    border: `1px solid ${PC[party] || 'var(--border-med)'}28`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-display)', fontSize, fontWeight: 700,
    overflow: 'hidden',
  };

  if (id && !imgFailed) {
    return (
      <div style={style}>
        <img
          src={bioguidePhotoUrl(id)}
          alt={name || ''}
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  return <div style={style}>{initials}</div>;
}
