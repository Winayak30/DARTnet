package com.nexussoc.domain.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Entity
@Table(name = "flow_features")
@Data
@NoArgsConstructor
public class FlowFeature {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "flow_id", nullable = false)
    private String flowId;

    @Column(name = "feature_name", nullable = false)
    private String featureName;

    @Column(name = "numeric_value")
    private Double numericValue;

    @Column(name = "string_value")
    private String stringValue;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();
}
