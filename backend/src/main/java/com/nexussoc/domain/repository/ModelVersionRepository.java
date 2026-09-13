package com.nexussoc.domain.repository;

import com.nexussoc.domain.entity.ModelVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ModelVersionRepository extends JpaRepository<ModelVersion, Long> {
    List<ModelVersion> findByIsActiveTrue();
    Optional<ModelVersion> findByThreatClassAndIsActiveTrue(String threatClass);
    Optional<ModelVersion> findByNameAndVersion(String name, String version);
}
