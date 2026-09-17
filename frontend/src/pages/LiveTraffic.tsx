import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchSystemMetrics } from '../api/client';

export default function LiveTrafficPage() {
  const { data: metrics = [] } = useQuery({
    queryKey: ['system-metrics-live'],
    queryFn: () => fetchSystemMetrics(5),
    refetchInterval: 2000,
  });

  const chartData = metrics.slice(-60).map(m => ({
    time: new Date(m.recordedAt).toLocaleTimeString('en-US', { hour12: false }),
    packets: m.packetsPerSec ?? 0,
    throughput: m.throughputMbps ?? 0,
    flows: m.activeFlows ?? 0,
  }));

  const latest = metrics[metrics.length - 1];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="page-header">
        <div className="page-title">Live Traffic</div>
        <div className="page-subtitle">Real-time passive network traffic observation</div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Packets/sec', value: latest?.packetsPerSec?.toFixed(1) ?? '0' },
            { label: 'Throughput', value: (latest?.throughputMbps ?? 0).toFixed(3) + ' Mbps' },
            { label: 'Active Flows', value: String(latest?.activeFlows ?? 0) },
            { label: 'Threats', value: String(latest?.threatsDetected ?? 0) },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8, padding: '14px 18px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-header"><span className="panel-title">Traffic Timeline</span></div>
          <div style={{ height: 220, padding: '12px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                <Tooltip contentStyle={{ fontSize: 12, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                <Line type="monotone" dataKey="packets" stroke="#2563eb" strokeWidth={1.5} dot={false} name="Pkt/s" />
                <Line type="monotone" dataKey="throughput" stroke="#16a34a" strokeWidth={1.5} dot={false} name="Mbps" />
                <Line type="monotone" dataKey="flows" stroke="#7c3aed" strokeWidth={1.5} dot={false} name="Flows" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}>
          Start a PCAP replay to see live traffic flow. Use the scenario selector in the top bar.
        </div>
      </div>
    </div>
  );
}
