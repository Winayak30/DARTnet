import React from 'react';
import type { Severity } from '../../types';

interface SeverityBadgeProps {
  severity: Severity | string;
  size?: 'sm' | 'md';
}

const SEVERITY_STYLES: Record<string, React.CSSProperties> = {
  CRITICAL: {
    background: 'rgba(239,68,68,0.15)',
    color: '#F87171',
    border: '1px solid rgba(239,68,68,0.4)',
  },
  HIGH: {
    background: 'rgba(249,115,22,0.12)',
    color: '#FB923C',
    border: '1px solid rgba(249,115,22,0.35)',
  },
  MEDIUM: {
    background: 'rgba(245,158,11,0.12)',
    color: '#FCD34D',
    border: '1px solid rgba(245,158,11,0.35)',
  },
  LOW: {
    background: 'rgba(6,182,212,0.10)',
    color: '#22D3EE',
    border: '1px solid rgba(6,182,212,0.30)',
  },
};

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'md' }) => {
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.LOW;
  return (
    <span style={{
      ...style,
      fontSize: size === 'sm' ? '9px' : '10px',
      fontWeight: 700,
      padding: size === 'sm' ? '2px 6px' : '3px 8px',
      borderRadius: '4px',
      letterSpacing: '0.06em',
      display: 'inline-block',
      whiteSpace: 'nowrap',
      textTransform: 'uppercase',
    }}>
      {severity}
    </span>
  );
};

interface StatusBadgeProps {
  status: string;
}

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  NEW:           { background: 'rgba(124,58,237,0.12)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.35)' },
  ACKNOWLEDGED:  { background: 'rgba(245,158,11,0.10)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.30)' },
  INVESTIGATING: { background: 'rgba(249,115,22,0.10)', color: '#FB923C', border: '1px solid rgba(249,115,22,0.30)' },
  RESOLVED:      { background: 'rgba(16,185,129,0.10)', color: '#34D399', border: '1px solid rgba(16,185,129,0.30)' },
  ACTIVE:        { background: 'rgba(124,58,237,0.12)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.35)' },
  CLOSED:        { background: 'rgba(100,116,139,0.10)', color: '#64748B', border: '1px solid rgba(100,116,139,0.25)' },
  UP:            { background: 'rgba(16,185,129,0.10)', color: '#34D399', border: '1px solid rgba(16,185,129,0.30)' },
  DOWN:          { background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.35)' },
  DEGRADED:      { background: 'rgba(245,158,11,0.10)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.30)' },
  LOADED:        { background: 'rgba(16,185,129,0.10)', color: '#34D399', border: '1px solid rgba(16,185,129,0.30)' },
  UNKNOWN:       { background: 'rgba(100,116,139,0.10)', color: '#64748B', border: '1px solid rgba(100,116,139,0.25)' },
};

const FALLBACK_STATUS: React.CSSProperties = {
  background: 'rgba(100,116,139,0.10)',
  color: '#64748B',
  border: '1px solid rgba(100,116,139,0.25)',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const style = STATUS_STYLES[status] ?? FALLBACK_STATUS;
  return (
    <span style={{
      ...style,
      fontSize: '10px',
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: '4px',
      display: 'inline-block',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {status}
    </span>
  );
};

interface ConfidenceBarProps {
  confidence: number;
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({ confidence }) => {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 85 ? '#F87171' :
    pct >= 70 ? '#FB923C' :
    pct >= 50 ? '#FCD34D' :
    '#22D3EE';
  const trackColor = 'rgba(42,37,64,0.8)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 3, background: trackColor, borderRadius: 2 }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 2,
          boxShadow: `0 0 6px ${color}55`,
        }} />
      </div>
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        color,
        minWidth: 34,
        textAlign: 'right',
        fontFamily: 'var(--font-mono)',
      }}>
        {pct}%
      </span>
    </div>
  );
};
