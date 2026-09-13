import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchAlerts } from '../api/client';

const THREAT_CARDS = [
  {
    id: 'ddos', path: '/threat-analytics/ddos', title: 'DDoS / Flooding',
    desc: 'Volumetric attacks — SYN floods, UDP floods. Detected via flow rate, SYN ratio, source distribution.',
    color: '#dc2626', threatClass: 'SYN_FLOOD',
  },
  {
    id: 'port-scan', path: '/threat-analytics/port-scan', title: 'Port Scanning',
    desc: 'Reconnaissance via systematic port sweeps. Detected by destination port diversity and fan-out.',
    color: '#ea580c', threatClass: 'PORT_SCAN',
  },
  {
    id: 'dns-dga', path: '/threat-analytics/dns-dga', title: 'DNS / DGA',
    desc: 'DNS tunneling and domain generation algorithms. Detected via entropy and n-gram analysis.',
    color: '#d97706', threatClass: 'DNS_TUNNEL',
  },
  {
    id: 'c2', path: '/threat-analytics/c2', title: 'C2 Beaconing',
    desc: 'Command-and-control communication. Detected by periodicity analysis of connection intervals.',
    color: '#7c3aed', threatClass: 'C2_BEACON',
  },
  {
    id: 'exfiltration', path: '/threat-analytics/exfiltration', title: 'Data Exfiltration',
    desc: 'Unauthorized data transfer. Detected by asymmetric inbound/outbound byte ratios.',
    color: '#0891b2', threatClass: 'DATA_EXFILTRATION',
  },
  {
    id: 'encrypted', path: '/threat-analytics/encrypted', title: 'Encrypted Traffic',
    desc: 'TLS/QUIC metadata analysis. Payload NOT inspected. Metadata-only behavioral analysis.',
    color: '#4f46e5', threatClass: 'ENCRYPTED_ANOMALY',
  },
];

export default function ThreatAnalyticsPage() {
  const navigate = useNavigate();
  const { data: alerts } = useQuery({
    queryKey: ['alerts-summary'],
    queryFn: () => fetchAlerts({ size: 200 }),
    refetchInterval: 10000,
  });

  const counts = Object.fromEntries(
    THREAT_CARDS.map(tc => [
      tc.threatClass,
      alerts?.content?.filter(a => a.threatClass === tc.threatClass).length ?? 0,
    ])
  );

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div className="page-header">
        <div className="page-title">Threat Analytics</div>
        <div className="page-subtitle">Specialized detection views for each threat category</div>
      </div>
      <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {THREAT_CARDS.map(tc => (
          <div
            key={tc.id}
            className="panel"
            style={{ cursor: 'pointer', transition: 'box-shadow 0.1s', borderTop: `3px solid ${tc.color}` }}
            onClick={() => navigate(tc.path)}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
          >
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{tc.title}</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700,
                  color: counts[tc.threatClass] > 0 ? tc.color : 'var(--color-text-muted)',
                }}>
                  {counts[tc.threatClass]}
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{tc.desc}</div>
              <div style={{ marginTop: 12, fontSize: 12, color: tc.color, fontWeight: 500 }}>
                View analytics →
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
