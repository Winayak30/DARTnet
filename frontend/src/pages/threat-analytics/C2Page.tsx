import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAlerts } from '../../api/client';
import { SeverityBadge } from '../../components/ui/Badges';
import { formatTimestamp } from '../../utils/format';

const ACCENT = '#A78BFA';

const MODEL_STATS = [
  { label: 'Algorithm', value: 'XGBoost' },
  { label: 'F1 Score',  value: '0.952' },
  { label: 'Precision', value: '95.8%' },
  { label: 'False Pos Rate', value: '4.2%' },
];

const FEATURES = [
  { icon: '🕐', title: 'Periodicity Score', desc: 'Low coefficient of variation in inter-arrival times reveals clock-like automated polling' },
  { icon: '📡', title: 'Inter-arrival Timing', desc: 'C2 beacons connect at fixed intervals — variance far lower than human-initiated traffic' },
  { icon: '📦', title: 'Small Packet Ratio', desc: 'C2 keep-alive messages are tiny — high ratio of small packets is a strong indicator' },
];

export default function C2Page() {
  const { data } = useQuery({
    queryKey: ['c2-alerts'],
    queryFn: () => fetchAlerts({ size: 50 }),
    refetchInterval: 5000,
    select: d => d.content.filter((a: any) => a.threatClass === 'C2_BEACON'),
  });
  const alerts = data ?? [];

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--color-bg)' }}>
      <div className="page-header" style={{ borderLeft: `4px solid ${ACCENT}` }}>
        <div style={{ paddingLeft: 12 }}>
          <div className="page-title" style={{ color: ACCENT }}>C2 Beaconing Detection</div>
          <div className="page-subtitle">Command-and-control traffic periodicity analysis · XGBoost</div>
        </div>
      </div>

      <div style={{ padding: '14px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {MODEL_STATS.map(s => (
          <div key={s.label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderLeft: `3px solid ${ACCENT}`, borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {FEATURES.map(f => (
          <div key={f.title} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', marginBottom: 5 }}>{f.title}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { label: 'C2 Beacon Alerts', value: alerts.length },
          { label: 'High Periodicity', value: (alerts as any[]).filter(a => parseFloat(String(a.evidence?.periodicityScore ?? '0')) > 0.85).length },
          { label: 'Avg Interval', value: alerts.length > 0 ? `${((alerts as any[]).reduce((s, a) => s + parseFloat(String(a.evidence?.meanInterArrivalMs ?? '0')), 0) / alerts.length / 1000).toFixed(0)}s` : '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT, fontFamily: 'var(--font-mono)' }}>{value}</div>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div style={{ padding: '12px 16px 0' }}>
          <div className="panel">
            <div className="panel-header"><span className="panel-title">Beacon Interval Pattern</span></div>
            <div style={{ padding: 20 }}>
              <BeaconTimeline alerts={alerts as any[]} />
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '12px 16px 16px' }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">C2 Beacon Alerts</span></div>
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Time</th><th>Source IP</th><th>Dest IP</th><th>Mean IAT</th><th>Periodicity</th><th>Connections</th><th>Severity</th></tr>
            </thead>
            <tbody>
              {(alerts as any[]).map(a => (
                <tr key={a.id} className="data-row">
                  <td className="mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{a.id}</td>
                  <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{formatTimestamp(a.timestamp)}</td>
                  <td className="ip-value">{a.sourceIp}</td>
                  <td className="ip-value">{a.destinationIp}</td>
                  <td className="mono" style={{ fontSize: 12, color: ACCENT }}>{a.evidence?.meanInterArrivalMs ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 12, color: ACCENT }}>{a.evidence?.periodicityScore ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.connectionCount ?? '—'}</td>
                  <td><SeverityBadge severity={a.severity} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {alerts.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              No C2 beaconing alerts. Start the <strong>C2 Beacon</strong> scenario.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const BeaconTimeline: React.FC<{ alerts: any[] }> = ({ alerts }) => {
  const alert = alerts[0];
  if (!alert) return null;

  const iat = parseFloat(String(alert.evidence?.meanInterArrivalMs ?? '30000'));
  const count = Math.min(12, parseInt(String(alert.evidence?.connectionCount ?? '12')));
  const intervals: { t: number; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    intervals.push({ t: i, label: `${(iat * i / 1000).toFixed(0)}s` });
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
        Mean interval: <strong style={{ color: ACCENT }}>{(iat / 1000).toFixed(1)}s</strong> ·
        Periodicity: <strong style={{ color: ACCENT }}>{alert.evidence?.periodicityScore ?? '—'}</strong> ·
        <span className="ip-value" style={{ marginLeft: 4 }}>{alert.sourceIp} → {alert.destinationIp}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', padding: '8px 0' }}>
        {intervals.map((p, i) => (
          <React.Fragment key={i}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: ACCENT,
                border: `2px solid #6D28D9`,
                margin: '0 auto 4px',
                boxShadow: `0 0 6px ${ACCENT}88`,
              }} />
              <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{p.label}</div>
            </div>
            {i < intervals.length - 1 && (
              <div style={{ flex: 1, height: 2, background: ACCENT, opacity: 0.3, minWidth: 20, maxWidth: 60 }} />
            )}
          </React.Fragment>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
        Regular beacon pattern — very low interval variance indicates automated polling
      </div>
    </div>
  );
};
