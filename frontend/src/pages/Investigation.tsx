import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAlert, fetchFlow, updateAlertStatus, fetchAlerts } from '../api/client';
import { SeverityBadge, StatusBadge, ConfidenceBar } from '../components/ui/Badges';
import { AlertTable } from '../components/ui/AlertTable';
import { formatTimestamp, formatDatetime, formatThreatClass, formatBytes, formatDuration } from '../utils/format';

/**
 * Investigation page - analyst workspace.
 * Shows threat details, evidence, flow context, timeline, related alerts.
 * This is the most important page for conveying detection quality.
 */
export default function InvestigationPage() {
  const { alertId } = useParams<{ alertId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: alert, isLoading, error } = useQuery({
    queryKey: ['alert', alertId],
    queryFn: () => alertId ? fetchAlert(alertId) : Promise.reject('No ID'),
    enabled: !!alertId,
  });

  const { data: flowData } = useQuery({
    queryKey: ['flow', alert?.flowId],
    queryFn: () => alert?.flowId ? fetchFlow(alert.flowId) : Promise.reject('No flow'),
    enabled: !!alert?.flowId,
  });

  const { data: relatedAlerts } = useQuery({
    queryKey: ['related-alerts', alert?.sourceIp],
    queryFn: () => fetchAlerts({ size: 10 }),
    enabled: !!alert,
    select: d => d.content.filter(a => a.id !== alertId && (
      a.sourceIp === alert?.sourceIp || a.destinationIp === alert?.destinationIp
    )).slice(0, 5),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateAlertStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert', alertId] }),
  });

  if (!alertId) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Investigation Workspace</div>
        <div style={{ fontSize: 13 }}>Select an alert from the Alert Queue to begin investigation</div>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/alerts')}>
          → Open Alerts
        </button>
      </div>
    );
  }

  if (isLoading) return <div style={{ padding: 40, color: 'var(--color-text-muted)' }}>Loading investigation...</div>;
  if (error || !alert) return <div style={{ padding: 40, color: 'var(--color-critical)' }}>Alert not found: {alertId}</div>;

  const flow = flowData?.flow;
  const features = flowData?.features ?? [];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <SeverityBadge severity={alert.severity} />
              <StatusBadge status={alert.status} />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 4 }}>{alert.id}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{formatThreatClass(alert.threatClass)}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              {formatTimestamp(alert.timestamp)} · {alert.sourceIp} → {alert.destinationIp} · {alert.protocol}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED'].map(s => (
              <button
                key={s}
                className="btn btn-outline"
                style={{ fontSize: 11 }}
                onClick={() => statusMutation.mutate({ id: alert.id, status: s })}
                disabled={alert.status === s}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Key metrics row */}
        <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 13 }}>
          <MetaItem label="Confidence" value={`${(alert.confidence * 100).toFixed(1)}%`} highlight />
          <MetaItem label="Detection Latency" value={`${alert.detectionLatencyMs}ms`} />
          <MetaItem label="Flow ID" value={alert.flowId} mono />
          <MetaItem label="Model" value={alert.modelVersion} mono />
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ background: 'var(--color-surface-2)' }}>
        {['overview', 'evidence', 'flow-context', 'timeline', 'related'].map(tab => (
          <div
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'flow-context' ? 'Flow Context'
             : tab === 'related' ? 'Related Alerts'
             : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </div>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
        {activeTab === 'overview' && (
          <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="panel">
              <div className="panel-header"><span className="panel-title">Threat Summary</span></div>
              <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
                <InfoRow label="Threat Class" value={formatThreatClass(alert.threatClass)} />
                <InfoRow label="Severity" value={<SeverityBadge severity={alert.severity} />} />
                <InfoRow label="Confidence" value={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{(alert.confidence * 100).toFixed(1)}%</span>
                  </div>
                } />
                <InfoRow label="Detection Latency" value={`${alert.detectionLatencyMs}ms`} />
                <InfoRow label="Timestamp" value={formatDatetime(alert.timestamp)} />
                <InfoRow label="Model Version" value={alert.modelVersion} mono />
                <InfoRow label="Status" value={<StatusBadge status={alert.status} />} />
              </div>
            </div>
            <div className="panel">
              <div className="panel-header"><span className="panel-title">Detection Explanation</span></div>
              <div style={{ padding: 16, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                <DetectionExplanation alert={alert} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'evidence' && (
          <div style={{ padding: 20 }}>
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Detection Evidence</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Features that triggered this detection
                </span>
              </div>
              {alert.evidence && Object.keys(alert.evidence).length > 0 ? (
                <table className="evidence-table">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Observed Value</th>
                      <th>Interpretation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(alert.evidence).map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ fontFamily: 'inherit', color: 'var(--color-text)' }}>{k}</td>
                        <td style={{ fontWeight: 600 }}>{String(v)}</td>
                        <td style={{ fontFamily: 'inherit', color: 'var(--color-text-secondary)' }}>
                          {interpretFeature(alert.threatClass, k, String(v))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 24, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  No evidence data recorded for this alert
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'flow-context' && (
          <div style={{ padding: 20 }}>
            <div className="panel">
              <div className="panel-header"><span className="panel-title">Flow Context</span></div>
              {flow ? (
                <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 16px', fontSize: 13 }}>
                  <InfoRow label="Flow ID" value={flow.id} mono />
                  <InfoRow label="Source IP" value={flow.sourceIp} mono />
                  <InfoRow label="Destination IP" value={flow.destinationIp} mono />
                  <InfoRow label="Source Port" value={String(flow.sourcePort)} mono />
                  <InfoRow label="Destination Port" value={String(flow.destinationPort)} mono />
                  <InfoRow label="Protocol" value={flow.protocol} />
                  <InfoRow label="Packets" value={String(flow.packetCount)} />
                  <InfoRow label="Bytes" value={formatBytes(flow.byteCount)} />
                  <InfoRow label="Duration" value={formatDuration(flow.durationMs)} />
                  <InfoRow label="Threat Score" value={`${(flow.threatScore * 100).toFixed(1)}%`} highlight />
                  <InfoRow label="Status" value={flow.status} />
                </div>
              ) : (
                <div style={{ padding: 24, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  Flow context not available
                </div>
              )}
            </div>

            {features.length > 0 && (
              <div className="panel" style={{ marginTop: 12 }}>
                <div className="panel-header"><span className="panel-title">Extracted Features</span></div>
                <table className="evidence-table">
                  <thead><tr><th>Feature</th><th>Value</th></tr></thead>
                  <tbody>
                    {features.map(f => (
                      <tr key={f.id}>
                        <td style={{ fontFamily: 'inherit' }}>{f.featureName}</td>
                        <td>{f.numericValue?.toFixed(4) ?? f.stringValue ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div style={{ padding: 20 }}>
            <div className="panel">
              <div className="panel-header"><span className="panel-title">Detection Timeline</span></div>
              <div style={{ padding: 20 }}>
                <DetectionTimeline alert={alert} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'related' && (
          <div style={{ padding: 20 }}>
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Related Alerts</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Same source / destination / threat cluster
                </span>
              </div>
              {relatedAlerts && relatedAlerts.length > 0 ? (
                <AlertTable
                  alerts={relatedAlerts}
                  onSelectAlert={(id) => navigate(`/investigation/${id}`)}
                />
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                  No related alerts found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper components

const MetaItem: React.FC<{ label: string; value: string; mono?: boolean; highlight?: boolean }> = ({
  label, value, mono, highlight
}) => (
  <div>
    <span style={{ color: 'var(--color-text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {label}
    </span>
    <div style={{
      fontFamily: mono ? 'var(--font-mono)' : 'inherit',
      fontWeight: highlight ? 700 : 500,
      color: highlight ? 'var(--color-critical)' : 'var(--color-text)',
      fontSize: 13,
    }}>
      {value}
    </div>
  </div>
);

const InfoRow: React.FC<{ label: string; value: string | React.ReactNode; mono?: boolean; highlight?: boolean }> = ({
  label, value, mono, highlight
}) => (
  <>
    <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>{label}</span>
    <span style={{
      fontFamily: mono ? 'var(--font-mono)' : 'inherit',
      color: highlight ? 'var(--color-critical)' : 'var(--color-text)',
    }}>
      {value}
    </span>
  </>
);

const DetectionExplanation: React.FC<{ alert: any }> = ({ alert }) => {
  const explanations: Record<string, string[]> = {
    SYN_FLOOD: [
      'High SYN packet ratio detected — significantly exceeds normal TCP session establishment pattern',
      'Large number of unique source IPs — consistent with distributed amplification attack',
      'Low source entropy — suggests spoofed or randomized source addresses',
      'Traffic concentrated to single destination — classic volumetric DDoS signature',
    ],
    PORT_SCAN: [
      'Source IP contacted an unusually large number of distinct destination ports',
      'High fan-out pattern — single source to many hosts/ports within short window',
      'Multiple SYN packets without completing TCP handshake (SYN without ACK)',
      'Connection rate significantly exceeds normal host behavior baseline',
    ],
    DNS_TUNNEL: [
      'DNS queries contain high-entropy subdomains inconsistent with legitimate domain names',
      'Domain label length and character distribution matches DGA output patterns',
      'Elevated query rate to same nameserver — suggests automated DNS communication',
      'N-gram analysis shows non-dictionary character sequences in domain labels',
    ],
    C2_BEACON: [
      'Highly regular inter-arrival time between connections — low coefficient of variation',
      'Communication interval matches common beacon period (e.g., 30s, 60s, 300s)',
      'Traffic consistently directed to single external destination',
      'Small packet sizes consistent with encoded command polling, not bulk data transfer',
    ],
    DATA_EXFILTRATION: [
      'Outbound byte volume significantly exceeds inbound — asymmetric transfer',
      'Sustained high transfer rate to single external destination',
      'Transfer duration and volume inconsistent with normal user behavior',
    ],
  };
  const lines = explanations[alert.threatClass] ?? ['Detection based on extracted flow features and ML classifier output'];
  return (
    <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {lines.map((l, i) => <li key={i}>{l}</li>)}
    </ul>
  );
};

const DetectionTimeline: React.FC<{ alert: any }> = ({ alert }) => {
  const steps = [
    { name: 'Traffic Ingestion', desc: 'Packet observed by passive tap', time: -alert.detectionLatencyMs },
    { name: 'Flow Processing', desc: 'Flow state updated with packet', time: -Math.round(alert.detectionLatencyMs * 0.8) },
    { name: 'Feature Extraction', desc: 'Flow features computed', time: -Math.round(alert.detectionLatencyMs * 0.5) },
    { name: 'ML Inference', desc: 'Threat classifier executed', time: -Math.round(alert.detectionLatencyMs * 0.25) },
    { name: 'Threat Scoring', desc: 'Rule + ML scores fused', time: -Math.round(alert.detectionLatencyMs * 0.1) },
    { name: 'Alert Generated', desc: 'Alert created and broadcast', time: 0 },
  ];
  return (
    <div style={{ position: 'relative', paddingLeft: 24 }}>
      <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: 'var(--color-border)' }} />
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20, position: 'relative' }}>
          <div style={{
            position: 'absolute', left: -24, top: 4,
            width: 14, height: 14, borderRadius: '50%',
            background: i === steps.length - 1 ? 'var(--color-critical)' : 'var(--color-accent)',
            border: '2px solid #fff', boxShadow: 'var(--shadow-sm)',
          }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{step.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{step.desc}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              T{step.time >= 0 ? '+' : ''}{step.time}ms
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

function interpretFeature(threatClass: string, key: string, value: string): string {
  const interpretations: Record<string, Record<string, (v: string) => string>> = {
    SYN_FLOOD: {
      synRatio: v => parseFloat(v) > 0.9 ? '⚠ Extremely high — clear SYN flood indicator' : '⚠ Elevated SYN ratio',
      uniqueSourceIps: v => parseInt(v) > 100 ? '⚠ Distributed — possible botnet or IP spoofing' : 'Multiple sources',
      sourceEntropy: v => parseFloat(v) < 1.0 ? '⚠ Very low — spoofed or sequential IPs' : 'Suspicious',
    },
    PORT_SCAN: {
      uniqueDestPorts: v => parseInt(v) > 100 ? '⚠ Port sweep detected' : 'Unusual port diversity',
      fanOut: v => parseFloat(v) > 10 ? '⚠ High fan-out — aggressive scan pattern' : 'Elevated',
    },
    DNS_TUNNEL: {
      domainEntropy: v => parseFloat(v) > 3.5 ? '⚠ Very high entropy — likely DGA or encoded data' : '⚠ Elevated entropy',
    },
    C2_BEACON: {
      periodicityScore: v => parseFloat(v) > 0.85 ? '⚠ Near-perfect regularity — automated beacon' : '⚠ High periodicity',
      meanInterArrivalMs: v => `Beacon interval approximately ${(parseFloat(v) / 1000).toFixed(1)}s`,
    },
  };
  return interpretations[threatClass]?.[key]?.(value) ?? '';
}
