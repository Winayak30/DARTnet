package com.dartnet.domain.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Entity
@Table(name = "replay_sessions")
@Data
@NoArgsConstructor
public class ReplaySession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "traffic_source_id")
    private Long trafficSourceId;

    @Column(name = "scenario")
    private String scenario;

    @Column(name = "speed_multiplier")
    private Double speedMultiplier = 1.0;

    @Column(name = "status")
    private String status = "STOPPED";

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "paused_at")
    private Instant pausedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "flows_processed")
    private Long flowsProcessed = 0L;

    @Column(name = "packets_processed")
    private Long packetsProcessed = 0L;

    @Column(name = "bytes_processed")
    private Long bytesProcessed = 0L;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();
}
