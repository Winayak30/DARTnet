import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppState } from '../../store/AppContext';
import { fetchReplayStatus, startReplay, pauseReplay, resumeReplay, stopReplay, resetReplay } from '../../api/client';
import type { ReplayState } from '../../types';
import { SCENARIOS } from '../../types';
import './TopBar.css';

export const TopBar: React.FC = () => {
  const { state, dispatch } = useAppState();
  const { replayState } = state;

  const { data: replayStatus } = useQuery({
    queryKey: ['replay-status'],
    queryFn: fetchReplayStatus,
    refetchInterval: 2000,
    retry: false,
    throwOnError: false,
  });

  const currentStatus = replayStatus ?? replayState;

  const handleStart = async (scenario: string) => {
    const s = await startReplay(scenario, 1);
    dispatch({ type: 'SET_REPLAY_STATE', payload: s });
  };

  const handlePause = async () => {
    const s = currentStatus.status === 'PAUSED'
      ? await pauseReplay()
      : await pauseReplay();
    dispatch({ type: 'SET_REPLAY_STATE', payload: s });
  };

  const handleStop = async () => {
    const s = await stopReplay();
    dispatch({ type: 'SET_REPLAY_STATE', payload: s });
  };

  const handleReset = async () => {
    const s = await resetReplay();
    dispatch({ type: 'SET_REPLAY_STATE', payload: s });
  };

  const isRunning = currentStatus.status === 'RUNNING';
  const isPaused = currentStatus.status === 'PAUSED';
  const isStopped = currentStatus.status === 'STOPPED' || currentStatus.status === 'COMPLETED';

  return (
    <header className="topbar">
      <div className="topbar-search">
        <span className="topbar-search-icon">⌕</span>
        <input
          className="topbar-search-input"
          type="text"
          placeholder="Filter flows, IPs, alerts, domains, protocols..."
        />
      </div>

      <div className="topbar-controls">
        {/* Scenario selector */}
        <select
          className="topbar-select"
          value={currentStatus.scenario || ''}
          onChange={(e) => handleStart(e.target.value)}
          disabled={isRunning || isPaused}
        >
          <option value="">— Select Scenario —</option>
          {SCENARIOS.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {/* Replay controls */}
        <div className="topbar-replay-controls">
          {isStopped ? (
            <button
              className="topbar-btn topbar-btn-primary"
              onClick={() => handleStart(currentStatus.scenario || 'DDOS_SYN_FLOOD')}
              disabled={!currentStatus.scenario && currentStatus.status !== 'STOPPED'}
            >
              ▶ Play
            </button>
          ) : isRunning ? (
            <button className="topbar-btn" onClick={handlePause}>⏸ Pause</button>
          ) : isPaused ? (
            <button className="topbar-btn topbar-btn-primary" onClick={handlePause}>▶ Resume</button>
          ) : null}

          {(isRunning || isPaused) && (
            <button className="topbar-btn topbar-btn-danger" onClick={handleStop}>⏹ Stop</button>
          )}

          <button className="topbar-btn" onClick={handleReset} title="Reset replay">↺</button>
        </div>

        {/* System status */}
        <ReplayStatusBadge status={currentStatus} />

        {/* WS indicator */}
        <div className={`topbar-ws-indicator ${state.wsConnected ? 'connected' : 'disconnected'}`}
          title={state.wsConnected ? 'WebSocket connected' : 'WebSocket disconnected'}>
          <span className="topbar-ws-dot" />
          {state.wsConnected ? 'LIVE' : 'OFFLINE'}
        </div>
      </div>
    </header>
  );
};

const ReplayStatusBadge: React.FC<{ status: ReplayState }> = ({ status }) => {
  const labels: Record<string, string> = {
    RUNNING: 'PCAP REPLAY',
    PAUSED: 'PAUSED',
    STOPPED: 'STOPPED',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR',
  };
  const classes: Record<string, string> = {
    RUNNING: 'status-running',
    PAUSED: 'status-paused',
    STOPPED: 'status-stopped',
    COMPLETED: 'status-completed',
    ERROR: 'status-error',
  };
  return (
    <div className={`topbar-status-badge ${classes[status.status] || ''}`}>
      {status.status === 'RUNNING' && <span className="pulse" style={{marginRight: 4}}>●</span>}
      {labels[status.status] || status.status}
      {status.scenario && status.status !== 'STOPPED' && (
        <span style={{marginLeft: 6, opacity: 0.8, fontSize: 11}}>
          {status.scenario.replace(/_/g, ' ')}
        </span>
      )}
    </div>
  );
};
