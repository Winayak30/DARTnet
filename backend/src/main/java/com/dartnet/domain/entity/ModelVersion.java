package com.dartnet.domain.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Entity
@Table(name = "model_versions")
@Data
@NoArgsConstructor
public class ModelVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "version", nullable = false)
    private String version;

    @Column(name = "model_type", nullable = false)
    private String modelType;

    @Column(name = "threat_class", nullable = false)
    private String threatClass;

    @Column(name = "dataset")
    private String dataset;

    @Column(name = "features_json", columnDefinition = "jsonb")
    private String featuresJson;

    @Column(name = "metrics_json", columnDefinition = "jsonb")
    private String metricsJson;

    @Column(name = "file_path")
    private String filePath;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();
}
