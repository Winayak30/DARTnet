package com.dartnet.controller;

import com.dartnet.domain.entity.NetworkFlow;
import com.dartnet.domain.repository.FlowFeatureRepository;
import com.dartnet.domain.repository.NetworkFlowRepository;
import com.dartnet.dto.FlowDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/flows")
@RequiredArgsConstructor
public class FlowController {

    private final NetworkFlowRepository flowRepository;
    private final FlowFeatureRepository featureRepository;

    @GetMapping
    public ResponseEntity<Page<NetworkFlow>> getFlows(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("flowStart").descending());
        return ResponseEntity.ok(flowRepository.findByOrderByFlowStartDesc(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getFlow(@PathVariable String id) {
        return flowRepository.findById(id)
                .map(flow -> {
                    var features = featureRepository.findByFlowId(id);
                    Map<String, Object> result = new LinkedHashMap<>();
                    result.put("flow", toDTO(flow));
                    result.put("features", features);
                    return ResponseEntity.ok(result);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private FlowDTO toDTO(NetworkFlow f) {
        return FlowDTO.builder()
                .id(f.getId())
                .flowStart(f.getFlowStart())
                .flowEnd(f.getFlowEnd())
                .sourceIp(f.getSourceIp())
                .destinationIp(f.getDestinationIp())
                .sourcePort(f.getSourcePort())
                .destinationPort(f.getDestinationPort())
                .protocol(f.getProtocol())
                .packetCount(f.getPacketCount())
                .byteCount(f.getByteCount())
                .durationMs(f.getDurationMs())
                .threatScore(f.getThreatScore())
                .threatType(f.getThreatType())
                .status(f.getStatus())
                .build();
    }
}
