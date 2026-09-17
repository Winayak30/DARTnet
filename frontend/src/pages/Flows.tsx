import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchFlows } from '../api/client';
import { StatusBadge } from '../components/ui/Badges';
import { formatTimestamp, formatBytes, formatDuration } from '../utils/format';

export default function FlowsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['flows', page],
    queryFn: () => fetchFlows(page, 50),
    refetchInterval: 5000,
  });

  const flows = data?.content ?? [];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="page-title">Network Flows</div>
        <div className="page-subtitle">Reconstructed flow records from passive traffic observation</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Flow ID</th>
              <th>Time</th>
              <th>Source IP</th>
              <th>Destination IP</th>
              <th>Src Port</th>
              <th>Dst Port</th>
              <th>Protocol</th>
              <th>Packets</th>
              <th>Bytes</th>
              <th>Duration</th>
              <th>Threat Score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {flows.map(flow => (
              <tr key={flow.id} className="data-row" onClick={() => navigate(`/flows/${flow.id}`)}>
                <td className="mono" style={{ fontSize: 11 }}>{flow.id}</td>
                <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{formatTimestamp(flow.flowStart)}</td>
                <td className="mono" style={{ fontSize: 12 }}>{flow.sourceIp}</td>
                <td className="mono" style={{ fontSize: 12 }}>{flow.destinationIp}</td>
                <td className="mono" style={{ fontSize: 12 }}>{flow.sourcePort}</td>
                <td className="mono" style={{ fontSize: 12 }}>{flow.destinationPort}</td>
                <td style={{ fontSize: 12 }}>{flow.protocol}</td>
                <td style={{ fontSize: 12 }}>{flow.packetCount?.toLocaleString()}</td>
                <td style={{ fontSize: 12 }}>{formatBytes(flow.byteCount)}</td>
                <td style={{ fontSize: 12 }}>{formatDuration(flow.durationMs)}</td>
                <td>
                  <div style={{ width: 60, height: 4, background: 'var(--color-surface-3)', borderRadius: 2 }}>
                    <div style={{
                      width: `${Math.min(100, (flow.threatScore ?? 0) * 100)}%`,
                      height: '100%',
                      background: (flow.threatScore ?? 0) > 0.7 ? '#dc2626' : (flow.threatScore ?? 0) > 0.4 ? '#d97706' : '#16a34a',
                      borderRadius: 2,
                    }} />
                  </div>
                </td>
                <td><StatusBadge status={flow.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading flows...</div>}
      </div>

      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', gap: 8 }}>
        <button className="btn btn-outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
        <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
          Page {page + 1} · {data?.totalElements ?? 0} total flows
        </span>
        <button className="btn btn-outline" disabled={!data || page >= data.totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}
