import React from 'react';

const CATEGORY_LABELS = {
  // biasEngine categories
  reproductive_rights:  'Reproductive Rights',
  gun_control:          'Gun Policy',
  climate_environment:  'Climate & Energy',
  immigration:          'Immigration',
  healthcare:           'Healthcare',
  foreign_policy:       'Defense & Foreign Policy',
  defense_spending:     'Defense & Foreign Policy',
  taxation_fiscal:      'Economy & Taxes',
  criminal_justice:     'Criminal Justice',
  voting_rights:        'Voting Rights',
  labor_unions:         'Economy & Taxes',
  financial_regulation: 'Economy & Taxes',
  drug_policy:          'Criminal Justice',
  education:            'Education',
  social_safety_net:    'Social Safety Net',
  foreign_lobbying:     'Defense & Foreign Policy',
  lgbtq_rights:         'Social Safety Net',
  tech_privacy:         'Economy & Taxes',
  // domainClassifier keys
  climate:              'Climate & Energy',
  economy:              'Economy & Taxes',
  defense:              'Defense & Foreign Policy',
  gun_policy:           'Gun Policy',
  safety_net:           'Social Safety Net',
  infrastructure:       'Infrastructure',
};

function biasColor(direction, score) {
  if (score < 0.5) return 'var(--text-3)';
  if (direction === 'against') return 'var(--red)';
  if (direction === 'for') return 'var(--blue)';
  return 'var(--amber)';
}

function confidenceColor(confidence) {
  return confidence === 'high' ? 'var(--green)' : confidence === 'medium' ? 'var(--amber)' : 'var(--text-3)';
}

export default function BiasBar({ bias, delay = 0 }) {
  const color = biasColor(bias.direction, bias.score);
  const pct   = Math.round(bias.score * 100);
  const isCorruption = bias.flag === 'corruption';
  const isForeign    = bias.flag === 'foreign';

  const cleanLabel = CATEGORY_LABELS[bias.category] || bias.label;
  const aiLabel    = bias.label && bias.label !== cleanLabel ? bias.label : null;

  return (
    <div style={{
      padding: '9px 0', borderBottom: '1px solid var(--border)',
      animation: `fadeUp 0.4s ease ${delay}s both`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: aiLabel ? 3 : 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: confidenceColor(bias.confidence),
          }} />
          <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{cleanLabel}</span>
          {isCorruption && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 7px',
              borderRadius: 3, letterSpacing: '.06em', textTransform: 'uppercase',
              background: 'var(--gold-dim)', color: 'var(--gold)',
            }}>⚑ Lobbying</span>
          )}
          {isForeign && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 7px',
              borderRadius: 3, letterSpacing: '.06em', textTransform: 'uppercase',
              background: 'var(--orange-dim)', color: 'var(--orange)',
            }}>◈ Foreign</span>
          )}
          {bias.vote_count && (
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
              {bias.vote_count} votes
            </span>
          )}
        </div>
        <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 500, color }}>{pct}%</span>
      </div>

      {aiLabel && (
        <p style={{ marginBottom: 5, fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>{aiLabel}</p>
      )}

      <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color, borderRadius: 2,
          transition: 'width 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
        }} />
      </div>

      {bias.summary && (
        <p style={{ marginTop: 5, fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', lineHeight: 1.5 }}>
          {bias.summary}
        </p>
      )}
    </div>
  );
}
