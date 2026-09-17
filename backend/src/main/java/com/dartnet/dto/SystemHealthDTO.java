package com.dartnet.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class SystemHealthDTO {
    // Pipeline component health
    private ComponentHealth trafficIngestion;
    private ComponentHealth flowProcessor;
    private ComponentHealth featureEngine;
    private ComponentHealth mlService;
    private ComponentHealth threatCorrelation;
    private ComponentHealth alertEngine;
    private ComponentHealth websocket;
    private ComponentHealth database;

    // Performance
    private Double currentThroughputMbps;
    private Double peakThroughputMbps;
    private Double avgThroughputMbps;
    private Double latencyP50Ms;
    private Double latencyP95Ms;
    private Integer queueDepth;
    private Long droppedEvents;

    // Resources
    private Double cpuPercent;
    private Double memoryPercent;
    private Double diskPercent;
    private Integer alertQueueSize;

    // Environment
    private String dataset;
    private String scenario;
    private String replayStatus;
    private String modelVersion;
    private String appVersion;

    // History for chart
    private List<MetricPoint> throughputHistory;
    private List<MetricPoint> latencyHistory;

    @Data
    @Builder
    public static class ComponentHealth {
        private String name;
        private String status;    // UP, DOWN, DEGRADED, UNKNOWN
        private Double rate;
        private Double latencyMs;
        private String errorState;
    }

    @Data
    @Builder
    public static class MetricPoint {
        private String timestamp;
        private Double value;
    }
}
