package com.nexussoc.controller;

import com.nexussoc.domain.entity.ThreatAlert;
import com.nexussoc.dto.AlertDTO;
import com.nexussoc.domain.repository.AlertEvidenceRepository;
import com.nexussoc.service.AlertService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertService alertService;
    private final AlertEvidenceRepository evidenceRepository;

    @GetMapping
    public ResponseEntity<Page<ThreatAlert>> getAlerts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String threatClass,
            @RequestParam(required = false) String status) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("timestamp").descending());
        Page<ThreatAlert> result;

        if (severity != null) {
            result = alertService.findAll(pageable); // TODO: filter in query
        } else {
            result = alertService.findAll(pageable);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AlertDTO> getAlert(@PathVariable String id) {
        return alertService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<AlertDTO> updateStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        String newStatus = body.get("status");
        if (newStatus == null || newStatus.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            return ResponseEntity.ok(alertService.updateStatus(id, newStatus));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/recent")
    public ResponseEntity<List<AlertDTO>> getRecent(@RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(alertService.findRecent(limit));
    }
}
