import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchAlerts } from '../../api/client';
import { SeverityBadge } from '../../components/ui/Badges';
import { formatTimestamp } from '../../utils/format';

export default function PortScanPage() {
  const { data } = useQuery({
    queryKey: ['portscan-alerts'],
    queryFn: () => fetchAlerts({ size: 50 }),
    refetchInterval: 5000,
    select: d => d.content.filter(a => a.threatClass === 'PORT_SCAN'),
  });
  const alerts = data ?? [];

  const evidenceData = alerts.slice(0, 10).map(a => ({
    id: a.id,
    uniquePorts: a.evidence?.uniqueDestPorts ? parseInt(String(a.evidence.uniqueDestPorts)) : 0,
    fanOut: a.evidence?.fanOut ? parseFloat(String(a.evidence.fanOut)) : 0,
    confidence: Math.round(a.confidence * 100),
  }));

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div className="page-header" style={{ borderLeft: '4px solid #ea580c' }}>
        <div style={{ paddingLeft: 12 }}>
          <div className="page-title">Port Scan / Reconnaissance</div>
          <div className="page-subtitle">Systematic port sweep and host discovery detection</div>
        </div>
      </div>

      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Port Scan Alerts', value: alerts.length, color: '#ea580c' },
          { label: 'Critical', value: alerts.filter(a => a.severity === 'CRITICAL').length + alerts.filter(a => a.severity === 'HIGH').length, color: '#dc2626' },
          { label: 'Avg Unique Ports', value: alerts.length > 0 ? Math.round(alerts.reduce((s, a) => s + parseInt(String(a.evidence?.uniqueDestPorts ?? '0')), 0) / alerts.length) : '—', color: '#ea580c' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 16px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Unique Destination Ports</span></div>
          <div style={{ height: 200, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evidenceData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="id" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="uniquePorts" fill="#ea580c" name="Unique Ports" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Fan-Out Ratio</span></div>
          <div style={{ height: 200, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evidenceData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="id" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="fanOut" fill="#d97706" name="Fan-Out" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Port Scan Alerts</span></div>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Time</th><th>Source IP</th><th>Unique Ports</th><th>Fan-Out</th><th>Conn Rate</th><th>Severity</th></tr></thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.id}>
                  <td className="mono" style={{ fontSize: 11 }}>{a.id}</td>
                  <td style={{ fontSize: 12 }}>{formatTimestamp(a.timestamp)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.sourceIp}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.uniqueDestPorts ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.fanOut ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{a.evidence?.connectionRate ?? '—'}</td>
                  <td><SeverityBadge severity={a.severity} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {alerts.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>No port scan alerts. Start the Port Scan scenario to see detections.</div>}
        </div>
      </div>
    </div>
  );
}
