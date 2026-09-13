/**
 * API client - all backend communication goes through this module.
 * Frontend NEVER accesses PostgreSQL directly.
 */

import axios from 'axios';
import type {
  ThreatAlert, NetworkFlow, OverviewData, SystemHealth,
  SystemMetric, ReplayState, ModelInfo, Page, FlowFeature
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const fetchOverview = (): Promise<OverviewData> =>
  api.get('/api/dashboard/overview').then(r => r.data);

// ── Alerts ────────────────────────────────────────────────────────────────────

export interface AlertFilter {
  page?: number;
  size?: number;
  severity?: string;
  threatClass?: string;
  status?: string;
}

export const fetchAlerts = (filter: AlertFilter = {}): Promise<Page<ThreatAlert>> =>
  api.get('/api/alerts', { params: filter }).then(r => r.data);

export const fetchAlert = (id: string): Promise<ThreatAlert> =>
  api.get(`/api/alerts/${id}`).then(r => r.data);

export const fetchRecentAlerts = (limit = 10): Promise<ThreatAlert[]> =>
  api.get('/api/alerts/recent', { params: { limit } }).then(r => r.data);

export const updateAlertStatus = (id: string, status: string): Promise<ThreatAlert> =>
  api.patch(`/api/alerts/${id}/status`, { status }).then(r => r.data);

// ── Flows ─────────────────────────────────────────────────────────────────────

export const fetchFlows = (page = 0, size = 50): Promise<Page<NetworkFlow>> =>
  api.get('/api/flows', { params: { page, size } }).then(r => r.data);

export const fetchFlow = (id: string): Promise<{ flow: NetworkFlow; features: FlowFeature[] }> =>
  api.get(`/api/flows/${id}`).then(r => r.data);

// ── Replay ────────────────────────────────────────────────────────────────────

export const startReplay = (scenario: string, speed: number): Promise<ReplayState> =>
  api.post('/api/replay/start', { scenario, speed }).then(r => r.data);

export const pauseReplay = (): Promise<ReplayState> =>
  api.post('/api/replay/pause').then(r => r.data);

export const resumeReplay = (): Promise<ReplayState> =>
  api.post('/api/replay/resume').then(r => r.data);

export const stopReplay = (): Promise<ReplayState> =>
  api.post('/api/replay/stop').then(r => r.data);

export const resetReplay = (): Promise<ReplayState> =>
  api.post('/api/replay/reset').then(r => r.data);

export const fetchReplayStatus = (): Promise<ReplayState> =>
  api.get('/api/replay/status').then(r => r.data);

// ── Models ────────────────────────────────────────────────────────────────────

export const fetchModels = (): Promise<ModelInfo[]> =>
  api.get('/api/models').then(r => r.data);

export const fetchModel = (id: number): Promise<ModelInfo> =>
  api.get(`/api/models/${id}`).then(r => r.data);

// ── System ────────────────────────────────────────────────────────────────────

export const fetchSystemHealth = (): Promise<SystemHealth> =>
  api.get('/api/system/health').then(r => r.data);

export const fetchSystemMetrics = (minutes = 60): Promise<SystemMetric[]> =>
  api.get('/api/system/metrics', { params: { minutes } }).then(r => r.data);

// ── Reports ───────────────────────────────────────────────────────────────────

export const exportAlerts = async (format: 'JSON' | 'CSV'): Promise<void> => {
  const response = await api.post('/api/reports/alerts/export',
    { format }, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = format === 'CSV' ? 'alerts.csv' : 'alerts.json';
  link.click();
  window.URL.revokeObjectURL(url);
};

export const generateIncidentReport = async (): Promise<void> => {
  const response = await api.post('/api/reports/incidents', {}, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'incident_report.txt';
  link.click();
  window.URL.revokeObjectURL(url);
};

export default api;
