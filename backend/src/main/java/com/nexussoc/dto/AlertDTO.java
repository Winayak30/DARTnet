package com.nexussoc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.util.Map;

/**
 * Canonical alert schema shared by backend, ML integration,
 * WebSocket events, UI, exports, and database.
 * SIH26145 - NEXUS SOC
 */
@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AlertDTO {
    private String id;
    private Instant timestamp;
    private String flowId;
    private String threatClass;
    private String severity;
    private Double confidence;
    private String sourceIp;
    private String destinationIp;
    private String protocol;
    private Long detectionLatencyMs;
    private String modelVersion;
    private Map<String, Object> evidence;
    private String status;
}
