/**
 * Global application state store.
 * Manages replay state, recent alerts, traffic metrics, and system status.
 * Uses simple React context - no external state library needed.
 */

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { ThreatAlert, ReplayState, SystemMetric } from '../types';

interface AppState {
  replayState: ReplayState;
  recentAlerts: ThreatAlert[];
  latestMetric: SystemMetric | null;
  wsConnected: boolean;
  selectedAlertId: string | null;
}

type Action =
  | { type: 'SET_REPLAY_STATE'; payload: ReplayState }
  | { type: 'ADD_ALERT'; payload: ThreatAlert }
  | { type: 'UPDATE_ALERT'; payload: ThreatAlert }
  | { type: 'SET_METRIC'; payload: SystemMetric }
  | { type: 'SET_WS_CONNECTED'; payload: boolean }
  | { type: 'SELECT_ALERT'; payload: string | null };

const initialState: AppState = {
  replayState: { status: 'STOPPED', speedMultiplier: 1, flowsProcessed: 0, packetsProcessed: 0 },
  recentAlerts: [],
  latestMetric: null,
  wsConnected: false,
  selectedAlertId: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_REPLAY_STATE':
      return { ...state, replayState: action.payload };
    case 'ADD_ALERT': {
      const alerts = [action.payload, ...state.recentAlerts].slice(0, 100);
      return { ...state, recentAlerts: alerts };
    }
    case 'UPDATE_ALERT': {
      const alerts = state.recentAlerts.map(a =>
        a.id === action.payload.id ? action.payload : a
      );
      return { ...state, recentAlerts: alerts };
    }
    case 'SET_METRIC':
      return { ...state, latestMetric: action.payload };
    case 'SET_WS_CONNECTED':
      return { ...state, wsConnected: action.payload };
    case 'SELECT_ALERT':
      return { ...state, selectedAlertId: action.payload };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
