package com.nexussoc.domain.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Entity
@Table(name = "threat_alerts")
@Data
@NoArgsConstructor
public class ThreatAlert {

    @Id
    private String id;

    @Column(name = "timestamp", nullable = false)
    private Instant timestamp;

    @Column(name = "flow_id")
    private String flowId;

    @Column(name = "threat_class", nullable = false)
    private String threatClass;

    @Column(name = "severity", nullable = false)
    private String severity;

    @Column(name = "confidence", nullable = false)
    private Double confidence;

    @Column(name = "source_ip")
    private String sourceIp;

    @Column(name = "destination_ip")
    private String destinationIp;

    @Column(name = "protocol")
    private String protocol;

    @Column(name = "detection_latency_ms")
    private Long detectionLatencyMs;

    @Column(name = "model_version")
    private String modelVersion;

    @Column(name = "status")
    private String status = "NEW";

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();
}
