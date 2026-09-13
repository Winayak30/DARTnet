package com.nexussoc.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OverviewDTO {
    private Double flowsPerSec;
    private Long activeFlows;
    private Long totalThreats;
    private Long criticalAlerts;
    private Double detectionLatencyMs;
    private Double throughputMbps;

    // Threat distribution
    private Long ddosCount;
    private Long portScanCount;
    private Long dnsDgaCount;
    private Long c2Count;
    private Long exfiltrationCount;
    private Long encryptedCount;

    // Pipeline health
    private String ingestionStatus;
    private String processingStatus;
    private String mlServiceStatus;
    private String alertEngineStatus;
}
