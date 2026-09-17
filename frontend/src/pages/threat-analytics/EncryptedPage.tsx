import React from 'react';

/**
 * Encrypted Traffic Analysis page.
 * 
 * IMPORTANT SECURITY REQUIREMENT:
 * This page prominently displays that payload decryption is DISABLED.
 * Only TLS/QUIC metadata is analyzed (packet sizes, timing, JA3, etc.)
 * This is a non-negotiable constraint of SIH26145.
 */
export default function EncryptedPage() {
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div className="page-header" style={{ borderLeft: '4px solid #4f46e5' }}>
        <div style={{ paddingLeft: 12 }}>
          <div className="page-title">TLS / QUIC Metadata Analysis</div>
          <div className="page-subtitle">Encrypted traffic behavioral analysis using observable metadata only</div>
        </div>
      </div>

      {/* MANDATORY: Payload not inspected banner */}
      <div style={{
        margin: 16,
        padding: '12px 20px',
        background: '#fef3c7',
        border: '2px solid #f59e0b',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: 20 }}>🔒</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>
            PAYLOAD NOT INSPECTED · DECRYPTION DISABLED
          </div>
          <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>
            This detector analyzes only observable metadata: packet sizes, timing characteristics, flow duration,
            connection frequency, and TLS handshake metadata (JA3/JA3S/JA4 where available).
            Encrypted application content is never accessed or decrypted.
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        {/* Feature list */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-header"><span className="panel-title">Observable Metadata Features</span></div>
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {[
              { name: 'JA3 Fingerprint', desc: 'TLS client hello fingerprint from observable handshake parameters', available: true },
              { name: 'JA3S Fingerprint', desc: 'TLS server hello fingerprint from observable handshake parameters', available: true },
              { name: 'JA4 Fingerprint', desc: 'Enhanced TLS fingerprinting (if available)', available: false },
              { name: 'Packet Size Statistics', desc: 'Mean, variance, min, max of encrypted packet payload sizes', available: true },
              { name: 'Inter-Arrival Timing', desc: 'Time between packet arrivals within encrypted flow', available: true },
              { name: 'Flow Duration', desc: 'Total observable duration of the TLS session', available: true },
              { name: 'Connection Frequency', desc: 'Rate of TLS session establishment from source', available: true },
              { name: 'Certificate Metadata', desc: 'Observable TLS certificate fields (SNI, issuer) — no key extraction', available: true },
            ].map(f => (
              <div key={f.name} style={{
                padding: 12,
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                background: f.available ? '#f0fdf4' : '#f9fafb',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ color: f.available ? '#16a34a' : '#9ca3af', fontSize: 12 }}>
                    {f.available ? '✓' : '○'}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{f.name}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Explicitly prohibited */}
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Explicitly Prohibited Operations</span></div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              'Decryption of TLS/QUIC payload content',
              'Private key extraction or interception',
              'Certificate pinning bypass',
              'Man-in-the-middle proxy insertion',
              'SSL/TLS stripping',
              'Application-layer content inspection',
            ].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ color: '#dc2626', fontSize: 14, fontWeight: 700 }}>✗</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>{item}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '0 16px 16px', fontSize: 12, color: 'var(--color-text-muted)' }}>
            DARTNet operates as a passive observation system. Encrypted traffic analysis
            is limited to observable network-layer metadata. This is a permanent architectural
            constraint, not a configurable setting.
          </div>
        </div>
      </div>
    </div>
  );
}
