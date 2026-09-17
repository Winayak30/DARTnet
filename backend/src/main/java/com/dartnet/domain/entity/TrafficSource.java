package com.dartnet.domain.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Entity
@Table(name = "traffic_sources")
@Data
@NoArgsConstructor
public class TrafficSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "source_type", nullable = false)
    private String sourceType;

    @Column(name = "file_path")
    private String filePath;

    @Column(name = "description")
    private String description;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();
}
