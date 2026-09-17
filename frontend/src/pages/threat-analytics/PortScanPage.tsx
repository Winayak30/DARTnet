import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchAlerts } from '../../api/client';
import { SeverityBadge } from '../../components/ui/Badges';
import { formatTimestamp } from '../../utils/format';

const ACCENT = '#F97316';

const MODEL_STATS = [
  { label: 'Algorithm',     value: 'RandomForest' },
  { label: 'F1 Score',      value: '0.977' },
  { label: 'Precision',     value: '98.1%' },
  { label: 'False Pos Rate',value: '1.9%' },
];

const FEATURES = [
  { icon: '🔌', title: 'Port Fan-Out', desc: 'Detects single sources probing many unique destination ports in a short window' },
  { icon: '🗺️', title: 'Host Discovery', desc: 'Identifies horizontal scans across multiple destination hosts from one source' },
  { icon: '❌', title: 'Failed Connections', desc: 'High SYN-without-ACK ratio exposes stealth scanning behavior' },
];

const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1A1830', border: '1px solid #2A2540', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: '#64748B', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.fill || p.color }}>{p.name}: <strong>{p.value}</strong></div>
      ))}
    </div>
  );
};

export default function PortScanPage() {
  const { data } = useQuery({
    queryKey: ['portscan-alerts'],
    queryFn: () => fetchAlerts({ size: 50 }),
    refetchInterval: 5000,
    select: d => d.content.filter((a: any) => a.threatClass === 'PORT_SCAN'),
  });
  const alerts = data ?? [];

  const evidenceData = alerts.slice(0, 10).map((a: any) => ({
    id: a.id?.slice(-6) ?? '—',
    uniquePorts: a.evidence?.uniqueDestPorts ? parseInt(String(a.evidence.uniqueDestPorts)) : 0,
    fanOut: a.evidence?.fanOut ? parseFloat(String(a.evidence.fanOut)) : 0,
  }));

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--color-bg)' }}>
      <div className="page-header" style={{ borderLeft: `4px solid ${ACCENT}` }}>
        <div style={{ paddingLeft: 12 }}>
          <div className="page-title" style={{ color: ACCENT }}>Port Scan / Reconnaissance</div>
          <div className="page-subtitle">Systematic port sweep &amp; host discovery detection · RandomForest</div>
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
          { label: 'Port Scan Alerts', value: alerts.length },
          { label: 'High/Critical', value: (alerts as any[]).filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH').length },
          { label: 'Avg Unique Ports', value: alerts.length > 0 ? Math.round((alerts as any[]).reduce((s, a) => s + parseInt(String(a.evidence?.uniqueDestPorts ?? '0')), 0) / alerts.length) : '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT, fontFamily: 'var(--font-mono)' }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Unique Destination Ports</span></div>
          <div style={{ height: 200, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evidenceData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,37,64,0.6)" />
                <XAxis dataKey="id" tick={{ fontSize: 9, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="uniquePorts" fill={ACCENT} name="Unique Ports" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Fan-Out Ratio</span></div>
          <div style={{ height: 200, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evidenceData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,37,64,0.6)" />
                <XAxis dataKey="id" tick={{ fontSize: 9, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="fanOut" fill="#F59E0B" name="Fan-Out" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 16px 16px' }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Port Scan Alerts</span></div>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Time</th><th>Source IP</th><th>Unique Ports</th><th>Fan-Out</th><th>Conn Rate</th><th>Severity</th></tr></thead>
            <tbody>
              {(alerts as any[]).map(a => (
                <tr key={a.id} className="data-row">
                  <td className="mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{a.id}</td>
                  <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{formatTimestamp(a.timestamp)}</td>
                  <td className="ip-value">{a.sourceIp}</td>
                  <td className="mono" style={{ fontSize: 12, color: ACCENT }}>{a.evidence?.uniqueDestPorts ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.fanOut ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.connectionRate ?? '—'}</td>
                  <td><SeverityBadge severity={a.severity} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {alerts.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>No port scan alerts. Start the <strong>Port Scan</strong> scenario to see detections.</div>}
        </div>
      </div>
    </div>
  );
}
