package com.dartnet.websocket;

import com.dartnet.dto.WsEventDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import java.time.Instant;

/**
 * Central WebSocket event broadcaster.
 * All real-time events go through this service.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;

    public void broadcastAlert(Object alert) {
        send("/topic/alerts", "ALERT_CREATED", alert);
    }

    public void broadcastAlertUpdate(Object alert) {
        send("/topic/alerts", "ALERT_UPDATED", alert);
    }

    public void broadcastTrafficUpdate(Object trafficMetrics) {
        send("/topic/traffic", "TRAFFIC_UPDATE", trafficMetrics);
    }

    public void broadcastSystemUpdate(Object systemStatus) {
        send("/topic/system", "SYSTEM_UPDATE", systemStatus);
    }

    public void broadcastReplayUpdate(Object replayStatus) {
        send("/topic/replay", "REPLAY_UPDATE", replayStatus);
    }

    public void broadcastPipelineUpdate(Object pipelineStatus) {
        send("/topic/system", "PIPELINE_UPDATE", pipelineStatus);
    }

    private void send(String destination, String eventType, Object payload) {
        try {
            WsEventDTO event = WsEventDTO.builder()
                    .eventType(eventType)
                    .timestamp(Instant.now())
                    .payload(payload)
                    .build();
            messagingTemplate.convertAndSend(destination, event);
        } catch (Exception e) {
            log.warn("Failed to broadcast {} event: {}", eventType, e.getMessage());
        }
    }
}
