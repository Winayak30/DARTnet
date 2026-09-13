import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchAlerts } from '../../api/client';
import { SeverityBadge } from '../../components/ui/Badges';
import { formatTimestamp, formatBytes } from '../../utils/format';

export default function ExfiltrationPage() {
  const { data } = useQuery({
    queryKey: ['exfil-alerts'],
    queryFn: () => fetchAlerts({ size: 50 }),
    refetchInterval: 5000,
    select: d => d.content.filter(a => a.threatClass === 'DATA_EXFILTRATION'),
  });
  const alerts = data ?? [];

  const ratioData = alerts.slice(0, 10).map(a => ({
    id: a.id,
    ratio: a.evidence?.outboundInboundRatio ? parseFloat(String(a.evidence.outboundInboundRatio).replace(':1', '')) : 0,
    outbound: a.evidence?.outboundBytes ? parseInt(String(a.evidence.outboundBytes)) / 1024 : 0,
  }));

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div className="page-header" style={{ borderLeft: '4px solid #0891b2' }}>
        <div style={{ paddingLeft: 12 }}>
          <div className="page-title">Data Exfiltration Detection</div>
          <div className="page-subtitle">Asymmetric outbound data transfer analysis</div>
        </div>
      </div>

      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Exfil Alerts', value: alerts.length, color: '#0891b2' },
          { label: 'High Volume', value: alerts.filter(a => parseInt(String(a.evidence?.outboundBytes ?? '0')) > 10_000_000).length, color: '#dc2626' },
          { label: 'Avg Ratio', value: alerts.length > 0 ? `${(alerts.reduce((s, a) => s + parseFloat(String(a.evidence?.outboundInboundRatio ?? '0').replace(':1', '')), 0) / alerts.length).toFixed(0)}:1` : '—', color: '#0891b2' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 16px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Out/In Ratio by Alert</span></div>
          <div style={{ height: 200, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratioData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="id" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="ratio" fill="#0891b2" name="Out/In Ratio" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Outbound KB by Alert</span></div>
          <div style={{ height: 200, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratioData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="id" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="outbound" fill="#7c3aed" name="Outbound KB" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Exfiltration Alerts</span></div>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Time</th><th>Source IP</th><th>Dest IP</th><th>Outbound</th><th>Ratio</th><th>Severity</th></tr></thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.id}>
                  <td className="mono" style={{ fontSize: 11 }}>{a.id}</td>
                  <td style={{ fontSize: 12 }}>{formatTimestamp(a.timestamp)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.sourceIp}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.destinationIp}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.outboundBytes ? formatBytes(parseInt(String(a.evidence.outboundBytes))) : '—'}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.outboundInboundRatio ?? '—'}</td>
                  <td><SeverityBadge severity={a.severity} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {alerts.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>No exfiltration alerts. Start the Data Exfil scenario.</div>}
        </div>
      </div>
    </div>
  );
}
