package com.dartnet.dto;

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

    // Threat distribution — aligned to ml-repo 7 classes
    private Long ddosCount;          // SYN_FLOOD
    private Long dosCount;           // DOS_ATTACK
    private Long portScanCount;      // PORT_SCAN
    private Long bruteForceCount;    // BRUTE_FORCE
    private Long webAttackCount;     // WEB_ATTACK
    private Long c2Count;            // C2_BEACON (incl. Bots)
    private Long dnsDgaCount;        // DNS_TUNNEL
    private Long exfiltrationCount;  // DATA_EXFILTRATION
    private Long encryptedCount;     // ENCRYPTED_ANOMALY

    // Pipeline health
    private String ingestionStatus;
    private String processingStatus;
    private String mlServiceStatus;
    private String alertEngineStatus;
}
