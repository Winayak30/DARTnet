import React from 'react';
import type { Severity } from '../../types';

interface SeverityBadgeProps {
  severity: Severity | string;
  size?: 'sm' | 'md';
}

const LABELS: Record<string, string> = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

const STYLES: Record<string, React.CSSProperties> = {
  CRITICAL: { background: 'var(--color-critical-bg)', color: 'var(--color-critical)', border: '1px solid var(--color-critical-border)' },
  HIGH:     { background: 'var(--color-high-bg)',     color: 'var(--color-high)',     border: '1px solid var(--color-high-border)' },
  MEDIUM:   { background: 'var(--color-medium-bg)',   color: 'var(--color-medium)',   border: '1px solid var(--color-medium-border)' },
  LOW:      { background: 'var(--color-low-bg)',      color: 'var(--color-low)',      border: '1px solid var(--color-low-border)' },
};

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'md' }) => {
  const style = STYLES[severity] ?? STYLES.LOW;
  return (
    <span style={{
      ...style,
      fontSize: size === 'sm' ? '10px' : '11px',
      fontWeight: 600,
      padding: size === 'sm' ? '2px 6px' : '3px 8px',
      borderRadius: '4px',
      letterSpacing: '0.04em',
      display: 'inline-block',
      whiteSpace: 'nowrap',
    }}>
      {LABELS[severity] ?? severity}
    </span>
  );
};

interface StatusBadgeProps {
  status: string;
}

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  NEW:           { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' },
  ACKNOWLEDGED:  { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' },
  INVESTIGATING: { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' },
  RESOLVED:      { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
  ACTIVE:        { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' },
  CLOSED:        { background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' },
  UP:            { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
  DOWN:          { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  DEGRADED:      { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' },
  LOADED:        { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const style = STATUS_STYLES[status] ?? { background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' };
  return (
    <span style={{
      ...style,
      fontSize: '11px',
      fontWeight: 500,
      padding: '2px 8px',
      borderRadius: '4px',
      display: 'inline-block',
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
  const color = pct >= 85 ? 'var(--color-critical)' : pct >= 70 ? 'var(--color-high)' : 'var(--color-medium)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: '#e5e7eb', borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 36 }}>{pct}%</span>
    </div>
  );
};
