package com.dartnet.domain.repository;

import com.dartnet.domain.entity.FlowFeature;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FlowFeatureRepository extends JpaRepository<FlowFeature, Long> {
    List<FlowFeature> findByFlowId(String flowId);
    void deleteByFlowId(String flowId);
}
