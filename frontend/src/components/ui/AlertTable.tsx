import React from 'react';
import type { ThreatAlert } from '../../types';
import { SeverityBadge, StatusBadge, ConfidenceBar } from './Badges';
import { formatTimestamp, formatIp, formatThreatClass } from '../../utils/format';

interface AlertTableProps {
  alerts: ThreatAlert[];
  onSelectAlert: (id: string) => void;
  selectedId?: string;
  loading?: boolean;
}

export const AlertTable: React.FC<AlertTableProps> = ({
  alerts, onSelectAlert, selectedId, loading
}) => {
  if (loading) return <TableSkeleton />;
  if (!alerts.length) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
      No alerts to display
    </div>
  );

  return (
    <div className="alert-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Threat</th>
            <th>Source IP</th>
            <th>Destination IP</th>
            <th>Protocol</th>
            <th>Confidence</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Latency</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map(alert => (
            <tr
              key={alert.id}
              className={`data-row ${selectedId === alert.id ? 'selected' : ''}`}
              onClick={() => onSelectAlert(alert.id)}
            >
              <td className="mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {formatTimestamp(alert.timestamp)}
              </td>
              <td>
                <span className="threat-label">
                  {formatThreatClass(alert.threatClass)}
                </span>
              </td>
              <td className="ip-value">{formatIp(alert.sourceIp)}</td>
              <td className="ip-value">{formatIp(alert.destinationIp)}</td>
              <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{alert.protocol}</td>
              <td style={{ minWidth: 120 }}>
                <ConfidenceBar confidence={alert.confidence} />
              </td>
              <td><SeverityBadge severity={alert.severity} size="sm" /></td>
              <td><StatusBadge status={alert.status} /></td>
              <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {alert.detectionLatencyMs != null ? `${alert.detectionLatencyMs}ms` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TableSkeleton: React.FC = () => (
  <div style={{ padding: 16 }}>
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className="skeleton" style={{ height: 36, marginBottom: 6 }} />
    ))}
  </div>
);
