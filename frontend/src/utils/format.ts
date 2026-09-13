/**
 * Formatting utilities used throughout the UI.
 */
import { format, parseISO, isValid } from 'date-fns';

export function formatTimestamp(ts: string | undefined): string {
  if (!ts) return '—';
  try {
    const d = parseISO(ts);
    if (!isValid(d)) return ts;
    return format(d, 'HH:mm:ss.SSS');
  } catch {
    return ts;
  }
}

export function formatDatetime(ts: string | undefined): string {
  if (!ts) return '—';
  try {
    const d = parseISO(ts);
    if (!isValid(d)) return ts;
    return format(d, 'yyyy-MM-dd HH:mm:ss');
  } catch {
    return ts;
  }
}

export function formatIp(ip: string | undefined): string {
  return ip ?? '—';
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return (bytes / 1_073_741_824).toFixed(2) + ' GB';
  if (bytes >= 1_048_576) return (bytes / 1_048_576).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

const THREAT_CLASS_LABELS: Record<string, string> = {
  SYN_FLOOD: 'SYN Flood (DDoS)',
  PORT_SCAN: 'Port Scan',
  DNS_TUNNEL: 'DNS Tunneling / DGA',
  C2_BEACON: 'C2 Beaconing',
  DATA_EXFILTRATION: 'Data Exfiltration',
  ENCRYPTED_ANOMALY: 'Encrypted Traffic Anomaly',
};

export function formatThreatClass(cls: string): string {
  return THREAT_CLASS_LABELS[cls] ?? cls.replace(/_/g, ' ');
}

export function formatNumber(n: number, decimals = 0): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(decimals);
}

export function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}
