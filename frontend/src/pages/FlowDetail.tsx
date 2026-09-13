import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchFlow } from '../api/client';
import { StatusBadge } from '../components/ui/Badges';
import { formatTimestamp, formatBytes, formatDuration } from '../utils/format';

export default function FlowDetailPage() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['flow', flowId],
    queryFn: () => flowId ? fetchFlow(flowId) : Promise.reject('No ID'),
    enabled: !!flowId,
  });

  if (isLoading) return <div style={{ padding: 40, color: 'var(--color-text-muted)' }}>Loading flow...</div>;
  if (error || !data) return <div style={{ padding: 40, color: 'var(--color-critical)' }}>Flow not found</div>;

  const { flow, features } = data;

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title" style={{ fontFamily: 'var(--font-mono)', fontSize: 17 }}>{flow.id}</div>
          <div className="page-subtitle">Flow Detail · {flow.protocol} · {flow.sourceIp} → {flow.destinationIp}</div>
        </div>
        <button className="btn btn-outline" onClick={() => navigate('/flows')}>← Back to Flows</button>
      </div>

      <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Basic Metadata</span></div>
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
            {[
              ['Flow ID', flow.id, true],
              ['Source IP', flow.sourceIp, true],
              ['Destination IP', flow.destinationIp, true],
              ['Source Port', String(flow.sourcePort), true],
              ['Destination Port', String(flow.destinationPort), true],
              ['Protocol', flow.protocol, false],
              ['First Seen', formatTimestamp(flow.flowStart), false],
              ['Last Seen', formatTimestamp(flow.flowEnd), false],
              ['Status', flow.status, false],
            ].map(([label, value, mono]) => (
              <>
                <span key={`l-${label}`} style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                <span key={`v-${label}`} style={{ fontFamily: mono ? 'var(--font-mono)' : 'inherit', fontSize: 12 }}>{value}</span>
              </>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><span className="panel-title">Traffic Statistics</span></div>
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
            {[
              ['Packets', String(flow.packetCount?.toLocaleString())],
              ['Bytes', formatBytes(flow.byteCount)],
              ['Duration', formatDuration(flow.durationMs)],
              ['Threat Score', `${((flow.threatScore ?? 0) * 100).toFixed(1)}%`],
              ['Threat Type', flow.threatType ?? '—'],
            ].map(([label, value]) => (
              <>
                <span key={`l-${label}`} style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                <span key={`v-${label}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{value}</span>
              </>
            ))}
          </div>
        </div>

        {features.length > 0 && (
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <div className="panel-header"><span className="panel-title">Extracted Features</span></div>
            <table className="evidence-table">
              <thead><tr><th>Feature Name</th><th>Numeric Value</th><th>String Value</th></tr></thead>
              <tbody>
                {features.map(f => (
                  <tr key={f.id}>
                    <td style={{ fontFamily: 'inherit' }}>{f.featureName}</td>
                    <td>{f.numericValue?.toFixed(4) ?? '—'}</td>
                    <td>{f.stringValue ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
