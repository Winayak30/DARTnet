import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchAlerts } from '../../api/client';
import { SeverityBadge } from '../../components/ui/Badges';
import { formatTimestamp } from '../../utils/format';

export default function C2Page() {
  const { data } = useQuery({
    queryKey: ['c2-alerts'],
    queryFn: () => fetchAlerts({ size: 50 }),
    refetchInterval: 5000,
    select: d => d.content.filter(a => a.threatClass === 'C2_BEACON'),
  });
  const alerts = data ?? [];

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div className="page-header" style={{ borderLeft: '4px solid #7c3aed' }}>
        <div style={{ paddingLeft: 12 }}>
          <div className="page-title">C2 Beaconing Detection</div>
          <div className="page-subtitle">Command-and-control traffic periodicity analysis</div>
        </div>
      </div>

      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'C2 Beacon Alerts', value: alerts.length, color: '#7c3aed' },
          { label: 'High Periodicity', value: alerts.filter(a => parseFloat(String(a.evidence?.periodicityScore ?? '0')) > 0.85).length, color: '#7c3aed' },
          { label: 'Avg Interval', value: alerts.length > 0 ? `${(alerts.reduce((s, a) => s + parseFloat(String(a.evidence?.meanInterArrivalMs ?? '0')), 0) / alerts.length / 1000).toFixed(0)}s` : '—', color: '#2563eb' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 16px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* C2 Beacon visualization — interval timeline */}
      {alerts.length > 0 && (
        <div style={{ padding: '0 16px 16px' }}>
          <div className="panel">
            <div className="panel-header"><span className="panel-title">Beacon Interval Pattern</span></div>
            <div style={{ padding: 20 }}>
              <BeaconTimeline alerts={alerts} />
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '0 16px 16px' }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">C2 Beacon Alerts</span></div>
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Time</th><th>Source IP</th><th>Dest IP</th><th>Mean IAT</th><th>Periodicity</th><th>Connections</th><th>Severity</th></tr>
            </thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.id}>
                  <td className="mono" style={{ fontSize: 11 }}>{a.id}</td>
                  <td style={{ fontSize: 12 }}>{formatTimestamp(a.timestamp)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.sourceIp}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.destinationIp}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.meanInterArrivalMs ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.periodicityScore ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.connectionCount ?? '—'}</td>
                  <td><SeverityBadge severity={a.severity} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {alerts.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              No C2 beaconing alerts. Start the C2 Beacon scenario.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Visual representation of beacon intervals.
 * Shows the regular pattern that indicates automated communication.
 */
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
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
        Mean interval: <strong>{(iat / 1000).toFixed(1)}s</strong> ·
        Periodicity score: <strong>{alert.evidence?.periodicityScore ?? '—'}</strong> ·
        {alert.sourceIp} → {alert.destinationIp}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', padding: '8px 0' }}>
        {intervals.map((p, i) => (
          <React.Fragment key={i}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: '#7c3aed',
                border: '2px solid #6d28d9',
                margin: '0 auto 4px',
              }} />
              <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{p.label}</div>
            </div>
            {i < intervals.length - 1 && (
              <div style={{
                flex: 1, height: 2, background: '#7c3aed', opacity: 0.4,
                minWidth: 20, maxWidth: 60,
              }} />
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
