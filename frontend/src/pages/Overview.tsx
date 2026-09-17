import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import { fetchOverview, fetchRecentAlerts, fetchSystemHealth, fetchSystemMetrics } from '../api/client';
import { useAppState } from '../store/AppContext';
import { KpiCard } from '../components/ui/KpiCard';
import { AlertTable } from '../components/ui/AlertTable';
import { SeverityBadge, StatusBadge, ConfidenceBar } from '../components/ui/Badges';
import type { ThreatAlert } from '../types';
import { formatTimestamp, formatThreatClass } from '../utils/format';

// Threat level score: 0-100 derived from active threats + critical count
function computeThreatLevel(totalThreats: number, criticalAlerts: number): number {
  if (totalThreats === 0) return 0;
  const base = Math.min(60, (totalThreats / 50) * 60);
  const crit = Math.min(40, criticalAlerts * 8);
  return Math.round(Math.min(100, base + crit));
}

function threatLevelColor(score: number): string {
  if (score >= 75) return '#EF4444';
  if (score >= 50) return '#F59E0B';
  if (score >= 25) return '#06B6D4';
  return '#10B981';
}

function threatLevelLabel(score: number): string {
  if (score >= 75) return 'HIGH RISK';
  if (score >= 50) return 'ELEVATED';
  if (score >= 25) return 'MODERATE';
  return 'LOW';
}

const THREAT_COLORS: Record<string, string> = {
  SYN_FLOOD:         '#EF4444',  // red     — DDoS
  DOS_ATTACK:        '#F87171',  // light red — DoS
  PORT_SCAN:         '#F97316',  // orange  — Port Scanning
  BRUTE_FORCE:       '#FB923C',  // light orange — Brute Force
  WEB_ATTACK:        '#FBBF24',  // amber   — Web Attacks
  DNS_TUNNEL:        '#F59E0B',  // yellow  — DNS/DGA
  C2_BEACON:         '#A78BFA',  // purple  — C2 / Bots
  DATA_EXFILTRATION: '#06B6D4',  // cyan    — Exfiltration
  ENCRYPTED_ANOMALY: '#8B5CF6',  // violet  — Encrypted
};

export default function Overview() {
  const navigate = useNavigate();
  const { state } = useAppState();
  const [selectedAlert, setSelectedAlert] = useState<ThreatAlert | null>(null);

  const { data: overview } = useQuery({
    queryKey: ['overview'],
    queryFn: fetchOverview,
    refetchInterval: 5000,
  });

  const { data: recentAlerts = [] } = useQuery({
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

  const liveAlerts = state.recentAlerts;
  const allAlerts  = liveAlerts.length > 0 ? liveAlerts : recentAlerts;

  const chartData = metrics.slice(-60).map(m => ({
    time: new Date(m.recordedAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    packets:    m.packetsPerSec   ?? 0,
    throughput: m.throughputMbps  ?? 0,
    threats:    m.threatsDetected ?? 0,
  }));

  const threatDist = overview ? [
    { name: 'DDoS',          count: overview.ddosCount,         color: THREAT_COLORS.SYN_FLOOD },
    { name: 'DoS',           count: overview.dosCount,          color: THREAT_COLORS.DOS_ATTACK },
    { name: 'Port Scan',     count: overview.portScanCount,     color: THREAT_COLORS.PORT_SCAN },
    { name: 'Brute Force',   count: overview.bruteForceCount,   color: THREAT_COLORS.BRUTE_FORCE },
    { name: 'Web Attacks',   count: overview.webAttackCount,    color: THREAT_COLORS.WEB_ATTACK },
    { name: 'C2 / Bots',     count: overview.c2Count,           color: THREAT_COLORS.C2_BEACON },
    { name: 'DNS/DGA',       count: overview.dnsDgaCount,       color: THREAT_COLORS.DNS_TUNNEL },
    { name: 'Exfiltration',  count: overview.exfiltrationCount, color: THREAT_COLORS.DATA_EXFILTRATION },
  ] : [];

  const pipeline = systemHealth ? [
    { name: 'Traffic Ingest',  status: systemHealth.trafficIngestion?.status   ?? 'UP' },
    { name: 'Flow Assembly',   status: systemHealth.flowProcessor?.status       ?? 'UP' },
    { name: 'Feature Extract', status: systemHealth.featureEngine?.status       ?? 'UP' },
    { name: 'ML Inference',    status: systemHealth.mlService?.status           ?? 'UNKNOWN' },
    { name: 'Threat Correlate',status: systemHealth.threatCorrelation?.status   ?? 'UP' },
    { name: 'Alert Engine',    status: systemHealth.alertEngine?.status         ?? 'UP' },
  ] : [];

  const statusDotColor = (s: string) =>
    s === 'UP' ? '#10B981' : s === 'DOWN' ? '#EF4444' : '#F59E0B';

  const threatScore = computeThreatLevel(overview?.totalThreats ?? 0, overview?.criticalAlerts ?? 0);
  const gaugeColor  = threatLevelColor(threatScore);
  const gaugeData   = [{ name: 'threat', value: threatScore, fill: gaugeColor }];

  // Custom tooltip for dark charts
  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: '#1A1830',
        border: '1px solid #2A2540',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 12,
      }}>
        <div style={{ color: '#64748B', marginBottom: 4 }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ color: p.color, fontFamily: 'var(--font-mono)' }}>
            {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg)' }}>

      {/* ── Page header ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Security Overview</div>
          <div className="page-subtitle">
            Real-time AI threat detection · Passive one-way traffic · SIH26145
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: state.wsConnected ? '#10B981' : '#EF4444', display: 'inline-block' }} />
          {state.wsConnected ? 'Live feed active' : 'Feed offline'}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Row 1: 4 KPI cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <KpiCard
            label="Threats Detected"
            value={overview?.totalThreats ?? 0}
            variant="critical"
            sublabel="all time"
          />
          <KpiCard
            label="Critical Alerts"
            value={overview?.criticalAlerts ?? 0}
            variant="critical"
            accentColor="#EF4444"
            sublabel="unresolved"
          />
          <KpiCard
            label="Detection Latency"
            value={overview?.detectionLatencyMs ?? 0}
            unit="ms"
            variant="cyan"
            sublabel="avg p50"
          />
          <KpiCard
            label="Flows / sec"
            value={overview?.flowsPerSec ?? 0}
            unit="/s"
            variant="default"
            sublabel={`${overview?.activeFlows ?? 0} active`}
          />
        </div>

        {/* ── Row 2: Telemetry + Threat Level gauge ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 12 }}>

          {/* Telemetry chart */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Network Telemetry</span>
              <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
                <span style={{ color: '#06B6D4' }}>━ Packets/sec</span>
                <span style={{ color: '#A78BFA' }}>━ Throughput Mbps</span>
              </div>
            </div>
            <div style={{ padding: '10px 8px 8px', height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradPurple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A78BFA" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#A78BFA" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,37,64,0.6)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    interval="preserveStartEnd"
                    axisLine={{ stroke: '#2A2540' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    axisLine={{ stroke: '#2A2540' }}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="packets"
                    stroke="#06B6D4"
                    strokeWidth={2}
                    fill="url(#gradCyan)"
                    dot={false}
                    name="Pkt/s"
                  />
                  <Area
                    type="monotone"
                    dataKey="throughput"
                    stroke="#A78BFA"
                    strokeWidth={2}
                    fill="url(#gradPurple)"
                    dot={false}
                    name="Mbps"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Threat Level gauge */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 12px' }}>
            <div className="panel-title" style={{ marginBottom: 8 }}>Threat Level</div>
            <div style={{ position: 'relative', width: 160, height: 110 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="100%"
                  innerRadius="60%"
                  outerRadius="100%"
                  startAngle={180}
                  endAngle={0}
                  data={gaugeData}
                  barSize={14}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar
                    background={{ fill: 'rgba(42,37,64,0.6)' }}
                    dataKey="value"
                    cornerRadius={6}
                    angleAxisId={0}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              {/* Score label in center */}
              <div style={{
                position: 'absolute',
                bottom: 4,
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: gaugeColor,
                  lineHeight: 1,
                  fontFamily: 'var(--font-mono)',
                  textShadow: `0 0 12px ${gaugeColor}66`,
                }}>
                  {threatScore}
                </div>
                <div style={{ fontSize: 9, color: gaugeColor, fontWeight: 700, letterSpacing: '0.08em', marginTop: 2 }}>
                  {threatLevelLabel(threatScore)}
                </div>
              </div>
            </div>

            {/* Threat distribution mini list */}
            <div style={{ width: '100%', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {threatDist.map(t => (
                <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.color, flexShrink: 0, boxShadow: `0 0 4px ${t.color}` }} />
                  <span style={{ fontSize: 11, flex: 1, color: 'var(--color-text-muted)' }}>{t.name}</span>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: t.count > 0 ? t.color : 'var(--color-text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {t.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Row 3: Alert table + Detail ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12 }}>
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Incident Queue
                {allAlerts.length > 0 && (
                  <span style={{
                    background: '#EF4444',
                    color: '#fff',
                    borderRadius: 10,
                    padding: '1px 7px',
                    fontSize: 10,
                    fontWeight: 700,
                  }}>
                    {allAlerts.length}
                  </span>
                )}
              </span>
              <button className="btn btn-outline" style={{ fontSize: 11 }} onClick={() => navigate('/alerts')}>
                View All →
              </button>
            </div>
            <AlertTable
              alerts={allAlerts}
              onSelectAlert={(id) => setSelectedAlert(allAlerts.find(a => a.id === id) ?? null)}
              selectedId={selectedAlert?.id}
            />
          </div>

          {/* Alert detail panel */}
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
              <div style={{
                padding: 32,
                textAlign: 'center',
                color: 'var(--color-text-muted)',
                fontSize: 12,
              }}>
                <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }}>⚠</div>
                Select an alert to view details
              </div>
            )}
          </div>
        </div>

        {/* ── Row 4: Pipeline + Resources ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 12 }}>
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Detection Pipeline</span>
              <span style={{ fontSize: 10, color: 'var(--color-healthy)' }}>● Operational</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {pipeline.map((step, i) => (
                <React.Fragment key={step.name}>
                  <div className="pipeline-step">
                    <div className="pipeline-step-dot" style={{
                      background: statusDotColor(step.status),
                      boxShadow: `0 0 5px ${statusDotColor(step.status)}`,
                    }} />
                    <span className="pipeline-step-label">{step.name}</span>
                    <span style={{
                      fontSize: 9,
                      color: statusDotColor(step.status),
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                    }}>
                      {step.status}
                    </span>
                  </div>
                  {i < pipeline.length - 1 && (
                    <span style={{ color: 'var(--color-border-strong)', fontSize: 12 }}>→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* System resources */}
          <div className="panel">
            <div className="panel-header"><span className="panel-title">System Resources</span></div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'CPU',         value: systemHealth?.cpuPercent    ?? 0, max: 100,  unit: '%' },
                { label: 'Memory',      value: systemHealth?.memoryPercent ?? 0, max: 100,  unit: '%' },
                { label: 'Alert Queue', value: systemHealth?.alertQueueSize ?? 0, max: 1000, unit: '' },
              ].map(r => {
                const pct = Math.min(100, (r.value / r.max) * 100);
                const barColor = pct > 80 ? '#EF4444' : pct > 60 ? '#F59E0B' : '#06B6D4';
                return (
                  <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, width: 72, color: 'var(--color-text-muted)', flexShrink: 0 }}>{r.label}</span>
                    <div style={{ flex: 1, height: 4, background: 'rgba(42,37,64,0.8)', borderRadius: 2 }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: barColor,
                        borderRadius: 2,
                        boxShadow: `0 0 6px ${barColor}55`,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <span style={{
                      fontSize: 11,
                      minWidth: 38,
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      color: barColor,
                      fontWeight: 600,
                    }}>
                      {r.label === 'Alert Queue' ? r.value : `${r.value.toFixed(0)}${r.unit}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Alert detail panel ──
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
            {tab}
          </div>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SeverityBadge severity={alert.severity} />
            <StatusBadge status={alert.status} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
            {formatThreatClass(alert.threatClass)}
          </div>
          <ConfidenceBar confidence={alert.confidence} />
          <div style={{
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '5px 10px',
          }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Alert ID</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--color-accent-cyan)' }}>{alert.id}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>Flow ID</span>
            <span className="mono" style={{ fontSize: 11 }}>{alert.flowId}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>Time</span>
            <span style={{ fontSize: 11 }}>{formatTimestamp(alert.timestamp)}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>Latency</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--color-accent-cyan)' }}>{alert.detectionLatencyMs}ms</span>
            <span style={{ color: 'var(--color-text-muted)' }}>Model</span>
            <span className="mono" style={{ fontSize: 11 }}>{alert.modelVersion}</span>
          </div>
        </div>
      )}

      {activeTab === 'evidence' && (
        <div style={{ padding: 6 }}>
          {alert.evidence && Object.keys(alert.evidence).length > 0 ? (
            <table className="evidence-table">
              <thead>
                <tr><th>Feature</th><th>Value</th></tr>
              </thead>
              <tbody>
                {Object.entries(alert.evidence).map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ color: 'var(--color-text-muted)', fontFamily: 'inherit' }}>{k}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-accent-cyan)' }}>{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 12 }}>No evidence recorded</div>
          )}
        </div>
      )}

      {activeTab === 'flow' && (
        <div style={{ padding: 14, fontSize: 12, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 10px' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Source IP</span>
          <span className="ip-value">{alert.sourceIp}</span>
          <span style={{ color: 'var(--color-text-muted)' }}>Destination</span>
          <span className="ip-value">{alert.destinationIp}</span>
          <span style={{ color: 'var(--color-text-muted)' }}>Protocol</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{alert.protocol}</span>
          <span style={{ color: 'var(--color-text-muted)' }}>Flow ID</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{alert.flowId}</span>
        </div>
      )}
    </div>
  );
};
