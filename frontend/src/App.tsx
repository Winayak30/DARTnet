import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { useWebSocket } from './hooks/useWebSocket';
import { useAppState } from './store/AppContext';
import type { WsEvent, ThreatAlert, SystemMetric, ReplayState } from './types';
import './styles/components.css';

// Pages (lazy loaded)
const OverviewPage = React.lazy(() => import('./pages/Overview'));
const LiveTrafficPage = React.lazy(() => import('./pages/LiveTraffic'));
const AlertsPage = React.lazy(() => import('./pages/Alerts'));
const InvestigationPage = React.lazy(() => import('./pages/Investigation'));
const ThreatAnalyticsPage = React.lazy(() => import('./pages/ThreatAnalytics'));
const DDoSPage = React.lazy(() => import('./pages/threat-analytics/DDoSPage'));
const PortScanPage = React.lazy(() => import('./pages/threat-analytics/PortScanPage'));
const DnsDgaPage = React.lazy(() => import('./pages/threat-analytics/DnsDgaPage'));
const C2Page = React.lazy(() => import('./pages/threat-analytics/C2Page'));
const ExfiltrationPage = React.lazy(() => import('./pages/threat-analytics/ExfiltrationPage'));
const EncryptedPage = React.lazy(() => import('./pages/threat-analytics/EncryptedPage'));
const FlowsPage = React.lazy(() => import('./pages/Flows'));
const FlowDetailPage = React.lazy(() => import('./pages/FlowDetail'));
const ModelsPage = React.lazy(() => import('./pages/Models'));
const ReportsPage = React.lazy(() => import('./pages/Reports'));
const SystemPage = React.lazy(() => import('./pages/System'));

function AppInner() {
  const { dispatch } = useAppState();

  // Subscribe to WebSocket events
  useWebSocket(
    ['/topic/alerts', '/topic/traffic', '/topic/system', '/topic/replay'],
    (event: WsEvent) => {
      switch (event.eventType) {
        case 'ALERT_CREATED':
          dispatch({ type: 'ADD_ALERT', payload: event.payload as ThreatAlert });
          break;
        case 'ALERT_UPDATED':
          dispatch({ type: 'UPDATE_ALERT', payload: event.payload as ThreatAlert });
          break;
        case 'TRAFFIC_UPDATE':
        case 'SYSTEM_UPDATE':
          dispatch({ type: 'SET_METRIC', payload: event.payload as SystemMetric });
          break;
        case 'REPLAY_UPDATE':
          dispatch({ type: 'SET_REPLAY_STATE', payload: event.payload as ReplayState });
          break;
      }
    }
  );

  // Mark WS as connected (simplified - in production check actual connection state)
  useEffect(() => {
    const timer = setTimeout(() => dispatch({ type: 'SET_WS_CONNECTED', payload: true }), 2000);
    return () => clearTimeout(timer);
  }, [dispatch]);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <TopBar />
        <main style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
          <React.Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/live-traffic" element={<LiveTrafficPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/investigation" element={<InvestigationPage />} />
              <Route path="/investigation/:alertId" element={<InvestigationPage />} />
              <Route path="/threat-analytics" element={<ThreatAnalyticsPage />} />
              <Route path="/threat-analytics/ddos" element={<DDoSPage />} />
              <Route path="/threat-analytics/port-scan" element={<PortScanPage />} />
              <Route path="/threat-analytics/dns-dga" element={<DnsDgaPage />} />
              <Route path="/threat-analytics/c2" element={<C2Page />} />
              <Route path="/threat-analytics/exfiltration" element={<ExfiltrationPage />} />
              <Route path="/threat-analytics/encrypted" element={<EncryptedPage />} />
              <Route path="/flows" element={<FlowsPage />} />
              <Route path="/flows/:flowId" element={<FlowDetailPage />} />
              <Route path="/models" element={<ModelsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/system" element={<SystemPage />} />
            </Routes>
          </React.Suspense>
        </main>
      </div>
    </div>
  );
}

function PageLoader() {
  return (
    <div style={{ padding: 40, color: 'var(--color-text-muted)', fontSize: 13 }}>
      Loading...
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppInner />
    </Router>
  );
}
