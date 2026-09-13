import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchSystemHealth, fetchSystemMetrics } from '../api/client';
import { StatusBadge } from '../components/ui/Badges';

export default function SystemPage() {
  const { data: health, isLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: fetchSystemHealth,
    refetchInterval: 5000,
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: () => fetchSystemMetrics(30),
    refetchInterval: 10000,
  });

  const chartData = metrics.slice(-60).map(m => ({
    time: new Date(m.recordedAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    throughput: m.throughputMbps ?? 0,
    packets: m.packetsPerSec ?? 0,
    cpu: m.cpuPercent ?? 0,
  }));

  if (isLoading) return <div style={{ padding: 40, color: 'var(--color-text-muted)' }}>Loading system status...</div>;

  const pipeline = health ? [
    { name: 'Traffic Ingestion', comp: health.trafficIngestion },
    { name: 'Flow Processor', comp: health.flowProcessor },
    { name: 'Feature Engine', comp: health.featureEngine },
    { name: 'ML Service', comp: health.mlService },
    { name: 'Threat Correlation', comp: health.threatCorrelation },
    { name: 'Alert Engine', comp: health.alertEngine },
    { name: 'WebSocket', comp: health.websocket },
    { name: 'Database', comp: health.database },
  ] : [];

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div className="page-header">
        <div className="page-title">System Health</div>
        <div className="page-subtitle">Pipeline component status, performance metrics, and resource utilization</div>
      </div>

      <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Pipeline status */}
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Detection Pipeline</span></div>
          <div style={{ padding: 12 }}>
            {pipeline.map(({ name, comp }) => (
              <div key={name} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderBottom: '1px solid var(--color-border)',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: comp?.status === 'UP' ? '#16a34a' : comp?.status === 'DOWN' ? '#dc2626' : '#d97706',
                  flexShrink: 0,
                }} />
                <span style={{ flex: 1, fontSize: 13 }}>{name}</span>
                <StatusBadge status={comp?.status ?? 'UNKNOWN'} />
                {comp?.errorState && (
                  <span style={{ fontSize: 11, color: 'var(--color-critical)' }}>{comp.errorState}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Performance */}
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Performance</span></div>
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: 13 }}>
            {[
              ['Current Throughput', `${health?.currentThroughputMbps?.toFixed(3) ?? '0.000'} Mbps`],
              ['P50 Latency', `${health?.latencyP50Ms?.toFixed(1) ?? '0'} ms`],
              ['P95 Latency', `${health?.latencyP95Ms?.toFixed(1) ?? '0'} ms`],
              ['Queue Depth', String(health?.queueDepth ?? 0)],
              ['Dropped Events', String(health?.droppedEvents ?? 0)],
              ['Alert Queue', String(health?.alertQueueSize ?? 0)],
            ].map(([label, value]) => (
              <>
                <span key={`l-${label}`} style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                <span key={`v-${label}`} style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{value}</span>
              </>
            ))}
          </div>
        </div>

        {/* Resources */}
        <div className="panel">
          <div className="panel-header"><span className="panel-title">System Resources</span></div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'CPU', value: health?.cpuPercent ?? 0, max: 100 },
              { label: 'Memory (JVM Heap)', value: health?.memoryPercent ?? 0, max: 100 },
              { label: 'Disk', value: health?.diskPercent ?? 0, max: 100 },
            ].map(r => (
              <div key={r.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{r.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.value.toFixed(1)}%</span>
                </div>
                <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4 }}>
                  <div style={{
                    width: `${Math.min(100, r.value)}%`, height: '100%',
                    background: r.value > 80 ? '#dc2626' : r.value > 60 ? '#d97706' : '#2563eb',
                    borderRadius: 4, transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Environment */}
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Environment</span></div>
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
            {[
              ['Replay Status', health?.replayStatus ?? 'STOPPED'],
              ['Scenario', health?.scenario ?? '—'],
              ['App Version', health?.appVersion ?? '—'],
              ['Dataset', health?.dataset ?? 'SYNTHETIC'],
            ].map(([label, value]) => (
              <>
                <span key={`l-${label}`} style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                <span key={`v-${label}`} style={{ fontWeight: 500 }}>{value}</span>
              </>
            ))}
          </div>
        </div>

        {/* Throughput chart */}
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-header"><span className="panel-title">Throughput History (last 30 minutes)</span></div>
          <div style={{ padding: '12px 8px', height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="throughput" stroke="#2563eb" strokeWidth={1.5} dot={false} name="Mbps" />
                <Line type="monotone" dataKey="packets" stroke="#16a34a" strokeWidth={1.5} dot={false} name="Pkt/s" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
