/**
 * API client — all backend communication goes through this module.
 * On first load we do a quick health probe. If the backend is unreachable,
 * ALL subsequent calls return mock data IMMEDIATELY (no network round-trip).
 */

import axios from 'axios';
import type {
  ThreatAlert, NetworkFlow, OverviewData, SystemHealth,
  SystemMetric, ReplayState, ModelInfo, Page, FlowFeature,
} from '../types';
import {
  MOCK_ALERTS, MOCK_OVERVIEW, MOCK_HEALTH, MOCK_METRICS,
  MOCK_REPLAY, MOCK_MODELS, MOCK_FLOWS,
} from './mock';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 3000,
});

// ── Backend availability ───────────────────────────────────────────────────────
// Default: offline → mock data shown instantly.
// Silent probe runs in background; if backend responds, next refetch gets real data.

type BackendState = 'online' | 'offline';
let backendState: BackendState = 'offline'; // assume offline until proven otherwise

// Silently probe backend once — direct to port 8080 to avoid Vite proxy noise
// Flips state to 'online' only if backend actually responds
axios.get('http://localhost:8080/api/system/health', { timeout: 2000 })
  .then(() => { backendState = 'online'; })
  .catch((err) => {
    if (axios.isAxiosError(err) && err.response) backendState = 'online';
    // ECONNREFUSED = backend not running, stay offline (mock data)
  });

/** Return mock immediately, then swap to real data on next refetch once online. */
async function call<T>(fn: () => Promise<T>, mock: T): Promise<T> {
  if (backendState === 'offline') return mock;
  try {
    return await fn();
  } catch (err) {
    if (axios.isAxiosError(err) && !err.response) {
      backendState = 'offline';
      return mock;
    }
    throw err;
  }
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export const fetchOverview = (): Promise<OverviewData> =>
  call(() => api.get('/api/dashboard/overview').then(r => r.data), MOCK_OVERVIEW);

// ── Alerts ─────────────────────────────────────────────────────────────────────

export interface AlertFilter {
  page?: number;
  size?: number;
  severity?: string;
  threatClass?: string;
  status?: string;
}

export const fetchAlerts = (filter: AlertFilter = {}): Promise<Page<ThreatAlert>> =>
  call(
    () => api.get('/api/alerts', { params: filter }).then(r => r.data),
    (() => {
      let content = [...MOCK_ALERTS];
      if (filter.severity) content = content.filter(a => a.severity === filter.severity);
      if (filter.status)   content = content.filter(a => a.status   === filter.status);
      return { content, totalElements: content.length, totalPages: 1, number: 0, size: 50 };
    })()
  );

export const fetchAlert = (id: string): Promise<ThreatAlert> =>
  call(
    () => api.get(`/api/alerts/${id}`).then(r => r.data),
    MOCK_ALERTS.find(a => a.id === id) ?? MOCK_ALERTS[0]
  );

export const fetchRecentAlerts = (limit = 10): Promise<ThreatAlert[]> =>
  call(
    () => api.get('/api/alerts/recent', { params: { limit } }).then(r => r.data),
    MOCK_ALERTS.slice(0, limit)
  );

export const updateAlertStatus = (id: string, status: string): Promise<ThreatAlert> =>
  call(
    () => api.patch(`/api/alerts/${id}/status`, { status }).then(r => r.data),
    { ...(MOCK_ALERTS.find(a => a.id === id) ?? MOCK_ALERTS[0]), status: status as any }
  );

// ── Flows ──────────────────────────────────────────────────────────────────────

export const fetchFlows = (page = 0, size = 50): Promise<Page<NetworkFlow>> =>
  call(() => api.get('/api/flows', { params: { page, size } }).then(r => r.data), MOCK_FLOWS);

export const fetchFlow = (id: string): Promise<{ flow: NetworkFlow; features: FlowFeature[] }> =>
  call(
    () => api.get(`/api/flows/${id}`).then(r => r.data),
    { flow: MOCK_FLOWS.content.find(f => f.id === id) ?? MOCK_FLOWS.content[0], features: [] }
  );

// ── Replay ─────────────────────────────────────────────────────────────────────

export const startReplay = (scenario: string, speed: number): Promise<ReplayState> =>
  call(
    () => api.post('/api/replay/start', { scenario, speed }).then(r => r.data),
    { ...MOCK_REPLAY, status: 'RUNNING' as const, scenario }
  );

export const pauseReplay = (): Promise<ReplayState> =>
  call(
    () => api.post('/api/replay/pause').then(r => r.data),
    { ...MOCK_REPLAY, status: 'PAUSED' as const }
  );

export const resumeReplay = (): Promise<ReplayState> =>
  call(
    () => api.post('/api/replay/resume').then(r => r.data),
    { ...MOCK_REPLAY, status: 'RUNNING' as const }
  );

export const stopReplay = (): Promise<ReplayState> =>
  call(
    () => api.post('/api/replay/stop').then(r => r.data),
    { ...MOCK_REPLAY, status: 'STOPPED' as const }
  );

export const resetReplay = (): Promise<ReplayState> =>
  call(() => api.post('/api/replay/reset').then(r => r.data), MOCK_REPLAY);

export const fetchReplayStatus = (): Promise<ReplayState> =>
  call(() => api.get('/api/replay/status').then(r => r.data), MOCK_REPLAY);

// ── Models ─────────────────────────────────────────────────────────────────────

export const fetchModels = (): Promise<ModelInfo[]> =>
  call(() => api.get('/api/models').then(r => r.data), MOCK_MODELS);

export const fetchModel = (id: number): Promise<ModelInfo> =>
  call(
    () => api.get(`/api/models/${id}`).then(r => r.data),
    MOCK_MODELS.find(m => m.id === id) ?? MOCK_MODELS[0]
  );

// ── System ─────────────────────────────────────────────────────────────────────

export const fetchSystemHealth = (): Promise<SystemHealth> =>
  call(() => api.get('/api/system/health').then(r => r.data), MOCK_HEALTH);

export const fetchSystemMetrics = (minutes = 60): Promise<SystemMetric[]> =>
  call(() => api.get('/api/system/metrics', { params: { minutes } }).then(r => r.data), MOCK_METRICS);

// ── Reports ────────────────────────────────────────────────────────────────────

export const exportAlerts = async (format: 'JSON' | 'CSV'): Promise<void> => {
  if (backendState === 'offline') {
    const blob = new Blob(
      [format === 'JSON'
        ? JSON.stringify(MOCK_ALERTS, null, 2)
        : MOCK_ALERTS.map(a =>
            `${a.id},${a.timestamp},${a.threatClass},${a.severity},${a.sourceIp},${a.destinationIp}`
          ).join('\n')],
      { type: format === 'JSON' ? 'application/json' : 'text/csv' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `alerts_demo.${format.toLowerCase()}`; a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const response = await api.post('/api/reports/alerts/export', { format }, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement('a');
  a.href = url; a.download = format === 'CSV' ? 'alerts.csv' : 'alerts.json'; a.click();
  window.URL.revokeObjectURL(url);
};

export const generateIncidentReport = async (): Promise<void> => {
  if (backendState === 'offline') return;
  const response = await api.post('/api/reports/incidents', {}, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement('a');
  a.href = url; a.download = 'incident_report.txt'; a.click();
  window.URL.revokeObjectURL(url);
};

export default api;
