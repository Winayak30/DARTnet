package com.nexussoc.domain.repository;

import com.nexussoc.domain.entity.AlertEvidence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AlertEvidenceRepository extends JpaRepository<AlertEvidence, Long> {
    List<AlertEvidence> findByAlertId(String alertId);
    void deleteByAlertId(String alertId);
}
