package com.dartnet.domain.repository;

import com.dartnet.domain.entity.ThreatAlert;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;

@Repository
public interface ThreatAlertRepository extends JpaRepository<ThreatAlert, String> {

    Page<ThreatAlert> findByOrderByTimestampDesc(Pageable pageable);

    Page<ThreatAlert> findBySeverityOrderByTimestampDesc(String severity, Pageable pageable);

    Page<ThreatAlert> findByThreatClassOrderByTimestampDesc(String threatClass, Pageable pageable);

    Page<ThreatAlert> findByStatusOrderByTimestampDesc(String status, Pageable pageable);

    List<ThreatAlert> findTop10ByOrderByTimestampDesc();

    @Query("SELECT COUNT(a) FROM ThreatAlert a WHERE a.severity = :severity")
    long countBySeverity(@Param("severity") String severity);

    @Query("SELECT COUNT(a) FROM ThreatAlert a WHERE a.timestamp >= :since")
    long countSince(@Param("since") Instant since);

    @Query("SELECT COUNT(a) FROM ThreatAlert a WHERE a.threatClass = :threatClass AND a.timestamp >= :since")
    long countByThreatClassSince(@Param("threatClass") String threatClass, @Param("since") Instant since);

    List<ThreatAlert> findBySourceIpOrDestinationIp(String sourceIp, String destIp);

    List<ThreatAlert> findByFlowId(String flowId);

    @Query("SELECT a FROM ThreatAlert a WHERE a.sourceIp = :ip OR a.destinationIp = :ip ORDER BY a.timestamp DESC")
    List<ThreatAlert> findByIp(@Param("ip") String ip);

    @Query(value = "SELECT * FROM threat_alerts WHERE timestamp >= :since ORDER BY timestamp DESC", nativeQuery = true)
    List<ThreatAlert> findSince(@Param("since") Instant since);
}
