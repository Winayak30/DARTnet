package com.nexussoc.controller;

import com.nexussoc.domain.entity.SystemMetric;
import com.nexussoc.dto.SystemHealthDTO;
import com.nexussoc.metrics.MetricsCollector;
import com.nexussoc.ml.MlServiceClient;
import com.nexussoc.replay.ReplayEngine;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/system")
@RequiredArgsConstructor
public class SystemController {

    private final MetricsCollector metricsCollector;
    private final MlServiceClient mlClient;
    private final ReplayEngine replayEngine;

    @GetMapping("/health")
    public ResponseEntity<SystemHealthDTO> getHealth() {
        Optional<SystemMetric> latest = metricsCollector.getLatest();
        List<SystemMetric> history = metricsCollector.getHistory(
                Instant.now().minus(5, ChronoUnit.MINUTES));

        boolean mlHealthy = mlClient.isHealthy();
        var replay = replayEngine.getStatus();

        var dto = SystemHealthDTO.builder()
                .trafficIngestion(component("Traffic Ingestion", "UP", null, null, null))
                .flowProcessor(component("Flow Processor", "UP", null, null, null))
                .featureEngine(component("Feature Engine", "UP", null, null, null))
                .mlService(component("ML Service", mlHealthy ? "UP" : "DOWN", null, null,
                        mlHealthy ? null : "ML service unreachable"))
                .threatCorrelation(component("Threat Correlation", "UP", null, null, null))
                .alertEngine(component("Alert Engine", "UP", null, null, null))
                .websocket(component("WebSocket", "UP", null, null, null))
                .database(component("Database", "UP", null, null, null))
                .currentThroughputMbps(latest.map(SystemMetric::getThroughputMbps).orElse(0.0))
                .latencyP50Ms(latest.map(SystemMetric::getLatencyP50Ms).orElse(0.0))
                .latencyP95Ms(latest.map(SystemMetric::getLatencyP95Ms).orElse(0.0))
                .queueDepth(latest.map(m -> m.getQueueDepth() != null ? m.getQueueDepth() : 0).orElse(0))
                .droppedEvents(latest.map(m -> m.getDroppedEvents() != null ? m.getDroppedEvents() : 0L).orElse(0L))
                .cpuPercent(latest.map(SystemMetric::getCpuPercent).orElse(0.0))
                .memoryPercent(latest.map(SystemMetric::getMemoryPercent).orElse(0.0))
                .diskPercent(0.0)
                .alertQueueSize(latest.map(SystemMetric::getAlertQueueSize).orElse(0))
                .replayStatus(replay.getStatus())
                .scenario(replay.getScenario())
                .appVersion("1.0.0-SIH26145")
                .throughputHistory(history.stream()
                        .map(m -> SystemHealthDTO.MetricPoint.builder()
                                .timestamp(m.getRecordedAt().toString())
                                .value(m.getThroughputMbps() != null ? m.getThroughputMbps() : 0.0)
                                .build())
                        .toList())
                .build();

        return ResponseEntity.ok(dto);
    }

    @GetMapping("/metrics")
    public ResponseEntity<List<SystemMetric>> getMetrics(
            @RequestParam(defaultValue = "60") int minutes) {
        Instant since = Instant.now().minus(minutes, ChronoUnit.MINUTES);
        return ResponseEntity.ok(metricsCollector.getHistory(since));
    }

    private SystemHealthDTO.ComponentHealth component(String name, String status,
            Double rate, Double latency, String error) {
        return SystemHealthDTO.ComponentHealth.builder()
                .name(name)
                .status(status)
                .rate(rate)
                .latencyMs(latency)
                .errorState(error)
                .build();
    }
}
