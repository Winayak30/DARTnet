package com.dartnet.domain.repository;

import com.dartnet.domain.entity.NetworkFlow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;

@Repository
public interface NetworkFlowRepository extends JpaRepository<NetworkFlow, String> {

    Page<NetworkFlow> findByOrderByFlowStartDesc(Pageable pageable);

    List<NetworkFlow> findBySourceIp(String sourceIp);

    List<NetworkFlow> findByDestinationIp(String destinationIp);

    @Query("SELECT COUNT(f) FROM NetworkFlow f WHERE f.status = 'ACTIVE'")
    long countActive();

    @Query("SELECT COUNT(f) FROM NetworkFlow f WHERE f.flowStart >= :since")
    long countSince(@Param("since") Instant since);

    @Query("SELECT f FROM NetworkFlow f WHERE f.threatScore > :minScore ORDER BY f.threatScore DESC")
    List<NetworkFlow> findThreats(@Param("minScore") double minScore);

    @Query("SELECT f FROM NetworkFlow f WHERE f.flowStart >= :since ORDER BY f.byteCount DESC")
    List<NetworkFlow> findTopTalkers(@Param("since") Instant since, Pageable pageable);

    List<NetworkFlow> findByReplaySessionId(Long sessionId);

    @Query("SELECT COUNT(f) FROM NetworkFlow f WHERE f.flowStart >= :since AND f.status = 'ACTIVE'")
    long countActiveSince(@Param("since") Instant since);
}
