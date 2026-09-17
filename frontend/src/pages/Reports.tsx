import React from 'react';
import { exportAlerts, generateIncidentReport } from '../api/client';

export default function ReportsPage() {
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div className="page-header">
        <div className="page-title">Reports & Export</div>
        <div className="page-subtitle">Export alerts, flows, and generate incident reports</div>
      </div>
      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>

        <ReportCard
          title="Export Alerts — JSON"
          description="Export all alerts in canonical JSON format matching the DARTNet alert schema."
          action="Download JSON"
          onAction={() => exportAlerts('JSON')}
        />
        <ReportCard
          title="Export Alerts — CSV"
          description="Export all alerts as CSV with all fields for spreadsheet analysis."
          action="Download CSV"
          onAction={() => exportAlerts('CSV')}
        />
        <ReportCard
          title="Incident Report"
          description="Generate a human-readable incident report for the last 24 hours. Contains alert details and summary."
          action="Generate Report"
          onAction={generateIncidentReport}
        />
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Export Format Notes</span></div>
          <div style={{ padding: 16, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
            <p>• Alert JSON exports use the canonical DARTNet alert schema (SIH26145).</p>
            <p>• Reports contain only observed, measured data — no fabricated metrics.</p>
            <p>• Evidence in reports corresponds to actual detector feature values.</p>
            <p>• All exports contain actual stored data from the PostgreSQL database.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const ReportCard: React.FC<{ title: string; description: string; action: string; onAction: () => void }> = ({
  title, description, action, onAction
}) => (
  <div className="panel" style={{ padding: 20 }}>
    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{title}</div>
    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>{description}</div>
    <button className="btn btn-primary" onClick={onAction}>{action}</button>
  </div>
);
