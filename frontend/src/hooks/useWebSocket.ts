/**
 * WebSocket connection hook using STOMP over SockJS.
 * Manages connection lifecycle and event dispatching.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { WsEvent, WsEventType } from '../types';

const WS_URL = `${import.meta.env.VITE_API_BASE_URL || ''}/ws`;

type EventHandler = (event: WsEvent) => void;

let stompClient: Client | null = null;
const subscribers: Map<string, Set<EventHandler>> = new Map();

function getOrCreateClient(): Client {
  if (stompClient && stompClient.connected) return stompClient;

  stompClient = new Client({
    webSocketFactory: () => new SockJS(WS_URL),
    reconnectDelay: 3000,
    debug: () => {},
    onConnect: () => {
      console.log('[WS] Connected');
      // Re-subscribe all pending handlers
      subscribers.forEach((handlers, topic) => {
        if (handlers.size > 0) {
          stompClient!.subscribe(topic, (msg) => {
            try {
              const event: WsEvent = JSON.parse(msg.body);
              handlers.forEach(h => h(event));
            } catch {}
          });
        }
      });
    },
    onDisconnect: () => console.log('[WS] Disconnected'),
    onStompError: (frame) => console.warn('[WS] STOMP error', frame),
  });
  stompClient.activate();
  return stompClient;
}

export function useWebSocket(
  topics: string[],
  onEvent: (event: WsEvent) => void
): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const stableHandler = useCallback((event: WsEvent) => {
    handlerRef.current(event);
  }, []);

  useEffect(() => {
    const client = getOrCreateClient();

    const subscriptions: Array<{ id: string; topic: string }> = [];

    topics.forEach(topic => {
      if (!subscribers.has(topic)) {
        subscribers.set(topic, new Set());
      }
      subscribers.get(topic)!.add(stableHandler);

      if (client.connected) {
        const sub = client.subscribe(topic, (msg) => {
          try {
            const event: WsEvent = JSON.parse(msg.body);
            subscribers.get(topic)?.forEach(h => h(event));
          } catch {}
        });
        subscriptions.push({ id: sub.id, topic });
      }
    });

    return () => {
      topics.forEach(topic => {
        subscribers.get(topic)?.delete(stableHandler);
      });
      subscriptions.forEach(({ id }) => {
        try { client.unsubscribe(id); } catch {}
      });
    };
  }, [topics.join(','), stableHandler]);
}

export function disconnectWebSocket(): void {
  stompClient?.deactivate();
  stompClient = null;
}
