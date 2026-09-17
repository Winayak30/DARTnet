import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchModels } from '../api/client';
import { StatusBadge } from '../components/ui/Badges';

const THREAT_DESCRIPTIONS: Record<string, string> = {
  ddos: 'Detects volumetric DDoS attacks including SYN floods using flow rate, SYN ratio, source entropy, and unique source IPs.',
  portscan: 'Detects port scanning and reconnaissance using destination port diversity, fan-out, and connection rate features.',
  dns_dga: 'Detects DNS tunneling and DGA domains using domain entropy, length, character distribution, and n-gram anomaly scoring.',
  c2: 'Detects C2 beaconing by analyzing inter-arrival time regularity, periodicity score, and connection patterns.',
  exfil: 'Detects data exfiltration using outbound/inbound byte ratio, transfer rate, and destination concentration.',
};

const VALIDATION_STRATEGY = 'Time-aware split: last 20% of samples (ordered chronologically) used for test. ' +
  'Prevents data leakage from correlated attack sessions sharing features.';

export default function ModelsPage() {
  const [selectedModel, setSelectedModel] = useState<number | null>(null);

  const { data: models = [], isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: fetchModels,
    refetchInterval: 30000,
  });

  const selected = models.find(m => m.id === selectedModel) ?? models[0];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="page-header">
        <div className="page-title">Model Registry</div>
        <div className="page-subtitle">
          Trained threat detection models · Evaluation metrics are measured on held-out test data
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {isLoading && <div style={{ color: 'var(--color-text-muted)' }}>Loading models...</div>}

        {/* Model cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
          {models.map(model => (
            <ModelCard
              key={model.id}
              model={model}
              isSelected={model.id === (selected?.id)}
              onSelect={() => setSelectedModel(model.id)}
            />
          ))}
        </div>

        {/* Detailed view */}
        {selected && (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">{selected.name} · Detailed View</span>
              <StatusBadge status={selected.status} />
            </div>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Metrics */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-secondary)' }}>
                  EVALUATION METRICS
                </h4>
                {selected.metrics && (
                  <MetricsChart metrics={selected.metrics} />
                )}
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                  <strong>Validation strategy:</strong> {VALIDATION_STRATEGY}
                </div>
              </div>

              {/* Info */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-secondary)' }}>
                  MODEL INFORMATION
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13, marginBottom: 16 }}>
                  {[
                    ['Model Type', selected.modelType],
                    ['Threat Class', selected.threatClass],
                    ['Dataset', selected.dataset || 'SYNTHETIC'],
                    ['Version', selected.version],
                    ['Status', selected.status],
                    ['Evaluated', selected.createdAt ? new Date(selected.createdAt).toLocaleDateString() : '—'],
                  ].map(([label, value]) => (
                    <>
                      <span key={`l-${label}`} style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                      <span key={`v-${label}`} style={{ fontWeight: 500 }}>{value}</span>
                    </>
                  ))}
                </div>

                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-secondary)' }}>
                  DESCRIPTION
                </h4>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                  {THREAT_DESCRIPTIONS[selected.name?.toLowerCase()] || selected.description || 'No description available'}
                </p>

                {selected.features && selected.features.length > 0 && (
                  <>
                    <h4 style={{ fontSize: 13, fontWeight: 600, margin: '16px 0 8px', color: 'var(--color-text-secondary)' }}>
                      FEATURE SET ({selected.features.length})
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {selected.features.map(f => (
                        <span key={f} style={{
                          padding: '2px 8px',
                          background: 'var(--color-accent-light)',
                          color: 'var(--color-accent)',
                          borderRadius: 12,
                          fontSize: 11,
                          fontFamily: 'var(--font-mono)',
                        }}>{f}</span>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ marginTop: 16, padding: 12, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid var(--color-medium-border)', borderRadius: 6, fontSize: 12, color: 'var(--color-medium)' }}>
                  <strong>Limitations:</strong> {selected.limitations || 
                    'Models trained on synthetic data. Performance on real-world traffic may differ. ' +
                    'Recommend validation against actual captured traffic before production use.'
                  }
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const ModelCard: React.FC<{ model: any; isSelected: boolean; onSelect: () => void }> = ({
  model, isSelected, onSelect
}) => {
  const metrics = model.metrics ?? {};
  const f1 = metrics.f1 ?? metrics.f1_score ?? 0;
  const precision = metrics.precision ?? 0;
  const recall = metrics.recall ?? 0;
  const fpr = metrics.false_positive_rate ?? 0;

  return (
    <div
      className="panel"
      style={{
        cursor: 'pointer',
        borderColor: isSelected ? 'var(--color-accent)' : undefined,
        borderWidth: isSelected ? 2 : 1,
      }}
      onClick={onSelect}
    >
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{model.name}</span>
          <StatusBadge status={model.status ?? 'LOADED'} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {model.modelType} · v{model.version}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
          {model.threatClass} · {model.dataset || 'SYNTHETIC'}
        </div>
      </div>
      <div style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <MetricMini label="F1" value={f1} />
        <MetricMini label="Precision" value={precision} />
        <MetricMini label="Recall" value={recall} />
        <MetricMini label="FPR" value={fpr} invert />
      </div>
    </div>
  );
};

const MetricMini: React.FC<{ label: string; value: number; invert?: boolean }> = ({ label, value, invert }) => {
  const pct = (value * 100).toFixed(1);
  const good = invert ? value < 0.05 : value > 0.85;
  const warn = invert ? value < 0.10 : value > 0.70;
  const color = good ? '#16a34a' : warn ? '#d97706' : '#dc2626';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{pct}%</div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
};

const MetricsChart: React.FC<{ metrics: Record<string, number> }> = ({ metrics }) => {
  const data = [
    { name: 'Precision', value: Math.round((metrics.precision ?? 0) * 100) },
    { name: 'Recall', value: Math.round((metrics.recall ?? 0) * 100) },
    { name: 'F1', value: Math.round((metrics.f1 ?? 0) * 100) },
    { name: 'FPR', value: Math.round((metrics.false_positive_rate ?? 0) * 100) },
  ];
  const colors = ['#2563eb', '#16a34a', '#7c3aed', '#ea580c'];
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => v + '%'} />
        <Tooltip formatter={(v: number) => v + '%'} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={colors[i]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
