package com.nexussoc.domain.repository;

import com.nexussoc.domain.entity.ReplaySession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ReplaySessionRepository extends JpaRepository<ReplaySession, Long> {
    Optional<ReplaySession> findTopByStatusOrderByCreatedAtDesc(String status);
    Optional<ReplaySession> findTopByOrderByCreatedAtDesc();
}
