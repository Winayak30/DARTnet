package com.nexussoc.controller;

import com.nexussoc.domain.entity.ThreatAlert;
import com.nexussoc.dto.AlertDTO;
import com.nexussoc.domain.repository.ThreatAlertRepository;
import com.nexussoc.service.AlertService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.StringWriter;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ThreatAlertRepository alertRepository;
    private final AlertService alertService;
    private final ObjectMapper objectMapper;

    @PostMapping("/alerts/export")
    public ResponseEntity<String> exportAlerts(
            @RequestBody(required = false) Map<String, String> body) throws Exception {

        String format = body != null ? body.getOrDefault("format", "JSON") : "JSON";
        List<ThreatAlert> alerts = alertRepository.findAll();

        if ("CSV".equalsIgnoreCase(format)) {
            String csv = toAlertCsv(alerts);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=alerts.csv")
                    .contentType(MediaType.parseMediaType("text/csv"))
                    .body(csv);
        } else {
            // JSON export
            List<AlertDTO> dtos = alerts.stream()
                    .map(a -> alertService.toDTO(a, List.of()))
                    .toList();
            String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(dtos);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=alerts.json")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(json);
        }
    }

    @PostMapping("/incidents")
    public ResponseEntity<String> generateIncidentReport() {
        Instant since = Instant.now().minus(24, ChronoUnit.HOURS);
        List<ThreatAlert> recent = alertRepository.findSince(since);

        StringBuilder report = new StringBuilder();
        report.append("NEXUS SOC - INCIDENT REPORT\n");
        report.append("Generated: ").append(Instant.now()).append("\n");
        report.append("SIH26145 | NTRO | Smart India Hackathon 2026\n");
        report.append("=".repeat(60)).append("\n\n");
        report.append("SUMMARY (last 24h)\n");
        report.append("Total alerts: ").append(recent.size()).append("\n");
        long critical = recent.stream().filter(a -> "CRITICAL".equals(a.getSeverity())).count();
        long high = recent.stream().filter(a -> "HIGH".equals(a.getSeverity())).count();
        report.append("Critical: ").append(critical).append("\n");
        report.append("High: ").append(high).append("\n\n");
        report.append("ALERT DETAILS\n").append("-".repeat(40)).append("\n");
        for (ThreatAlert alert : recent) {
            report.append("ID: ").append(alert.getId()).append("\n");
            report.append("  Time: ").append(alert.getTimestamp()).append("\n");
            report.append("  Threat: ").append(alert.getThreatClass()).append("\n");
            report.append("  Severity: ").append(alert.getSeverity()).append("\n");
            report.append("  Confidence: ").append(String.format("%.1f%%", alert.getConfidence() * 100)).append("\n");
            report.append("  Source: ").append(alert.getSourceIp()).append("\n");
            report.append("  Destination: ").append(alert.getDestinationIp()).append("\n");
            report.append("  Status: ").append(alert.getStatus()).append("\n\n");
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=incident_report.txt")
                .contentType(MediaType.TEXT_PLAIN)
                .body(report.toString());
    }

    private String toAlertCsv(List<ThreatAlert> alerts) {
        StringBuilder sb = new StringBuilder();
        sb.append("id,timestamp,flowId,threatClass,severity,confidence,sourceIp,destinationIp,protocol,detectionLatencyMs,status\n");
        for (ThreatAlert a : alerts) {
            sb.append(csv(a.getId())).append(",")
              .append(csv(String.valueOf(a.getTimestamp()))).append(",")
              .append(csv(a.getFlowId())).append(",")
              .append(csv(a.getThreatClass())).append(",")
              .append(csv(a.getSeverity())).append(",")
              .append(a.getConfidence()).append(",")
              .append(csv(a.getSourceIp())).append(",")
              .append(csv(a.getDestinationIp())).append(",")
              .append(csv(a.getProtocol())).append(",")
              .append(a.getDetectionLatencyMs()).append(",")
              .append(csv(a.getStatus())).append("\n");
        }
        return sb.toString();
    }

    private String csv(String val) {
        if (val == null) return "";
        if (val.contains(",") || val.contains("\"")) {
            return "\"" + val.replace("\"", "\"\"") + "\"";
        }
        return val;
    }
}
