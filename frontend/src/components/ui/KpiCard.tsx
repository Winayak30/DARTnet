import React from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  variant?: 'default' | 'critical' | 'warning' | 'healthy' | 'cyan';
  sublabel?: string;
  accentColor?: string;
}

const VARIANT_COLORS: Record<string, { border: string; glow: string; value: string }> = {
  default:  { border: '#7C3AED', glow: 'rgba(124,58,237,0.18)',  value: '#A78BFA' },
  cyan:     { border: '#06B6D4', glow: 'rgba(6,182,212,0.18)',   value: '#22D3EE' },
  critical: { border: '#EF4444', glow: 'rgba(239,68,68,0.18)',   value: '#F87171' },
  warning:  { border: '#F59E0B', glow: 'rgba(245,158,11,0.18)',  value: '#FCD34D' },
  healthy:  { border: '#10B981', glow: 'rgba(16,185,129,0.18)',  value: '#34D399' },
};

export const KpiCard: React.FC<KpiCardProps> = ({
  label, value, unit, variant = 'default', sublabel, accentColor
}) => {
  const theme = VARIANT_COLORS[variant] ?? VARIANT_COLORS.default;
  const borderColor = accentColor ?? theme.border;
  const glowColor   = accentColor ? `${accentColor}22` : theme.glow;
  const valueColor  = theme.value;

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      padding: '14px 18px',
      borderLeft: `3px solid ${borderColor}`,
      minWidth: 0,
      position: 'relative',
      overflow: 'hidden',
      transition: 'box-shadow 0.2s, transform 0.15s',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 20px ${glowColor}`;
      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      (e.currentTarget as HTMLDivElement).style.transform = 'none';
    }}
    >
      {/* Background glow streak */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 60,
        height: '100%',
        background: `linear-gradient(to left, ${glowColor}, transparent)`,
        pointerEvents: 'none',
      }} />

      {/* Label */}
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--color-text-muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        {label}
      </div>

      {/* Value row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{
          fontSize: 26,
          fontWeight: 800,
          color: valueColor,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          fontFamily: 'var(--font-mono)',
        }}>
          {typeof value === 'number' ? formatValue(value) : value}
        </span>
        {unit && (
          <span style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            marginLeft: 2,
          }}>
            {unit}
          </span>
        )}
      </div>

      {/* Sublabel */}
      {sublabel && (
        <div style={{
          fontSize: 10,
          color: 'var(--color-text-muted)',
          marginTop: 5,
        }}>
          {sublabel}
        </div>
      )}
    </div>
  );
};

function formatValue(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toFixed(v < 10 ? 1 : 0);
}
