package com.dartnet.controller;

import com.dartnet.dto.OverviewDTO;
import com.dartnet.domain.repository.NetworkFlowRepository;
import com.dartnet.domain.repository.ThreatAlertRepository;
import com.dartnet.metrics.MetricsCollector;
import com.dartnet.ml.MlServiceClient;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final NetworkFlowRepository flowRepository;
    private final ThreatAlertRepository alertRepository;
    private final MetricsCollector metricsCollector;
    private final MlServiceClient mlClient;

    @GetMapping("/overview")
    public ResponseEntity<OverviewDTO> getOverview() {
        var latest = metricsCollector.getLatest();
        Instant since1h = Instant.now().minus(1, ChronoUnit.HOURS);

        long totalThreats = alertRepository.countSince(since1h);
        long criticalAlerts = alertRepository.countBySeverity("CRITICAL");
        long activeFlows = flowRepository.countActive();

        double flowsPerSec = latest.map(m -> m.getFlowsPerSec() != null ? m.getFlowsPerSec() : 0.0).orElse(0.0);
        double latency = latest.map(m -> m.getLatencyP50Ms() != null ? m.getLatencyP50Ms() : 0.0).orElse(0.0);
        double throughput = latest.map(m -> m.getThroughputMbps() != null ? m.getThroughputMbps() : 0.0).orElse(0.0);

        OverviewDTO dto = OverviewDTO.builder()
                .flowsPerSec(flowsPerSec)
                .activeFlows(activeFlows)
                .totalThreats(totalThreats)
                .criticalAlerts(criticalAlerts)
                .detectionLatencyMs(latency)
                .throughputMbps(throughput)
                // ml-repo 7 classes
                .ddosCount(alertRepository.countByThreatClassSince("SYN_FLOOD", since1h))
                .dosCount(alertRepository.countByThreatClassSince("DOS_ATTACK", since1h))
                .portScanCount(alertRepository.countByThreatClassSince("PORT_SCAN", since1h))
                .bruteForceCount(alertRepository.countByThreatClassSince("BRUTE_FORCE", since1h))
                .webAttackCount(alertRepository.countByThreatClassSince("WEB_ATTACK", since1h))
                .c2Count(alertRepository.countByThreatClassSince("C2_BEACON", since1h))
                .dnsDgaCount(alertRepository.countByThreatClassSince("DNS_TUNNEL", since1h))
                .exfiltrationCount(alertRepository.countByThreatClassSince("DATA_EXFILTRATION", since1h))
                .encryptedCount(alertRepository.countByThreatClassSince("ENCRYPTED_ANOMALY", since1h))
                .ingestionStatus("UP")
                .processingStatus("UP")
                .mlServiceStatus(mlClient.isHealthy() ? "UP" : "DEGRADED")
                .alertEngineStatus("UP")
                .build();

        return ResponseEntity.ok(dto);
    }
}
