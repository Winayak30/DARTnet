import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchAlerts } from '../../api/client';
import { SeverityBadge } from '../../components/ui/Badges';
import { formatTimestamp, formatBytes } from '../../utils/format';

const ACCENT = '#06B6D4';

const MODEL_STATS = [
  { label: 'Algorithm',     value: 'RandomForest' },
  { label: 'F1 Score',      value: '0.926' },
  { label: 'Precision',     value: '93.4%' },
  { label: 'False Pos Rate',value: '6.6%' },
];

const FEATURES = [
  { icon: '📤', title: 'Outbound Ratio', desc: 'Outbound/inbound byte ratio >10x with large total bytes triggers exfiltration detection' },
  { icon: '🎯', title: 'Dest Concentration', desc: 'Traffic concentrated to a single external destination suggests staged data transfer' },
  { icon: '⚡', title: 'Transfer Rate', desc: 'Sustained high-bandwidth outbound flows inconsistent with normal application traffic' },
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

export default function ExfiltrationPage() {
  const { data } = useQuery({
    queryKey: ['exfil-alerts'],
    queryFn: () => fetchAlerts({ size: 50 }),
    refetchInterval: 5000,
    select: d => d.content.filter((a: any) => a.threatClass === 'DATA_EXFILTRATION'),
  });
  const alerts = data ?? [];

  const ratioData = alerts.slice(0, 10).map((a: any) => ({
    id: a.id?.slice(-6) ?? '—',
    ratio: a.evidence?.outboundInboundRatio ? parseFloat(String(a.evidence.outboundInboundRatio).replace(':1', '')) : 0,
    outbound: a.evidence?.outboundBytes ? parseInt(String(a.evidence.outboundBytes)) / 1024 : 0,
  }));

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--color-bg)' }}>
      <div className="page-header" style={{ borderLeft: `4px solid ${ACCENT}` }}>
        <div style={{ paddingLeft: 12 }}>
          <div className="page-title" style={{ color: ACCENT }}>Data Exfiltration Detection</div>
          <div className="page-subtitle">Asymmetric outbound data transfer analysis · RandomForest</div>
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
          { label: 'Exfil Alerts', value: alerts.length },
          { label: 'High Volume', value: (alerts as any[]).filter(a => parseInt(String(a.evidence?.outboundBytes ?? '0')) > 10_000_000).length },
          { label: 'Avg Ratio', value: alerts.length > 0 ? `${((alerts as any[]).reduce((s, a) => s + parseFloat(String(a.evidence?.outboundInboundRatio ?? '0').replace(':1', '')), 0) / alerts.length).toFixed(0)}:1` : '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT, fontFamily: 'var(--font-mono)' }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Out/In Ratio by Alert</span></div>
          <div style={{ height: 200, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratioData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,37,64,0.6)" />
                <XAxis dataKey="id" tick={{ fontSize: 9, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="ratio" fill={ACCENT} name="Out/In Ratio" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Outbound KB by Alert</span></div>
          <div style={{ height: 200, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratioData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,37,64,0.6)" />
                <XAxis dataKey="id" tick={{ fontSize: 9, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="outbound" fill="#A78BFA" name="Outbound KB" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 16px 16px' }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Exfiltration Alerts</span></div>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Time</th><th>Source IP</th><th>Dest IP</th><th>Outbound</th><th>Ratio</th><th>Severity</th></tr></thead>
            <tbody>
              {(alerts as any[]).map(a => (
                <tr key={a.id} className="data-row">
                  <td className="mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{a.id}</td>
                  <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{formatTimestamp(a.timestamp)}</td>
                  <td className="ip-value">{a.sourceIp}</td>
                  <td className="ip-value">{a.destinationIp}</td>
                  <td className="mono" style={{ fontSize: 12, color: ACCENT }}>{a.evidence?.outboundBytes ? formatBytes(parseInt(String(a.evidence.outboundBytes))) : '—'}</td>
                  <td className="mono" style={{ fontSize: 12, color: ACCENT }}>{a.evidence?.outboundInboundRatio ?? '—'}</td>
                  <td><SeverityBadge severity={a.severity} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {alerts.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>No exfiltration alerts. Start the <strong>Data Exfil</strong> scenario.</div>}
        </div>
      </div>
    </div>
  );
}
