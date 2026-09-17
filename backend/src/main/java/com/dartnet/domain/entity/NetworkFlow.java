package com.dartnet.domain.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Entity
@Table(name = "network_flows")
@Data
@NoArgsConstructor
public class NetworkFlow {

    @Id
    private String id;

    @Column(name = "replay_session_id")
    private Long replaySessionId;

    @Column(name = "flow_start", nullable = false)
    private Instant flowStart;

    @Column(name = "flow_end")
    private Instant flowEnd;

    @Column(name = "source_ip", nullable = false)
    private String sourceIp;

    @Column(name = "destination_ip", nullable = false)
    private String destinationIp;

    @Column(name = "source_port")
    private Integer sourcePort;

    @Column(name = "destination_port")
    private Integer destinationPort;

    @Column(name = "protocol", nullable = false)
    private String protocol;

    @Column(name = "packet_count")
    private Long packetCount = 0L;

    @Column(name = "byte_count")
    private Long byteCount = 0L;

    @Column(name = "duration_ms")
    private Long durationMs = 0L;

    @Column(name = "threat_score")
    private Double threatScore = 0.0;

    @Column(name = "threat_type")
    private String threatType;

    @Column(name = "status")
    private String status = "ACTIVE";

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();
}
