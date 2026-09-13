import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { fetchAlerts } from '../../api/client';
import { SeverityBadge } from '../../components/ui/Badges';
import { formatTimestamp } from '../../utils/format';

export default function DnsDgaPage() {
  const { data } = useQuery({
    queryKey: ['dns-alerts'],
    queryFn: () => fetchAlerts({ size: 50 }),
    refetchInterval: 5000,
    select: d => d.content.filter(a => a.threatClass === 'DNS_TUNNEL'),
  });
  const alerts = data ?? [];

  const domainData = alerts.slice(0, 10).map(a => ({
    domain: String(a.evidence?.suspiciousDomain ?? 'unknown').slice(0, 20),
    entropy: a.evidence?.domainEntropy ? parseFloat(String(a.evidence.domainEntropy)) : 0,
    queryCount: a.evidence?.queryCount ? parseInt(String(a.evidence.queryCount)) : 0,
    confidence: Math.round(a.confidence * 100),
  }));

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div className="page-header" style={{ borderLeft: '4px solid #d97706' }}>
        <div style={{ paddingLeft: 12 }}>
          <div className="page-title">DNS Tunneling / DGA Detection</div>
          <div className="page-subtitle">Algorithmically generated domain and DNS tunnel analysis</div>
        </div>
      </div>

      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'DNS/DGA Alerts', value: alerts.length, color: '#d97706' },
          { label: 'High Entropy Domains', value: alerts.filter(a => parseFloat(String(a.evidence?.domainEntropy ?? '0')) > 3.5).length, color: '#d97706' },
          { label: 'Avg Domain Entropy', value: alerts.length > 0 ? (alerts.reduce((s, a) => s + parseFloat(String(a.evidence?.domainEntropy ?? '0')), 0) / alerts.length).toFixed(2) : '—', color: '#2563eb' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 16px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Domain Entropy (higher = more suspicious)</span></div>
          <div style={{ height: 200, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={domainData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="domain" tick={{ fontSize: 8 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="entropy" fill="#d97706" name="Entropy" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Query Count per Source</span></div>
          <div style={{ height: 200, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={domainData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="domain" tick={{ fontSize: 8 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="queryCount" fill="#7c3aed" name="Query Count" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Detected DNS/DGA Alerts</span></div>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Time</th><th>Source IP</th><th>Suspicious Domain</th><th>Entropy</th><th>Query Rate</th><th>Severity</th></tr></thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.id}>
                  <td className="mono" style={{ fontSize: 11 }}>{a.id}</td>
                  <td style={{ fontSize: 12 }}>{formatTimestamp(a.timestamp)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.sourceIp}</td>
                  <td className="mono" style={{ fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(a.evidence?.suspiciousDomain ?? '—')}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.domainEntropy ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.queryRate ?? '—'}</td>
                  <td><SeverityBadge severity={a.severity} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {alerts.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>No DNS/DGA alerts. Start the DNS Tunnel scenario.</div>}
        </div>
      </div>
    </div>
  );
}
