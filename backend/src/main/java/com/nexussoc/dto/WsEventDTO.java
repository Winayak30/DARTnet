package com.nexussoc.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;

/**
 * WebSocket event envelope - all real-time events use this structure.
 */
@Data
@Builder
public class WsEventDTO {
    private String eventType;  // ALERT_CREATED, ALERT_UPDATED, TRAFFIC_UPDATE, SYSTEM_UPDATE, REPLAY_UPDATE, PIPELINE_UPDATE
    private Instant timestamp;
    private Object payload;
}
