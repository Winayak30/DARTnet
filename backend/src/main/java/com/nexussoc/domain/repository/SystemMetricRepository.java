package com.nexussoc.domain.repository;

import com.nexussoc.domain.entity.SystemMetric;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface SystemMetricRepository extends JpaRepository<SystemMetric, Long> {
    List<SystemMetric> findByRecordedAtAfterOrderByRecordedAtAsc(Instant since);
    Optional<SystemMetric> findTopByOrderByRecordedAtDesc();
    
    @Query("SELECT m FROM SystemMetric m ORDER BY m.recordedAt DESC")
    List<SystemMetric> findRecent(Pageable pageable);
}
