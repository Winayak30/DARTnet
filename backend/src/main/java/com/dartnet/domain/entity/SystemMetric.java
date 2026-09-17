package com.dartnet.domain.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Entity
@Table(name = "system_metrics")
@Data
@NoArgsConstructor
public class SystemMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "recorded_at")
    private Instant recordedAt = Instant.now();

    @Column(name = "flows_per_sec")
    private Double flowsPerSec;

    @Column(name = "packets_per_sec")
    private Double packetsPerSec;

    @Column(name = "throughput_mbps")
    private Double throughputMbps;

    @Column(name = "active_flows")
    private Long activeFlows;

    @Column(name = "threats_detected")
    private Long threatsDetected;

    @Column(name = "critical_alerts")
    private Long criticalAlerts;

    @Column(name = "latency_p50_ms")
    private Double latencyP50Ms;

    @Column(name = "latency_p95_ms")
    private Double latencyP95Ms;

    @Column(name = "queue_depth")
    private Integer queueDepth;

    @Column(name = "dropped_events")
    private Long droppedEvents = 0L;

    @Column(name = "cpu_percent")
    private Double cpuPercent;

    @Column(name = "memory_percent")
    private Double memoryPercent;

    @Column(name = "disk_percent")
    private Double diskPercent;

    @Column(name = "alert_queue_size")
    private Integer alertQueueSize;

    @Column(name = "replay_status")
    private String replayStatus;
}
