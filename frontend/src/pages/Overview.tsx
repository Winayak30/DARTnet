import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { fetchOverview, fetchRecentAlerts, fetchSystemHealth, fetchSystemMetrics } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAppState } from '../store/AppContext';
import { KpiCard } from '../components/ui/KpiCard';
import { AlertTable } from '../components/ui/AlertTable';
import { SeverityBadge, StatusBadge, ConfidenceBar } from '../components/ui/Badges';
import type { ThreatAlert, WsEvent, SystemMetric } from '../types';
import { formatTimestamp, formatThreatClass, formatDuration } from '../utils/format';

const THREAT_COLORS: Record<string, string> = {
  SYN_FLOOD: '#dc2626',
  PORT_SCAN: '#ea580c',
  DNS_TUNNEL: '#d97706',
  C2_BEACON: '#7c3aed',
  DATA_EXFILTRATION: '#0891b2',
  ENCRYPTED_ANOMALY: '#4f46e5',
};

export default function Overview() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const [selectedAlert, setSelectedAlert] = useState<ThreatAlert | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<SystemMetric[]>([]);

  const { data: overview, refetch: refetchOverview } = useQuery({
    queryKey: ['overview'],
    queryFn: fetchOverview,
    refetchInterval: 5000,
  });

  const { data: recentAlerts = [], refetch: refetchAlerts } = useQuery({
    queryKey: ['recent-alerts'],
    queryFn: () => fetchRecentAlerts(20),
    refetchInterval: 5000,
  });

  const { data: systemHealth } = useQuery({
    queryKey: ['system-health'],
    queryFn: fetchSystemHealth,
    refetchInterval: 10000,
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: () => fetchSystemMetrics(15),
    refetchInterval: 10000,
  });

  // Live alerts from WebSocket
  const liveAlerts = state.recentAlerts;
  const allAlerts = liveAlerts.length > 0 ? liveAlerts : recentAlerts;

  // Metrics history for chart
  const chartData = (metrics.length > 0 ? metrics : []).slice(-60).map(m => ({
    time: new Date(m.recordedAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    packets: m.packetsPerSec ?? 0,
    throughput: m.throughputMbps ?? 0,
    threats: m.threatsDetected ?? 0,
  }));

  const threatDist = overview ? [
    { name: 'DDoS', count: overview.ddosCount, color: THREAT_COLORS.SYN_FLOOD },
    { name: 'Port Scan', count: overview.portScanCount, color: THREAT_COLORS.PORT_SCAN },
    { name: 'DNS/DGA', count: overview.dnsDgaCount, color: THREAT_COLORS.DNS_TUNNEL },
    { name: 'C2 Beacon', count: overview.c2Count, color: THREAT_COLORS.C2_BEACON },
    { name: 'Exfiltration', count: overview.exfiltrationCount, color: THREAT_COLORS.DATA_EXFILTRATION },
    { name: 'Encrypted', count: overview.encryptedCount, color: THREAT_COLORS.ENCRYPTED_ANOMALY },
  ] : [];

  const pipeline = systemHealth ? [
    { name: 'Traffic Ingestion', status: systemHealth.trafficIngestion?.status ?? 'UP' },
    { name: 'Flow Processing', status: systemHealth.flowProcessor?.status ?? 'UP' },
    { name: 'Feature Extraction', status: systemHealth.featureEngine?.status ?? 'UP' },
    { name: 'ML Detection', status: systemHealth.mlService?.status ?? 'UNKNOWN' },
    { name: 'Threat Correlation', status: systemHealth.threatCorrelation?.status ?? 'UP' },
    { name: 'Alert Engine', status: systemHealth.alertEngine?.status ?? 'UP' },
  ] : [];

  const statusColor = (s: string) => s === 'UP' ? '#16a34a' : s === 'DOWN' ? '#dc2626' : '#d97706';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-title">Security Overview</div>
        <div className="page-subtitle">
          Real-time detection of cyber threats from unidirectional IP traffic · SIH26145
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* KPI Row */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
          <KpiCard label="Flows / sec" value={overview?.flowsPerSec ?? 0} unit="/s" />
          <KpiCard label="Active Flows" value={overview?.activeFlows ?? 0} variant="default" />
          <KpiCard label="Threats Detected" value={overview?.totalThreats ?? 0} variant="warning" />
          <KpiCard label="Critical Alerts" value={overview?.criticalAlerts ?? 0} variant="critical" />
          <KpiCard label="Detection Latency" value={overview?.detectionLatencyMs ?? 0} unit="ms" variant="default" />
          <KpiCard label="Throughput" value={overview?.throughputMbps ?? 0} unit="Mbps" />
        </div>

        {/* Main content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, padding: '0 16px 12px' }}>
          {/* Left: Timeline chart */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Network & Detection Timeline</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>packets/sec & throughput</span>
            </div>
            <div style={{ padding: '12px 8px', height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#8b949e' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#8b949e' }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Line type="monotone" dataKey="packets" stroke="#2563eb" strokeWidth={1.5} dot={false} name="Pkt/s" />
                  <Line type="monotone" dataKey="throughput" stroke="#16a34a" strokeWidth={1.5} dot={false} name="Mbps" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Threat distribution */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Threat Distribution</span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {threatDist.map(t => (
                <div key={t.name} style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, flex: 1, color: 'var(--color-text)' }}>{t.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.count > 0 ? t.color : 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {t.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alert Queue + Selected Alert */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12, padding: '0 16px 12px' }}>
          {/* Alert table */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                Incident / Alert Queue
                {allAlerts.length > 0 && (
                  <span style={{ marginLeft: 8, background: '#dc2626', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>
                    {allAlerts.length}
                  </span>
                )}
              </span>
              <button
                className="btn btn-outline"
                style={{ fontSize: 11 }}
                onClick={() => navigate('/alerts')}
              >
                View All →
              </button>
            </div>
            <AlertTable
              alerts={allAlerts}
              onSelectAlert={(id) => {
                setSelectedAlert(allAlerts.find(a => a.id === id) ?? null);
              }}
              selectedId={selectedAlert?.id}
            />
          </div>

          {/* Selected alert detail panel */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Alert Detail</span>
              {selectedAlert && (
                <button
                  className="btn btn-outline"
                  style={{ fontSize: 11 }}
                  onClick={() => navigate(`/investigation/${selectedAlert.id}`)}
                >
                  Investigate →
                </button>
              )}
            </div>
            {selectedAlert ? (
              <AlertDetailPanel alert={selectedAlert} />
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                Select an alert to view details
              </div>
            )}
          </div>
        </div>

        {/* Pipeline status */}
        <div style={{ padding: '0 16px 12px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12 }}>
          <div className="panel">
            <div className="panel-header"><span className="panel-title">Detection Pipeline</span></div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {pipeline.map((step, i) => (
                <React.Fragment key={step.name}>
                  <div className="pipeline-step">
                    <div className="pipeline-step-dot" style={{ background: statusColor(step.status) }} />
                    <span className="pipeline-step-label">{step.name}</span>
                    <span style={{ fontSize: 10, color: statusColor(step.status), fontWeight: 600 }}>{step.status}</span>
                  </div>
                  {i < pipeline.length - 1 && (
                    <span style={{ color: 'var(--color-text-muted)', alignSelf: 'center', fontSize: 12 }}>→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* System resources */}
          <div className="panel">
            <div className="panel-header"><span className="panel-title">System Resources</span></div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'CPU', value: systemHealth?.cpuPercent ?? 0, max: 100 },
                { label: 'Memory', value: systemHealth?.memoryPercent ?? 0, max: 100 },
                { label: 'Alert Queue', value: systemHealth?.alertQueueSize ?? 0, max: 1000 },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, width: 70, color: 'var(--color-text-secondary)' }}>{r.label}</span>
                  <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3 }}>
                    <div style={{
                      width: `${Math.min(100, (r.value / r.max) * 100)}%`,
                      height: '100%',
                      background: r.value / r.max > 0.8 ? '#dc2626' : r.value / r.max > 0.6 ? '#d97706' : '#2563eb',
                      borderRadius: 3,
                    }} />
                  </div>
                  <span style={{ fontSize: 12, minWidth: 40, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {r.label === 'Alert Queue' ? r.value : `${r.value.toFixed(0)}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const AlertDetailPanel: React.FC<{ alert: ThreatAlert }> = ({ alert }) => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div>
      <div className="tabs">
        {['overview', 'evidence', 'flow'].map(tab => (
          <div
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </div>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SeverityBadge severity={alert.severity} />
            <StatusBadge status={alert.status} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{formatThreatClass(alert.threatClass)}</div>
          <ConfidenceBar confidence={alert.confidence} />
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
            <span>Alert ID:</span><span className="mono">{alert.id}</span>
            <span>Flow ID:</span><span className="mono">{alert.flowId}</span>
            <span>Time:</span><span>{formatTimestamp(alert.timestamp)}</span>
            <span>Latency:</span><span className="mono">{alert.detectionLatencyMs}ms</span>
            <span>Model:</span><span className="mono">{alert.modelVersion}</span>
            <span>Protocol:</span><span>{alert.protocol}</span>
          </div>
        </div>
      )}

      {activeTab === 'evidence' && (
        <div style={{ padding: 8 }}>
          {alert.evidence && Object.keys(alert.evidence).length > 0 ? (
            <table className="evidence-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Observed Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(alert.evidence).map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>{k}</td>
                    <td style={{ fontWeight: 500 }}>{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 13 }}>No evidence recorded</div>
          )}
        </div>
      )}

      {activeTab === 'flow' && (
        <div style={{ padding: 16, fontSize: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>Source IP</span>
          <span className="mono">{alert.sourceIp}</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>Destination</span>
          <span className="mono">{alert.destinationIp}</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>Protocol</span>
          <span>{alert.protocol}</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>Flow ID</span>
          <span className="mono">{alert.flowId}</span>
        </div>
      )}
    </div>
  );
};
