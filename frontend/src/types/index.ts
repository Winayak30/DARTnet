/**
 * Canonical TypeScript types shared across the entire frontend.
 * These MUST match the Java DTOs exactly.
 * SIH26145 - DARTNet
 */

// ── Alert schema (canonical) ──────────────────────────────────────────────────

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type AlertStatus = 'NEW' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED';
export type ThreatClass =
  | 'SYN_FLOOD'         // model: DDoS
  | 'PORT_SCAN'         // model: Port Scanning
  | 'DOS_ATTACK'        // model: DoS
  | 'C2_BEACON'         // model: Bots (beaconing) + rule-based C2
  | 'BRUTE_FORCE'       // model: Brute Force
  | 'WEB_ATTACK'        // model: Web Attacks
  | 'DNS_TUNNEL'        // rule-based (CICIDS2017 has no DNS metadata)
  | 'DATA_EXFILTRATION' // rule-based exfil
  | 'ENCRYPTED_ANOMALY';// rule-based encrypted (kept for compat)

export interface ThreatAlert {
  id: string;
  timestamp: string;
  flowId: string;
  threatClass: ThreatClass | string;
  severity: Severity;
  confidence: number;
  sourceIp: string;
  destinationIp: string;
  protocol: string;
  detectionLatencyMs: number;
  modelVersion: string;
  evidence: Record<string, string | number>;
  status: AlertStatus;
}

// ── Flow ─────────────────────────────────────────────────────────────────────

export interface NetworkFlow {
  id: string;
  flowStart: string;
  flowEnd?: string;
  sourceIp: string;
  destinationIp: string;
  sourcePort: number;
  destinationPort: number;
  protocol: string;
  packetCount: number;
  byteCount: number;
  durationMs: number;
  threatScore: number;
  threatType?: string;
  status: string;
}

export interface FlowFeature {
  id: number;
  flowId: string;
  featureName: string;
  numericValue?: number;
  stringValue?: string;
}

// ── Overview ─────────────────────────────────────────────────────────────────

export interface OverviewData {
  flowsPerSec: number;
  activeFlows: number;
  totalThreats: number;
  criticalAlerts: number;
  detectionLatencyMs: number;
  throughputMbps: number;
  // ml-repo 7 classes
  ddosCount: number;
  dosCount: number;
  portScanCount: number;
  bruteForceCount: number;
  webAttackCount: number;
  c2Count: number;
  dnsDgaCount: number;
  exfiltrationCount: number;
  encryptedCount: number;
  ingestionStatus: string;
  processingStatus: string;
  mlServiceStatus: string;
  alertEngineStatus: string;
}

// ── System ───────────────────────────────────────────────────────────────────

export interface ComponentHealth {
  name: string;
  status: 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN';
  rate?: number;
  latencyMs?: number;
  errorState?: string;
}

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export interface SystemHealth {
  trafficIngestion: ComponentHealth;
  flowProcessor: ComponentHealth;
  featureEngine: ComponentHealth;
  mlService: ComponentHealth;
  threatCorrelation: ComponentHealth;
  alertEngine: ComponentHealth;
  websocket: ComponentHealth;
  database: ComponentHealth;
  currentThroughputMbps: number;
  peakThroughputMbps: number;
  avgThroughputMbps: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  queueDepth: number;
  droppedEvents: number;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  alertQueueSize: number;
  dataset?: string;
  scenario?: string;
  replayStatus: string;
  modelVersion?: string;
  appVersion: string;
  throughputHistory: MetricPoint[];
  latencyHistory?: MetricPoint[];
}

export interface SystemMetric {
  id: number;
  recordedAt: string;
  flowsPerSec: number;
  packetsPerSec: number;
  throughputMbps: number;
  activeFlows: number;
  threatsDetected: number;
  criticalAlerts: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  queueDepth: number;
  droppedEvents: number;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  alertQueueSize: number;
  replayStatus: string;
}

// ── Replay ───────────────────────────────────────────────────────────────────

export type ReplayStatus = 'STOPPED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR';

export interface ReplayState {
  sessionId?: number;
  scenario?: string;
  status: ReplayStatus;
  speedMultiplier: number;
  flowsProcessed: number;
  packetsProcessed: number;
  bytesProcessed?: number;
  startedAt?: string;
  progressPercent?: number;
  errorMessage?: string;
}

// ── Model Registry ───────────────────────────────────────────────────────────

export interface ModelInfo {
  id: number;
  name: string;
  version: string;
  modelType: string;
  threatClass: string;
  dataset: string;
  features: string[];
  metrics: Record<string, number>;
  isActive: boolean;
  createdAt: string;
  status: string;
  description?: string;
  validationStrategy?: string;
  limitations?: string;
}

// ── WebSocket events ─────────────────────────────────────────────────────────

export type WsEventType =
  | 'ALERT_CREATED'
  | 'ALERT_UPDATED'
  | 'TRAFFIC_UPDATE'
  | 'SYSTEM_UPDATE'
  | 'REPLAY_UPDATE'
  | 'PIPELINE_UPDATE';

export interface WsEvent<T = unknown> {
  eventType: WsEventType;
  timestamp: string;
  payload: T;
}

// ── Pagination ───────────────────────────────────────────────────────────────

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// ── Traffic Source ───────────────────────────────────────────────────────────

export interface TrafficSource {
  id: number;
  name: string;
  sourceType: 'PCAP' | 'SIMULATED' | 'LIVE';
  description?: string;
}

// ── Scenario definitions ─────────────────────────────────────────────────────

export interface Scenario {
  id: string;
  name: string;
  description: string;
  threatTypes: ThreatClass[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'DDOS_SYN_FLOOD',
    name: 'DDoS SYN Flood',
    description: 'High-volume SYN flood from distributed sources targeting single host',
    threatTypes: ['SYN_FLOOD'],
  },
  {
    id: 'PORT_SCAN',
    name: 'Port Scan / Reconnaissance',
    description: 'Sequential port scanning and host discovery',
    threatTypes: ['PORT_SCAN'],
  },
  {
    id: 'DNS_DGA',
    name: 'DNS Tunneling / DGA',
    description: 'DNS tunneling with algorithmically generated domain queries',
    threatTypes: ['DNS_TUNNEL'],
  },
  {
    id: 'C2_BEACON',
    name: 'C2 Beaconing',
    description: 'Periodic command-and-control beaconing with regular intervals',
    threatTypes: ['C2_BEACON'],
  },
  {
    id: 'DATA_EXFIL',
    name: 'Data Exfiltration',
    description: 'Asymmetric outbound data transfer to external host',
    threatTypes: ['DATA_EXFILTRATION'],
  },
  {
    id: 'MIXED',
    name: 'Mixed Threat Scenario',
    description: 'Combined attack scenario with multiple threat types',
    threatTypes: ['SYN_FLOOD', 'PORT_SCAN', 'C2_BEACON'],
  },
];
