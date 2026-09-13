import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { fetchAlerts } from '../../api/client';
import { SeverityBadge } from '../../components/ui/Badges';
import { formatTimestamp, formatThreatClass } from '../../utils/format';

export default function DDoSPage() {
  const { data } = useQuery({
    queryKey: ['ddos-alerts'],
    queryFn: () => fetchAlerts({ size: 50 }),
    refetchInterval: 5000,
    select: d => d.content.filter(a => a.threatClass === 'SYN_FLOOD'),
  });

  const alerts = data ?? [];

  // Build evidence chart data from alerts
  const evidenceData = alerts.slice(0, 10).map(a => ({
    id: a.id,
    synRatio: a.evidence?.synRatio ? parseFloat(String(a.evidence.synRatio)) : 0,
    uniqueSrcs: a.evidence?.uniqueSourceIps ? parseInt(String(a.evidence.uniqueSourceIps)) : 0,
    confidence: Math.round(a.confidence * 100),
  }));

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div className="page-header" style={{ borderLeft: '4px solid #dc2626' }}>
        <div style={{ paddingLeft: 12 }}>
          <div className="page-title">DDoS / Flooding Detection</div>
          <div className="page-subtitle">Volumetric attack analysis — SYN floods, traffic amplification</div>
        </div>
      </div>

      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 4 }}>
        {[
          { label: 'SYN Flood Alerts', value: alerts.length, color: '#dc2626' },
          { label: 'Critical', value: alerts.filter(a => a.severity === 'CRITICAL').length, color: '#dc2626' },
          { label: 'High', value: alerts.filter(a => a.severity === 'HIGH').length, color: '#ea580c' },
          { label: 'Avg Confidence', value: alerts.length > 0 ? `${(alerts.reduce((s, a) => s + a.confidence, 0) / alerts.length * 100).toFixed(0)}%` : '—', color: '#2563eb' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 16px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">SYN Ratio by Alert</span></div>
          <div style={{ height: 200, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evidenceData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="id" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                <Tooltip formatter={(v: number) => `${(v*100).toFixed(1)}%`} />
                <Bar dataKey="synRatio" fill="#dc2626" name="SYN Ratio" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><span className="panel-title">Unique Source IPs by Alert</span></div>
          <div style={{ height: 200, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evidenceData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="id" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="uniqueSrcs" fill="#ea580c" name="Unique Src IPs" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alert table */}
      <div style={{ padding: '0 16px 16px' }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">DDoS Alerts</span></div>
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Time</th><th>Source IP</th><th>Dest IP</th><th>SYN Ratio</th><th>Unique Srcs</th><th>Severity</th><th>Confidence</th></tr>
            </thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.id}>
                  <td className="mono" style={{ fontSize: 11 }}>{a.id}</td>
                  <td style={{ fontSize: 12 }}>{formatTimestamp(a.timestamp)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.sourceIp}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.destinationIp}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.synRatio ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.uniqueSourceIps ?? '—'}</td>
                  <td><SeverityBadge severity={a.severity} size="sm" /></td>
                  <td className="mono" style={{ fontSize: 12 }}>{(a.confidence * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {alerts.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>No DDoS alerts detected. Start the DDoS SYN Flood scenario to see detections.</div>}
        </div>
      </div>
    </div>
  );
}
