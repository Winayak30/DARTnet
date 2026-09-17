import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchAlerts } from '../../api/client';
import { SeverityBadge } from '../../components/ui/Badges';
import { formatTimestamp } from '../../utils/format';

const ACCENT = '#EF4444';

const MODEL_STATS = [
  { label: 'Algorithm',     value: 'RandomForest' },
  { label: 'F1 Score',      value: '0.959' },
  { label: 'Precision',     value: '96.7%' },
  { label: 'False Pos Rate',value: '3.2%' },
];

const FEATURES = [
  { icon: '⚡', title: 'SYN Ratio Analysis', desc: 'Detects abnormally high SYN-to-total-packet ratios indicating flood attacks' },
  { icon: '🌐', title: 'Source Entropy', desc: 'Measures IP source diversity — high entropy indicates distributed attack origins' },
  { icon: '📊', title: 'Flow Rate Spike', desc: 'Identifies traffic rate anomalies exceeding baseline thresholds per destination' },
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

export default function DDoSPage() {
  const { data } = useQuery({
    queryKey: ['ddos-alerts'],
    queryFn: () => fetchAlerts({ size: 50 }),
    refetchInterval: 5000,
    select: d => d.content.filter((a: any) => a.threatClass === 'SYN_FLOOD'),
  });

  const alerts = data ?? [];

  const evidenceData = alerts.slice(0, 10).map((a: any) => ({
    id: a.id?.slice(-6) ?? '—',
    synRatio: a.evidence?.synRatio ? parseFloat(String(a.evidence.synRatio)) : 0,
    uniqueSrcs: a.evidence?.uniqueSourceIps ? parseInt(String(a.evidence.uniqueSourceIps)) : 0,
    confidence: Math.round(a.confidence * 100),
  }));

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--color-bg)' }}>

      {/* ── Header ── */}
      <div className="page-header" style={{ borderLeft: `4px solid ${ACCENT}` }}>
        <div style={{ paddingLeft: 12 }}>
          <div className="page-title" style={{ color: ACCENT }}>DDoS / Flooding Detection</div>
          <div className="page-subtitle">Volumetric attack analysis — SYN floods &amp; traffic amplification · RandomForest</div>
        </div>
      </div>

      {/* ── Model stat cards ── */}
      <div style={{ padding: '14px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {MODEL_STATS.map(s => (
          <div key={s.label} style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderLeft: `3px solid ${ACCENT}`,
            borderRadius: 8,
            padding: '10px 14px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Feature cards ── */}
      <div style={{ padding: '12px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {FEATURES.map(f => (
          <div key={f.title} style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', marginBottom: 5 }}>{f.title}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* ── Live alert KPIs ── */}
      <div style={{ padding: '12px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: 'SYN Flood Alerts', value: alerts.length },
          { label: 'Critical', value: alerts.filter((a: any) => a.severity === 'CRITICAL').length },
          { label: 'High', value: alerts.filter((a: any) => a.severity === 'HIGH').length },
          { label: 'Avg Confidence', value: alerts.length > 0 ? `${(alerts.reduce((s: number, a: any) => s + a.confidence, 0) / alerts.length * 100).toFixed(0)}%` : '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT, fontFamily: 'var(--font-mono)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div style={{ padding: '12px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">SYN Ratio by Alert</span></div>
          <div style={{ height: 200, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evidenceData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,37,64,0.6)" />
                <XAxis dataKey="id" tick={{ fontSize: 9, fill: '#64748B' }} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v: number) => `${(v*100).toFixed(0)}%`} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="synRatio" fill={ACCENT} name="SYN Ratio" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Unique Source IPs</span></div>
          <div style={{ height: 200, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evidenceData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,37,64,0.6)" />
                <XAxis dataKey="id" tick={{ fontSize: 9, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="uniqueSrcs" fill="#F97316" name="Unique Src IPs" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Alert table ── */}
      <div style={{ padding: '12px 16px 16px' }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">DDoS Alerts</span></div>
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Time</th><th>Source IP</th><th>Dest IP</th><th>SYN Ratio</th><th>Unique Srcs</th><th>Severity</th><th>Confidence</th></tr>
            </thead>
            <tbody>
              {alerts.map((a: any) => (
                <tr key={a.id} className="data-row">
                  <td className="mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{a.id}</td>
                  <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{formatTimestamp(a.timestamp)}</td>
                  <td className="ip-value">{a.sourceIp}</td>
                  <td className="ip-value">{a.destinationIp}</td>
                  <td className="mono" style={{ fontSize: 12, color: ACCENT }}>{a.evidence?.synRatio ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.uniqueSourceIps ?? '—'}</td>
                  <td><SeverityBadge severity={a.severity} size="sm" /></td>
                  <td className="mono" style={{ fontSize: 12, color: ACCENT }}>{(a.confidence * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {alerts.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              No DDoS alerts detected. Start the <strong>DDoS SYN Flood</strong> scenario to see detections.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
