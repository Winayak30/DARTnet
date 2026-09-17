package com.dartnet.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.dartnet.domain.entity.AlertEvidence;
import com.dartnet.domain.entity.ThreatAlert;
import com.dartnet.domain.repository.AlertEvidenceRepository;
import com.dartnet.domain.repository.ThreatAlertRepository;
import com.dartnet.dto.AlertDTO;
import com.dartnet.websocket.WebSocketBroadcaster;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Alert lifecycle management service.
 * Creates, updates, and queries threat alerts.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AlertService {

    private final ThreatAlertRepository alertRepository;
    private final AlertEvidenceRepository evidenceRepository;
    private final WebSocketBroadcaster broadcaster;
    private final ObjectMapper objectMapper;

    private static final AtomicLong alertSequence = new AtomicLong(0);

    /**
     * Create and persist a new alert from detection output.
     * Broadcasts via WebSocket to connected frontend clients.
     */
    @Transactional
    public AlertDTO createAlert(AlertDTO dto) {
        String alertId = generateAlertId();
        dto.setId(alertId);
        if (dto.getTimestamp() == null) {
            dto.setTimestamp(Instant.now());
        }

        ThreatAlert alert = toEntity(dto);
        alertRepository.save(alert);

        // Persist evidence
        if (dto.getEvidence() != null) {
            persistEvidence(alertId, dto.getEvidence());
        }

        log.info("Alert created: {} threatClass={} severity={} confidence={}",
                alertId, dto.getThreatClass(), dto.getSeverity(), dto.getConfidence());

        broadcaster.broadcastAlert(dto);
        return dto;
    }

    @Transactional
    public AlertDTO updateStatus(String alertId, String newStatus) {
        ThreatAlert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new NoSuchElementException("Alert not found: " + alertId));
        alert.setStatus(newStatus);
        alert.setUpdatedAt(Instant.now());
        alertRepository.save(alert);

        AlertDTO dto = toDTO(alert, loadEvidence(alertId));
        broadcaster.broadcastAlertUpdate(dto);
        return dto;
    }

    public Optional<AlertDTO> findById(String alertId) {
        return alertRepository.findById(alertId)
                .map(a -> toDTO(a, loadEvidence(alertId)));
    }

    public Page<ThreatAlert> findAll(Pageable pageable) {
        return alertRepository.findByOrderByTimestampDesc(pageable);
    }

    public List<AlertDTO> findRecent(int limit) {
        return alertRepository.findTop10ByOrderByTimestampDesc()
                .stream().map(a -> toDTO(a, List.of())).toList();
    }

    public long countBySeverity(String severity) {
        return alertRepository.countBySeverity(severity);
    }

    public long countByThreatClassSince(String threatClass, Instant since) {
        return alertRepository.countByThreatClassSince(threatClass, since);
    }

    public long countSince(Instant since) {
        return alertRepository.countSince(since);
    }

    public List<AlertDTO> findByIp(String ip) {
        return alertRepository.findByIp(ip).stream()
                .map(a -> toDTO(a, List.of())).toList();
    }

    private String generateAlertId() {
        long seq = alertSequence.incrementAndGet();
        // Check existing max
        return String.format("ALT-%06d", seq);
    }

    private void persistEvidence(String alertId, Map<String, Object> evidence) {
        for (Map.Entry<String, Object> entry : evidence.entrySet()) {
            AlertEvidence ev = new AlertEvidence();
            ev.setAlertId(alertId);
            ev.setFeatureName(entry.getKey());
            ev.setObservedValue(String.valueOf(entry.getValue()));
            evidenceRepository.save(ev);
        }
    }

    private List<AlertEvidence> loadEvidence(String alertId) {
        return evidenceRepository.findByAlertId(alertId);
    }

    private ThreatAlert toEntity(AlertDTO dto) {
        ThreatAlert a = new ThreatAlert();
        a.setId(dto.getId());
        a.setTimestamp(dto.getTimestamp() != null ? dto.getTimestamp() : Instant.now());
        a.setFlowId(dto.getFlowId());
        a.setThreatClass(dto.getThreatClass());
        a.setSeverity(dto.getSeverity());
        a.setConfidence(dto.getConfidence());
        a.setSourceIp(dto.getSourceIp());
        a.setDestinationIp(dto.getDestinationIp());
        a.setProtocol(dto.getProtocol());
        a.setDetectionLatencyMs(dto.getDetectionLatencyMs());
        a.setModelVersion(dto.getModelVersion());
        a.setStatus(dto.getStatus() != null ? dto.getStatus() : "NEW");
        return a;
    }

    public AlertDTO toDTO(ThreatAlert a, List<AlertEvidence> evidenceList) {
        Map<String, Object> evidenceMap = new LinkedHashMap<>();
        for (AlertEvidence ev : evidenceList) {
            evidenceMap.put(ev.getFeatureName(), ev.getObservedValue());
        }
        return AlertDTO.builder()
                .id(a.getId())
                .timestamp(a.getTimestamp())
                .flowId(a.getFlowId())
                .threatClass(a.getThreatClass())
                .severity(a.getSeverity())
                .confidence(a.getConfidence())
                .sourceIp(a.getSourceIp())
                .destinationIp(a.getDestinationIp())
                .protocol(a.getProtocol())
                .detectionLatencyMs(a.getDetectionLatencyMs())
                .modelVersion(a.getModelVersion())
                .evidence(evidenceMap.isEmpty() ? null : evidenceMap)
                .status(a.getStatus())
                .build();
    }
}
