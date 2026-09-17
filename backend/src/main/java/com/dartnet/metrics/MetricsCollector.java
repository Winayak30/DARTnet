package com.dartnet.metrics;

import com.dartnet.domain.entity.SystemMetric;
import com.dartnet.domain.repository.NetworkFlowRepository;
import com.dartnet.domain.repository.SystemMetricRepository;
import com.dartnet.domain.repository.ThreatAlertRepository;
import com.dartnet.websocket.WebSocketBroadcaster;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.OperatingSystemMXBean;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.*;

/**
 * Collects and aggregates real system metrics.
 * Periodically samples and persists to database.
 * Broadcasts updates via WebSocket.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MetricsCollector {

    private final SystemMetricRepository metricRepository;
    private final NetworkFlowRepository flowRepository;
    private final ThreatAlertRepository alertRepository;
    private final WebSocketBroadcaster broadcaster;

    // Counters (reset each interval)
    private final AtomicLong packetCount = new AtomicLong(0);
    private final AtomicLong byteCount = new AtomicLong(0);
    private final AtomicLong detectionCount = new AtomicLong(0);
    private final AtomicLong droppedEvents = new AtomicLong(0);
    private final List<Long> detectionLatencies = Collections.synchronizedList(new ArrayList<>());

    private Instant lastReset = Instant.now();

    public void recordPacket(int bytes) {
        packetCount.incrementAndGet();
        byteCount.addAndGet(bytes);
    }

    public void recordDetection(long latencyMs) {
        detectionCount.incrementAndGet();
        detectionLatencies.add(latencyMs);
        if (detectionLatencies.size() > 1000) {
            synchronized (detectionLatencies) {
                if (detectionLatencies.size() > 1000) {
                    detectionLatencies.remove(0);
                }
            }
        }
    }

    public void recordDropped() {
        droppedEvents.incrementAndGet();
    }

    @Scheduled(fixedDelay = 1000) // every second
    public void collectAndBroadcast() {
        try {
            Instant now = Instant.now();
            long intervalMs = now.toEpochMilli() - lastReset.toEpochMilli();
            double intervalSec = Math.max(1.0, intervalMs / 1000.0);

            long packets = packetCount.getAndSet(0);
            long bytes = byteCount.getAndSet(0);
            lastReset = now;

            double packetsPerSec = packets / intervalSec;
            double mbps = (bytes * 8.0) / (intervalSec * 1_000_000.0);

            // Calculate latency percentiles
            List<Long> latencies;
            synchronized (detectionLatencies) {
                latencies = new ArrayList<>(detectionLatencies);
            }
            Collections.sort(latencies);
            double p50 = percentile(latencies, 50);
            double p95 = percentile(latencies, 95);

            // DB counts
            long activeFlows = flowRepository.countActive();
            long totalThreats = alertRepository.count();
            long criticalAlerts = alertRepository.countBySeverity("CRITICAL");

            // System resources
            OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
            MemoryMXBean memBean = ManagementFactory.getMemoryMXBean();
            double cpuLoad = osBean.getSystemLoadAverage();
            if (cpuLoad < 0) cpuLoad = 0;
            double heapUsed = memBean.getHeapMemoryUsage().getUsed();
            double heapMax = memBean.getHeapMemoryUsage().getMax();
            double memPercent = heapMax > 0 ? (heapUsed / heapMax) * 100.0 : 0;

            SystemMetric metric = new SystemMetric();
            metric.setRecordedAt(now);
            metric.setPacketsPerSec(packetsPerSec);
            metric.setThroughputMbps(mbps);
            metric.setActiveFlows(activeFlows);
            metric.setThreatsDetected(totalThreats);
            metric.setCriticalAlerts(criticalAlerts);
            metric.setLatencyP50Ms(p50);
            metric.setLatencyP95Ms(p95);
            metric.setDroppedEvents(droppedEvents.get());
            metric.setCpuPercent(cpuLoad);
            metric.setMemoryPercent(memPercent);
            metric.setAlertQueueSize((int) Math.min(totalThreats, Integer.MAX_VALUE));

            metricRepository.save(metric);
            broadcaster.broadcastTrafficUpdate(metric);

        } catch (Exception e) {
            log.warn("Metrics collection error: {}", e.getMessage());
        }
    }

    public Optional<SystemMetric> getLatest() {
        return metricRepository.findTopByOrderByRecordedAtDesc();
    }

    public List<SystemMetric> getHistory(Instant since) {
        return metricRepository.findByRecordedAtAfterOrderByRecordedAtAsc(since);
    }

    private double percentile(List<Long> sorted, int pct) {
        if (sorted.isEmpty()) return 0.0;
        int idx = (int) Math.ceil(pct / 100.0 * sorted.size()) - 1;
        return sorted.get(Math.max(0, Math.min(idx, sorted.size() - 1)));
    }
}
