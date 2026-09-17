/**
 * Mock data for standalone frontend demo (no backend required).
 * Used automatically when the backend is unreachable.
 */

import type {
  ThreatAlert, OverviewData, SystemHealth, SystemMetric,
  ReplayState, ModelInfo, Page, NetworkFlow,
} from '../types';

const now = () => new Date().toISOString();
const ago = (sec: number) => new Date(Date.now() - sec * 1000).toISOString();

export const MOCK_ALERTS: ThreatAlert[] = [
  {
    id: 'ALT-000001', timestamp: ago(12), flowId: 'FL-aa1b2c',
    threatClass: 'SYN_FLOOD', severity: 'CRITICAL', confidence: 0.94,
    sourceIp: '10.0.0.42', destinationIp: '192.168.1.10', protocol: 'TCP',
    detectionLatencyMs: 18, modelVersion: 'ml-v1',
    evidence: { mlThreatClass: 'DDoS', mlRiskScore: 91.4, synRatio: 0.91, uniqueSourceIps: 312 },
    status: 'NEW',
  },
  {
    id: 'ALT-000002', timestamp: ago(45), flowId: 'FL-cc3d4e',
    threatClass: 'DOS_ATTACK', severity: 'HIGH', confidence: 0.89,
    sourceIp: '172.16.8.14', destinationIp: '10.0.1.5', protocol: 'TCP',
    detectionLatencyMs: 21, modelVersion: 'ml-v1',
    evidence: { mlThreatClass: 'DoS', mlRiskScore: 78.2, mlExplanation: 'Sustained flow at 620 pkt/s toward port 80 for 48s, consistent with resource-exhaustion.' },
    status: 'NEW',
  },
  {
    id: 'ALT-000003', timestamp: ago(90), flowId: 'FL-ee5f6a',
    threatClass: 'PORT_SCAN', severity: 'HIGH', confidence: 0.87,
    sourceIp: '172.16.5.99', destinationIp: '10.0.1.0/24', protocol: 'TCP',
    detectionLatencyMs: 22, modelVersion: 'ml-v1',
    evidence: { mlThreatClass: 'Port Scanning', mlRiskScore: 64.1, uniqueDestPorts: 847, fanOut: 23.4 },
    status: 'INVESTIGATING',
  },
  {
    id: 'ALT-000004', timestamp: ago(130), flowId: 'FL-bb1c2d',
    threatClass: 'BRUTE_FORCE', severity: 'HIGH', confidence: 0.93,
    sourceIp: '185.220.101.34', destinationIp: '10.0.0.5', protocol: 'TCP',
    detectionLatencyMs: 16, modelVersion: 'ml-v1',
    evidence: { mlThreatClass: 'Brute Force', mlRiskScore: 82.7, mlExplanation: 'Repeated low-byte-volume connections toward port 22 at 14.2 bytes/sec, consistent with automated credential guessing.' },
    status: 'NEW',
  },
  {
    id: 'ALT-000005', timestamp: ago(180), flowId: 'FL-dd9e0f',
    threatClass: 'WEB_ATTACK', severity: 'HIGH', confidence: 0.88,
    sourceIp: '91.108.4.22', destinationIp: '10.0.0.80', protocol: 'TCP',
    detectionLatencyMs: 25, modelVersion: 'ml-v1',
    evidence: { mlThreatClass: 'Web Attacks', mlRiskScore: 74.3, mlExplanation: 'Application-layer flow toward port 80 at 320 bytes/sec, consistent with malicious HTTP-layer activity.' },
    status: 'ACKNOWLEDGED',
  },
  {
    id: 'ALT-000006', timestamp: ago(240), flowId: 'FL-ee5c7b',
    threatClass: 'C2_BEACON', severity: 'HIGH', confidence: 0.91,
    sourceIp: '192.168.2.55', destinationIp: '45.77.23.11', protocol: 'TCP',
    detectionLatencyMs: 31, modelVersion: 'ml-v1',
    evidence: { mlThreatClass: 'Bots', mlRiskScore: 77.9, periodicityScore: 0.92, meanInterArrivalMs: 30100 },
    status: 'NEW',
  },
  {
    id: 'ALT-000007', timestamp: ago(300), flowId: 'FL-ff9a1c',
    threatClass: 'DATA_EXFILTRATION', severity: 'CRITICAL', confidence: 0.96,
    sourceIp: '192.168.0.15', destinationIp: '203.0.113.42', protocol: 'TCP',
    detectionLatencyMs: 28, modelVersion: 'ml-v1',
    evidence: { outboundBytes: 52428800, outboundInboundRatio: '24:1', transferRate: 8.4 },
    status: 'INVESTIGATING',
  },
  {
    id: 'ALT-000008', timestamp: ago(450), flowId: 'FL-ff1a2b',
    threatClass: 'DNS_TUNNEL', severity: 'MEDIUM', confidence: 0.78,
    sourceIp: '10.0.3.21', destinationIp: '8.8.8.8', protocol: 'UDP',
    detectionLatencyMs: 14, modelVersion: 'ml-v1',
    evidence: { domainEntropy: 3.82, suspiciousDomain: 'xk2m9pqr4a.evil.io', queryRate: 4.2 },
    status: 'RESOLVED',
  },
];

// Generate rolling time-series metrics for the chart
function makeMetrics(count = 30): SystemMetric[] {
  const metrics: SystemMetric[] = [];
  for (let i = count; i >= 0; i--) {
    const t = Date.now() - i * 30000;
    const isAttack = i < 10;
    metrics.push({
      id: i,
      recordedAt: new Date(t).toISOString(),
      flowsPerSec: isAttack ? 120 + Math.random() * 80 : 20 + Math.random() * 15,
      packetsPerSec: isAttack ? 4200 + Math.random() * 800 : 800 + Math.random() * 200,
      throughputMbps: isAttack ? 18 + Math.random() * 6 : 3 + Math.random() * 2,
      activeFlows: isAttack ? 380 + Math.random() * 120 : 45 + Math.random() * 20,
      threatsDetected: isAttack ? Math.floor(Math.random() * 4) : 0,
      criticalAlerts: isAttack ? Math.floor(Math.random() * 2) : 0,
      latencyP50Ms: 18 + Math.random() * 8,
      latencyP95Ms: 32 + Math.random() * 14,
      queueDepth: Math.floor(Math.random() * 12),
      droppedEvents: 0,
      cpuPercent: isAttack ? 55 + Math.random() * 20 : 22 + Math.random() * 10,
      memoryPercent: 38 + Math.random() * 8,
      diskPercent: 24,
      alertQueueSize: MOCK_ALERTS.filter(a => a.status === 'NEW').length,
      replayStatus: 'STOPPED',
    });
  }
  return metrics;
}

export const MOCK_OVERVIEW: OverviewData = {
  flowsPerSec: 142.7,
  activeFlows: 418,
  totalThreats: 8,
  criticalAlerts: 2,
  detectionLatencyMs: 23,
  throughputMbps: 19.4,
  // all 7 ml-repo classes
  ddosCount: 1,
  dosCount: 1,
  portScanCount: 1,
  bruteForceCount: 1,
  webAttackCount: 1,
  c2Count: 1,
  dnsDgaCount: 1,
  exfiltrationCount: 1,
  encryptedCount: 0,
  ingestionStatus: 'UP',
  processingStatus: 'UP',
  mlServiceStatus: 'UP',
  alertEngineStatus: 'UP',
};

export const MOCK_HEALTH: SystemHealth = {
  trafficIngestion:  { name: 'Traffic Ingestion',  status: 'UP',      rate: 142.7 },
  flowProcessor:     { name: 'Flow Processor',     status: 'UP',      rate: 138.2 },
  featureEngine:     { name: 'Feature Engine',     status: 'UP',      latencyMs: 4 },
  mlService:         { name: 'ML Service',         status: 'UP',      latencyMs: 18 },
  threatCorrelation: { name: 'Threat Correlation', status: 'UP' },
  alertEngine:       { name: 'Alert Engine',       status: 'UP' },
  websocket:         { name: 'WebSocket',          status: 'UP' },
  database:          { name: 'Database',           status: 'UP' },
  currentThroughputMbps: 19.4,
  peakThroughputMbps: 24.1,
  avgThroughputMbps: 11.3,
  latencyP50Ms: 23,
  latencyP95Ms: 41,
  queueDepth: 3,
  droppedEvents: 0,
  cpuPercent: 47,
  memoryPercent: 42,
  diskPercent: 24,
  alertQueueSize: 2,
  replayStatus: 'STOPPED',
  appVersion: '1.0.0-SIH26145',
  throughputHistory: [],
};

export const MOCK_METRICS: SystemMetric[] = makeMetrics(30);

export const MOCK_REPLAY: ReplayState = {
  status: 'STOPPED',
  speedMultiplier: 1,
  flowsProcessed: 0,
  packetsProcessed: 0,
};

export const MOCK_MODELS: ModelInfo[] = [
  {
    id: 1, name: 'dartnet-unified', version: 'ml-v1',
    modelType: 'RandomForestClassifier + IsolationForest',
    threatClass: 'UNIFIED', dataset: 'CICIDS2017', isActive: true,
    createdAt: ago(86400 * 7), status: 'LOADED',
    features: [
      'Destination Port','Flow Duration','Total Fwd Packets','Flow Bytes/s','Flow Packets/s',
      'Flow IAT Mean','Flow IAT Std','Fwd Packet Length Mean','ACK Flag Count','FIN Flag Count',
      '... 42 more CICFlowMeter features',
    ],
    metrics: { accuracy: 0.9968, weighted_f1: 0.9975, macro_f1: 0.909, trained_rows: 2014144 },
    description: 'Unified threat classifier trained on 2.5M CICIDS2017 flows. Detects 7 classes: DDoS, DoS, Port Scanning, Brute Force, Web Attacks, Bots/C2, and Normal Traffic.',
    limitations: 'Bot/C2 class F1 is 39% due to class imbalance in CICIDS2017. DNS tunnel detection uses rule-based fallback (CICIDS2017 has no DNS metadata). Validate against real-world traffic before production.',
  },
];

export const MOCK_FLOWS: Page<NetworkFlow> = {
  content: MOCK_ALERTS.map((a, i) => ({
    id: a.flowId,
    flowStart: a.timestamp,
    sourceIp: a.sourceIp,
    destinationIp: a.destinationIp,
    sourcePort: 50000 + i,
    destinationPort: [80, 443, 53, 22, 8080][i % 5],
    protocol: a.protocol,
    packetCount: 100 + i * 50,
    byteCount: 50000 + i * 10000,
    durationMs: 1200 + i * 300,
    threatScore: a.confidence,
    threatType: a.threatClass,
    status: 'COMPLETED',
  })),
  totalElements: 6,
  totalPages: 1,
  number: 0,
  size: 50,
};
