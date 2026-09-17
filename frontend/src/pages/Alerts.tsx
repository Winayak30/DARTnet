import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchAlerts, updateAlertStatus } from '../api/client';
import { AlertTable } from '../components/ui/AlertTable';
import { SeverityBadge, StatusBadge } from '../components/ui/Badges';

const SEVERITIES = ['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUSES = ['', 'NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED'];
const THREAT_TYPES = ['', 'SYN_FLOOD', 'PORT_SCAN', 'DNS_TUNNEL', 'C2_BEACON', 'DATA_EXFILTRATION'];

export default function AlertsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['alerts', page, severity, status],
    queryFn: () => fetchAlerts({ page, size: 50, severity: severity || undefined, status: status || undefined }),
    refetchInterval: 5000,
  });

  const alerts = data?.content ?? [];
  const totalPages = data?.totalPages ?? 1;

  const handleBulkAction = async (newStatus: string) => {
    await Promise.all(selected.map(id => updateAlertStatus(id, newStatus)));
    setSelected([]);
    refetch();
  };

  const severityCounts = {
    CRITICAL: alerts.filter(a => a.severity === 'CRITICAL').length,
    HIGH: alerts.filter(a => a.severity === 'HIGH').length,
    MEDIUM: alerts.filter(a => a.severity === 'MEDIUM').length,
    LOW: alerts.filter(a => a.severity === 'LOW').length,
  };

  const filteredAlerts = search
    ? alerts.filter(a =>
        a.sourceIp?.includes(search) ||
        a.destinationIp?.includes(search) ||
        a.threatClass?.includes(search.toUpperCase()) ||
        a.id?.includes(search)
      )
    : alerts;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="page-title">Alerts / Incident Queue</div>
        <div className="page-subtitle">Monitor, triage and manage detected security incidents</div>
      </div>

      {/* Severity summary */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        {Object.entries(severityCounts).map(([sev, count]) => (
          <div
            key={sev}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              border: '1px solid var(--color-border)',
              borderRadius: 6, cursor: 'pointer',
              background: severity === sev ? 'var(--color-surface-3)' : 'var(--color-surface-2)',
            }}
            onClick={() => setSeverity(severity === sev ? '' : sev)}
          >
            <SeverityBadge severity={sev} size="sm" />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 15 }}>{count}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        {/* Total */}
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
          Total: <strong>{data?.totalElements ?? 0}</strong>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ padding: '10px 16px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          className="filter-input"
          placeholder="Search IP, threat, alert ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 260 }}
        />
        <select className="filter-select" value={severity} onChange={e => setSeverity(e.target.value)}>
          {SEVERITIES.map(s => <option key={s} value={s}>{s || 'All Severities'}</option>)}
        </select>
        <select className="filter-select" value={status} onChange={e => setStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {selected.length > 0 && (
          <>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{selected.length} selected</span>
            <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => handleBulkAction('ACKNOWLEDGED')}>Acknowledge</button>
            <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => handleBulkAction('INVESTIGATING')}>Investigating</button>
            <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => handleBulkAction('RESOLVED')}>Resolve</button>
          </>
        )}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <AlertTable
          alerts={filteredAlerts}
          onSelectAlert={(id) => navigate(`/investigation/${id}`)}
          loading={isLoading}
        />
      </div>

      {/* Pagination */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn btn-outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Page {page + 1} of {totalPages}
        </span>
        <button className="btn btn-outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}
