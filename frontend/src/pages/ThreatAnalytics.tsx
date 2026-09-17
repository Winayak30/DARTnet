import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchAlerts } from '../api/client';

const THREAT_CARDS = [
  {
    id: 'ddos', path: '/threat-analytics/ddos', title: 'DDoS / Flooding',
    desc: 'Volumetric attacks — SYN floods, UDP floods. RandomForest trained on CICIDS2017. 99.97% F1.',
    color: '#EF4444', threatClass: 'SYN_FLOOD',
  },
  {
    id: 'dos', path: '/threat-analytics/dos', title: 'DoS Attacks',
    desc: 'Resource-exhaustion attacks — Hulk, GoldenEye, Slowloris. Sustained low-packet-rate flooding. 99.76% F1.',
    color: '#F87171', threatClass: 'DOS_ATTACK',
  },
  {
    id: 'port-scan', path: '/threat-analytics/port-scan', title: 'Port Scanning',
    desc: 'Reconnaissance via systematic port sweeps. Detected by destination port diversity and fan-out. 99.43% F1.',
    color: '#F97316', threatClass: 'PORT_SCAN',
  },
  {
    id: 'brute-force', path: '/threat-analytics/brute-force', title: 'Brute Force',
    desc: 'Automated credential guessing — FTP-Patator, SSH-Patator. Repeated low-byte-volume connections. 99.89% F1.',
    color: '#FB923C', threatClass: 'BRUTE_FORCE',
  },
  {
    id: 'web-attacks', path: '/threat-analytics/web-attacks', title: 'Web Attacks',
    desc: 'Application-layer attacks — XSS, SQLi, Brute Force over HTTP. Detected by HTTP flow patterns. 98.48% F1.',
    color: '#FBBF24', threatClass: 'WEB_ATTACK',
  },
  {
    id: 'c2', path: '/threat-analytics/c2', title: 'C2 / Bots',
    desc: 'C2 beaconing and bot traffic. Periodic low-volume connections consistent with malware check-ins. 38.99% F1 (low — see notes).',
    color: '#A78BFA', threatClass: 'C2_BEACON',
  },
  {
    id: 'dns-dga', path: '/threat-analytics/dns-dga', title: 'DNS / DGA',
    desc: 'DNS tunneling and domain generation algorithms. Rule-based entropy + n-gram analysis (CICIDS2017 has no DNS metadata).',
    color: '#F59E0B', threatClass: 'DNS_TUNNEL',
  },
  {
    id: 'exfiltration', path: '/threat-analytics/exfiltration', title: 'Data Exfiltration',
    desc: 'Unauthorized outbound data transfer. Detected by asymmetric inbound/outbound byte ratios.',
    color: '#06B6D4', threatClass: 'DATA_EXFILTRATION',
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
