import React from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  variant?: 'default' | 'critical' | 'warning' | 'healthy';
  sublabel?: string;
}

const variantColors: Record<string, string> = {
  default: '#2563eb',
  critical: '#dc2626',
  warning: '#d97706',
  healthy: '#16a34a',
};

export const KpiCard: React.FC<KpiCardProps> = ({
  label, value, unit, variant = 'default', sublabel
}) => {
  const accentColor = variantColors[variant];
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--color-border)',
      borderRadius: 8,
      padding: '16px 20px',
      borderTop: `3px solid ${accentColor}`,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>
          {typeof value === 'number' ? formatValue(value) : value}
        </span>
        {unit && <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginLeft: 2 }}>{unit}</span>}
      </div>
      {sublabel && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{sublabel}</div>
      )}
    </div>
  );
};

function formatValue(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toFixed(v < 10 ? 1 : 0);
}
