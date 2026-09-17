package com.dartnet.domain.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "alert_evidence")
@Data
@NoArgsConstructor
public class AlertEvidence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "alert_id", nullable = false)
    private String alertId;

    @Column(name = "feature_name", nullable = false)
    private String featureName;

    @Column(name = "observed_value", nullable = false)
    private String observedValue;

    @Column(name = "threshold")
    private String threshold;

    @Column(name = "interpretation")
    private String interpretation;
}
