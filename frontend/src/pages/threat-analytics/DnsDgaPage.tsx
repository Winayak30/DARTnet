import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchAlerts } from '../../api/client';
import { SeverityBadge } from '../../components/ui/Badges';
import { formatTimestamp } from '../../utils/format';

const ACCENT = '#F59E0B';

const MODEL_STATS = [
  { label: 'Algorithm',     value: 'RandomForest' },
  { label: 'F1 Score',      value: '0.936' },
  { label: 'Precision',     value: '94.3%' },
  { label: 'False Pos Rate',value: '5.7%' },
];

const FEATURES = [
  { icon: '🔤', title: 'Domain Entropy', desc: 'DGA domains have high character entropy — far more random than human-readable names' },
  { icon: '📐', title: 'N-gram Anomaly', desc: 'Statistical analysis of character bigrams reveals non-word patterns in generated domains' },
  { icon: '⏱️', title: 'Query Rate', desc: 'Malware beacons generate high-frequency DNS lookups far above normal browsing patterns' },
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

export default function DnsDgaPage() {
  const { data } = useQuery({
    queryKey: ['dns-alerts'],
    queryFn: () => fetchAlerts({ size: 50 }),
    refetchInterval: 5000,
    select: d => d.content.filter((a: any) => a.threatClass === 'DNS_TUNNEL'),
  });
  const alerts = data ?? [];

  const domainData = alerts.slice(0, 10).map((a: any) => ({
    domain: String(a.evidence?.suspiciousDomain ?? 'unknown').slice(0, 12),
    entropy: a.evidence?.domainEntropy ? parseFloat(String(a.evidence.domainEntropy)) : 0,
    queryCount: a.evidence?.queryCount ? parseInt(String(a.evidence.queryCount)) : 0,
  }));

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--color-bg)' }}>
      <div className="page-header" style={{ borderLeft: `4px solid ${ACCENT}` }}>
        <div style={{ paddingLeft: 12 }}>
          <div className="page-title" style={{ color: ACCENT }}>DNS Tunneling / DGA Detection</div>
          <div className="page-subtitle">Algorithmically generated domain &amp; DNS tunnel analysis · RandomForest</div>
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
          { label: 'DNS/DGA Alerts', value: alerts.length },
          { label: 'High Entropy Domains', value: (alerts as any[]).filter(a => parseFloat(String(a.evidence?.domainEntropy ?? '0')) > 3.5).length },
          { label: 'Avg Domain Entropy', value: alerts.length > 0 ? ((alerts as any[]).reduce((s, a) => s + parseFloat(String(a.evidence?.domainEntropy ?? '0')), 0) / alerts.length).toFixed(2) : '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT, fontFamily: 'var(--font-mono)' }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Domain Entropy (higher = suspicious)</span></div>
          <div style={{ height: 200, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={domainData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,37,64,0.6)" />
                <XAxis dataKey="domain" tick={{ fontSize: 8, fill: '#64748B' }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="entropy" fill={ACCENT} name="Entropy" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Query Count per Source</span></div>
          <div style={{ height: 200, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={domainData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,37,64,0.6)" />
                <XAxis dataKey="domain" tick={{ fontSize: 8, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="queryCount" fill="#A78BFA" name="Query Count" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 16px 16px' }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Detected DNS/DGA Alerts</span></div>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Time</th><th>Source IP</th><th>Suspicious Domain</th><th>Entropy</th><th>Query Rate</th><th>Severity</th></tr></thead>
            <tbody>
              {(alerts as any[]).map(a => (
                <tr key={a.id} className="data-row">
                  <td className="mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{a.id}</td>
                  <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{formatTimestamp(a.timestamp)}</td>
                  <td className="ip-value">{a.sourceIp}</td>
                  <td className="mono" style={{ fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', color: ACCENT }}>{String(a.evidence?.suspiciousDomain ?? '—')}</td>
                  <td className="mono" style={{ fontSize: 12, color: ACCENT }}>{a.evidence?.domainEntropy ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.queryRate ?? '—'}</td>
                  <td><SeverityBadge severity={a.severity} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {alerts.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>No DNS/DGA alerts. Start the <strong>DNS Tunnel</strong> scenario.</div>}
        </div>
      </div>
    </div>
  );
}
