package com.nexussoc.domain.repository;

import com.nexussoc.domain.entity.TrafficSource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TrafficSourceRepository extends JpaRepository<TrafficSource, Long> {
    List<TrafficSource> findBySourceType(String sourceType);
}
