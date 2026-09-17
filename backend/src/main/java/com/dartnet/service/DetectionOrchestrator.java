package com.dartnet.service;

import com.dartnet.domain.entity.NetworkFlow;
import com.dartnet.dto.AlertDTO;
import com.dartnet.ml.MlContract;
import com.dartnet.ml.MlServiceClient;
import com.dartnet.metrics.MetricsCollector;
import com.dartnet.pipeline.FeatureExtractor;
import com.dartnet.pipeline.FlowState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Orchestrates detection pipeline for each processed flow.
 *
 * Pipeline per flow:
 *  1. Update sliding-window statistics
 *  2. Build 51 CICFlowMeter features from FlowState
 *  3. Ask unified ML service (ml-repo ThreatDetector) for a prediction
 *  4. If ML is unavailable, fall back to rule-based heuristics
 *  5. ALL rule checks run independently (B1 fix — no else-if chain)
 *  6. ML confidence always contributes to score fusion (B2 fix)
 *  7. Emit one alert per threat class detected (multiple per flow is possible)
 *
 * PASSIVE ONLY: No active responses, no mitigation, no active probing.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DetectionOrchestrator {

    private final FeatureExtractor featureExtractor;
    private final MlServiceClient mlClient;
    private final AlertService alertService;
    private final MetricsCollector metricsCollector;

    // ── Configurable thresholds (B3) — set in application.yml ────────────────
    @Value("${detection.ddos.flow-rate-threshold:100.0}")
    private double ddosFlowRateThreshold;

    @Value("${detection.ddos.syn-ratio-threshold:0.8}")
    private double ddosSynRatioThreshold;

    @Value("${detection.port-scan.min-ports:20}")
    private int portScanMinPorts;

    @Value("${detection.port-scan.min-hosts:5}")
    private int portScanMinHosts;

    @Value("${detection.dns.entropy-threshold:3.5}")
    private double dnsEntropyThreshold;

    @Value("${detection.dns.min-query-length:20}")
    private int dnsMinQueryLength;

    @Value("${detection.c2.periodicity-threshold:0.7}")
    private double c2PeriodicityThreshold;

    @Value("${detection.exfil.ratio-threshold:10.0}")
    private double exfilRatioThreshold;

    @Value("${detection.alert.min-confidence:0.5}")
    private double alertMinConfidence;

    // ── Sliding-window state ──────────────────────────────────────────────────
    private final ConcurrentHashMap<String, Long>        destFlowCount       = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<String>> destUniqueSources   = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<Integer>> srcUniquePorts     = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<String>> srcUniqueHosts      = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, List<Long>>  srcConnectionTimes  = new ConcurrentHashMap<>();

    // Dedup: one alert per (flowId, threatClass) pair
    private final Set<String> alertedKeys = Collections.newSetFromMap(new ConcurrentHashMap<>());

    // ── Entry point ───────────────────────────────────────────────────────────

    public void processFlow(FlowState flowState, NetworkFlow flow, String context) {
        long detectionStart = System.currentTimeMillis();

        updateWindowStats(flowState);

        // Build unified 51-feature CICFlowMeter map once per flow
        Map<String, Double> cicFeatures = buildCicFeatures(flowState);

        // Ask ML service — returns empty if service is down
        Optional<MlContract.PredictResponse> mlResult = callMl(flowState.getFlowId(), cicFeatures);

        // B1 fix: all detectors run independently — no else-if chain
        List<AlertDTO> alerts = new ArrayList<>();

        Optional<AlertDTO> ddos    = tryDdosDetection(flowState, cicFeatures, mlResult);
        Optional<AlertDTO> scan    = tryPortScanDetection(flowState, cicFeatures, mlResult);
        Optional<AlertDTO> dns     = tryDnsDetection(flowState, cicFeatures, mlResult);
        Optional<AlertDTO> c2      = tryC2Detection(flowState, cicFeatures, mlResult);
        Optional<AlertDTO> exfil   = tryExfilDetection(flowState, cicFeatures, mlResult);

        ddos.ifPresent(alerts::add);
        scan.ifPresent(alerts::add);
        dns.ifPresent(alerts::add);
        c2.ifPresent(alerts::add);
        exfil.ifPresent(alerts::add);

        // ML-only class that rules don't cover: Bots / Brute Force / Web Attacks / DoS
        mlResult.ifPresent(ml -> tryMlOnlyAlert(flowState, ml, alerts));

        long latency = System.currentTimeMillis() - detectionStart;
        for (AlertDTO alert : alerts) {
            alert.setDetectionLatencyMs(latency);
            alertService.createAlert(alert);
        }
        if (!alerts.isEmpty()) {
            metricsCollector.recordDetection(latency);
        }
    }

    // ── ML call ───────────────────────────────────────────────────────────────

    /**
     * Call the unified ML service with all 51 CICFlowMeter features.
     * Returns empty on any error so callers can fall back to rules.
     */
    private Optional<MlContract.PredictResponse> callMl(String flowId, Map<String, Double> features) {
        try {
            MlContract.PredictRequest req = MlContract.PredictRequest.builder()
                    .flowId(flowId)
                    .features(features)
                    .build();
            return mlClient.predict(req);
        } catch (Exception e) {
            log.debug("ML call failed for flow {}: {}", flowId, e.getMessage());
            return Optional.empty();
        }
    }

    // ── Score fusion (B2 fix) ─────────────────────────────────────────────────

    /**
     * Fuse rule score with ML confidence.
     *
     * B2 fix: we no longer gate on isThreat==true before using ML confidence.
     * If the ML says "normal" with high confidence that itself is evidence
     * against a rule-triggered alert, so we let it lower the fused score.
     *
     * If ML is unavailable (mlResponse is empty) the rule score is used directly.
     */
    private double fuseScores(double ruleScore, Optional<MlContract.PredictResponse> mlOpt) {
        if (mlOpt.isEmpty()) return ruleScore;
        // Use riskScore/100 as the ML signal — already fuses classifier + anomaly internally
        double mlSignal = mlOpt.get().getRiskScore() != null
                ? mlOpt.get().getRiskScore() / 100.0
                : (mlOpt.get().getConfidence() != null ? mlOpt.get().getConfidence() : 0.0);
        return 0.4 * ruleScore + 0.6 * mlSignal;
    }

    private String mlVersion(Optional<MlContract.PredictResponse> ml) {
        return ml.map(MlContract.PredictResponse::getModelVersion).orElse("rules-v1");
    }

    private String mlExplanation(Optional<MlContract.PredictResponse> ml) {
        return ml.map(MlContract.PredictResponse::getExplanation).orElse("");
    }

    private String mlSeverity(double score, Optional<MlContract.PredictResponse> ml) {
        // Prefer the ML-computed severity; fall back to score bucket
        if (ml.isPresent() && ml.get().getSeverity() != null
                && ml.get().getIsThreat() != null && ml.get().getIsThreat()) {
            return ml.get().getSeverity();
        }
        if (score >= 0.85) return "CRITICAL";
        if (score >= 0.70) return "HIGH";
        return "MEDIUM";
    }

    private boolean alreadyAlerted(String flowId, String threatClass) {
        return !alertedKeys.add(flowId + ":" + threatClass);
    }

    // ── DDoS ─────────────────────────────────────────────────────────────────

    private Optional<AlertDTO> tryDdosDetection(
            FlowState flow, Map<String, Double> features,
            Optional<MlContract.PredictResponse> ml) {

        if (alreadyAlerted(flow.getFlowId(), "SYN_FLOOD")) return Optional.empty();

        double synRatio = flow.getSynRatio();
        long flowCount = destFlowCount.getOrDefault(flow.getDestinationIp(), 0L);
        if (synRatio <= 0.5 && flowCount <= 50) return Optional.empty();

        Set<String> uniqueSources = destUniqueSources.getOrDefault(
                flow.getDestinationIp() + ":" + flow.getDestinationPort(), new HashSet<>());

        double ruleScore = 0.0;
        if (synRatio > ddosSynRatioThreshold) ruleScore += 0.4;
        else if (synRatio > 0.5) ruleScore += 0.2;
        if (uniqueSources.size() > 100) ruleScore += 0.4;
        else if (uniqueSources.size() > 20) ruleScore += 0.2;
        double flowRate = flowCount / Math.max(1.0, flow.getDurationMs() / 1000.0);
        if (flowRate > ddosFlowRateThreshold) ruleScore += 0.2;
        ruleScore = Math.min(ruleScore, 1.0);

        if (ruleScore < 0.3) return Optional.empty();

        double finalScore = fuseScores(ruleScore, ml);
        if (finalScore < alertMinConfidence) return Optional.empty();

        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("synRatio", String.format("%.3f", synRatio));
        evidence.put("flowRate", String.format("%.1f/s", flowRate));
        evidence.put("uniqueSourceIps", uniqueSources.size());
        evidence.put("sourceEntropy", String.format("%.3f", calculateEntropy(uniqueSources)));
        evidence.put("ruleScore", String.format("%.3f", ruleScore));
        evidence.put("fusedScore", String.format("%.3f", finalScore));
        ml.ifPresent(m -> {
            evidence.put("mlRiskScore", m.getRiskScore());
            evidence.put("mlExplanation", m.getExplanation());
        });

        return Optional.of(AlertDTO.builder()
                .flowId(flow.getFlowId())
                .timestamp(Instant.now())
                .threatClass("SYN_FLOOD")
                .severity(mlSeverity(finalScore, ml))
                .confidence(finalScore)
                .sourceIp(flow.getSourceIp())
                .destinationIp(flow.getDestinationIp())
                .protocol(flow.getProtocol())
                .modelVersion(mlVersion(ml))
                .evidence(evidence)
                .status("NEW")
                .build());
    }

    // ── Port Scan ─────────────────────────────────────────────────────────────

    private Optional<AlertDTO> tryPortScanDetection(
            FlowState flow, Map<String, Double> features,
            Optional<MlContract.PredictResponse> ml) {

        if (alreadyAlerted(flow.getFlowId(), "PORT_SCAN")) return Optional.empty();

        Set<Integer> uniquePorts = srcUniquePorts.getOrDefault(flow.getSourceIp(), new HashSet<>());
        if (uniquePorts.size() < portScanMinPorts) return Optional.empty();

        Set<String> uniqueHosts = srcUniqueHosts.getOrDefault(flow.getSourceIp(), new HashSet<>());
        double fanOut = (double) uniquePorts.size() / Math.max(uniqueHosts.size(), 1);

        double ruleScore = 0.0;
        if (uniquePorts.size() > portScanMinPorts) ruleScore += 0.3;
        if (uniquePorts.size() > 100) ruleScore += 0.2;
        if (uniquePorts.size() > 500) ruleScore += 0.2;
        if (uniqueHosts.size() > portScanMinHosts) ruleScore += 0.1;
        if (fanOut > 10) ruleScore += 0.2;
        ruleScore = Math.min(ruleScore, 1.0);

        if (ruleScore < 0.4) return Optional.empty();

        double finalScore = fuseScores(ruleScore, ml);
        if (finalScore < alertMinConfidence) return Optional.empty();

        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("uniqueDestPorts", uniquePorts.size());
        evidence.put("uniqueDestHosts", uniqueHosts.size());
        evidence.put("fanOut", String.format("%.1f", fanOut));
        evidence.put("synWithoutAck", flow.getSynCount() - flow.getAckCount());
        evidence.put("confidence", String.format("%.3f", finalScore));
        ml.ifPresent(m -> evidence.put("mlExplanation", m.getExplanation()));

        return Optional.of(AlertDTO.builder()
                .flowId(flow.getFlowId())
                .timestamp(Instant.now())
                .threatClass("PORT_SCAN")
                .severity(uniquePorts.size() > 500 ? "HIGH" : "MEDIUM")
                .confidence(finalScore)
                .sourceIp(flow.getSourceIp())
                .destinationIp(flow.getDestinationIp())
                .protocol(flow.getProtocol())
                .modelVersion(mlVersion(ml))
                .evidence(evidence)
                .status("NEW")
                .build());
    }

    // ── DNS / DGA ─────────────────────────────────────────────────────────────

    private Optional<AlertDTO> tryDnsDetection(
            FlowState flow, Map<String, Double> features,
            Optional<MlContract.PredictResponse> ml) {

        if (alreadyAlerted(flow.getFlowId(), "DNS_TUNNEL")) return Optional.empty();
        if (!"UDP".equals(flow.getProtocol()) || flow.getDnsQueryCount() <= 10) return Optional.empty();

        List<String> queries = flow.getDnsQueries();
        if (queries.isEmpty()) return Optional.empty();

        String worstDomain = queries.stream()
                .filter(d -> d.length() > dnsMinQueryLength)
                .max(Comparator.comparingDouble(featureExtractor::calculateEntropy))
                .orElse(queries.get(0));

        double entropy = featureExtractor.calculateEntropy(worstDomain);
        double queryRate = flow.getDnsQueryCount() / Math.max(1.0, flow.getDurationMs() / 1000.0);

        double ruleScore = 0.0;
        if (entropy > dnsEntropyThreshold) ruleScore += 0.3;
        else if (entropy > 3.0) ruleScore += 0.15;
        if (worstDomain.length() > dnsMinQueryLength) ruleScore += 0.1;
        if (queryRate > 1.0) ruleScore += 0.2;
        ruleScore = Math.min(ruleScore, 1.0);

        if (ruleScore < 0.4) return Optional.empty();

        double finalScore = fuseScores(ruleScore, ml);
        if (finalScore < alertMinConfidence) return Optional.empty();

        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("suspiciousDomain", worstDomain);
        evidence.put("domainEntropy", String.format("%.3f", entropy));
        evidence.put("domainLength", worstDomain.length());
        evidence.put("queryCount", flow.getDnsQueryCount());
        evidence.put("queryRate", String.format("%.2f/s", queryRate));
        evidence.put("confidence", String.format("%.3f", finalScore));
        ml.ifPresent(m -> evidence.put("mlExplanation", m.getExplanation()));

        return Optional.of(AlertDTO.builder()
                .flowId(flow.getFlowId())
                .timestamp(Instant.now())
                .threatClass("DNS_TUNNEL")
                .severity(finalScore > 0.8 ? "HIGH" : "MEDIUM")
                .confidence(finalScore)
                .sourceIp(flow.getSourceIp())
                .destinationIp(flow.getDestinationIp())
                .protocol("UDP")
                .modelVersion(mlVersion(ml))
                .evidence(evidence)
                .status("NEW")
                .build());
    }

    // ── C2 Beaconing ──────────────────────────────────────────────────────────

    private Optional<AlertDTO> tryC2Detection(
            FlowState flow, Map<String, Double> features,
            Optional<MlContract.PredictResponse> ml) {

        if (alreadyAlerted(flow.getFlowId(), "C2_BEACON")) return Optional.empty();
        if (flow.getInterArrivalMs().size() <= 10 || flow.getPacketCount() <= 10) return Optional.empty();

        double meanIat = flow.getMeanInterArrivalMs();
        double variance = flow.getInterArrivalVariance();
        double cv = meanIat > 0 ? Math.sqrt(variance) / meanIat : 1.0;
        double periodicityScore = Math.max(0.0, Math.min(1.0, 1.0 - cv * 0.5));

        if (periodicityScore < c2PeriodicityThreshold) return Optional.empty();

        double finalScore = fuseScores(periodicityScore, ml);
        if (finalScore < alertMinConfidence) return Optional.empty();

        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("meanInterArrivalMs", String.format("%.1f", meanIat));
        evidence.put("interArrivalVariance", String.format("%.3f", variance));
        evidence.put("periodicityScore", String.format("%.3f", periodicityScore));
        evidence.put("packetCount", flow.getPacketCount());
        evidence.put("flowDurationMs", flow.getDurationMs());
        ml.ifPresent(m -> evidence.put("mlExplanation", m.getExplanation()));

        return Optional.of(AlertDTO.builder()
                .flowId(flow.getFlowId())
                .timestamp(Instant.now())
                .threatClass("C2_BEACON")
                .severity(mlSeverity(finalScore, ml))
                .confidence(finalScore)
                .sourceIp(flow.getSourceIp())
                .destinationIp(flow.getDestinationIp())
                .protocol(flow.getProtocol())
                .modelVersion(mlVersion(ml))
                .evidence(evidence)
                .status("NEW")
                .build());
    }

    // ── Data Exfiltration ─────────────────────────────────────────────────────

    private Optional<AlertDTO> tryExfilDetection(
            FlowState flow, Map<String, Double> features,
            Optional<MlContract.PredictResponse> ml) {

        if (alreadyAlerted(flow.getFlowId(), "DATA_EXFILTRATION")) return Optional.empty();
        if (flow.getByteCount() <= 1_000_000) return Optional.empty();  // < 1 MB — skip

        long outbound = flow.getByteCount();
        long inbound  = Math.max(1, outbound / 20);
        double ratio  = (double) outbound / inbound;

        if (ratio < exfilRatioThreshold) return Optional.empty();

        double ruleScore = Math.min(1.0, (ratio - exfilRatioThreshold) / 20.0 + 0.5);
        double finalScore = fuseScores(ruleScore, ml);
        if (finalScore < alertMinConfidence) return Optional.empty();

        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("outboundBytes", outbound);
        evidence.put("outboundInboundRatio", String.format("%.1f:1", ratio));
        evidence.put("transferRateBps",
                String.format("%.0f", outbound / Math.max(1.0, flow.getDurationMs() / 1000.0)));
        evidence.put("flowDurationMs", flow.getDurationMs());
        ml.ifPresent(m -> evidence.put("mlExplanation", m.getExplanation()));

        return Optional.of(AlertDTO.builder()
                .flowId(flow.getFlowId())
                .timestamp(Instant.now())
                .threatClass("DATA_EXFILTRATION")
                .severity("HIGH")
                .confidence(finalScore)
                .sourceIp(flow.getSourceIp())
                .destinationIp(flow.getDestinationIp())
                .protocol(flow.getProtocol())
                .modelVersion(mlVersion(ml))
                .evidence(evidence)
                .status("NEW")
                .build());
    }

    // ── ML-only classes (Bots, Brute Force, Web Attacks, DoS) ────────────────

    /**
     * These threat classes are not covered by the rule-based detectors above
     * (CICIDS2017 has no DNS metadata, so DoS/Bots/BruteForce/WebAttacks come
     * purely from ML). Emit an alert when ML says so with sufficient confidence.
     */
    private void tryMlOnlyAlert(FlowState flow, MlContract.PredictResponse ml, List<AlertDTO> alerts) {
        if (ml.getIsThreat() == null || !ml.getIsThreat()) return;
        if (ml.getRiskScore() == null || ml.getRiskScore() < (alertMinConfidence * 100)) return;

        String mlClass = ml.getThreatClass();
        // Skip classes already covered by rule detectors to avoid double-alerting
        if (mlClass == null) return;
        switch (mlClass) {
            case "DDoS", "Port Scanning" -> { return; }  // handled by rules above
        }

        String internalClass = switch (mlClass) {
            case "DoS"         -> "DOS_ATTACK";
            case "Bots"        -> "C2_BEACON";
            case "Brute Force" -> "BRUTE_FORCE";
            case "Web Attacks" -> "WEB_ATTACK";
            default            -> mlClass.toUpperCase().replace(' ', '_');
        };

        if (alreadyAlerted(flow.getFlowId(), internalClass)) return;

        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("mlThreatClass", mlClass);
        evidence.put("mlConfidence", ml.getConfidence());
        evidence.put("mlAnomalyScore", ml.getAnomalyScore());
        evidence.put("mlRiskScore", ml.getRiskScore());
        evidence.put("mlExplanation", ml.getExplanation());
        if (ml.getEvidence() != null) evidence.putAll(ml.getEvidence());

        AlertDTO alert = AlertDTO.builder()
                .flowId(flow.getFlowId())
                .timestamp(Instant.now())
                .threatClass(internalClass)
                .severity(ml.getSeverity() != null ? ml.getSeverity() : "MEDIUM")
                .confidence(ml.getRiskScore() / 100.0)
                .sourceIp(flow.getSourceIp())
                .destinationIp(flow.getDestinationIp())
                .protocol(flow.getProtocol())
                .modelVersion(ml.getModelVersion())
                .evidence(evidence)
                .status("NEW")
                .build();

        alerts.add(alert);
    }

    // ── CICFlowMeter feature construction ────────────────────────────────────

    /**
     * Maps FlowState fields to the 51 CICFlowMeter column names expected by
     * the ml-repo ThreatDetector. Missing or uncomputable features default to 0.
     *
     * The mapping is best-effort: many CICFlowMeter features require bidirectional
     * traffic; for passive one-direction capture we set forward = observed,
     * backward = 0, which is sufficient for the classifier to work.
     */
    private Map<String, Double> buildCicFeatures(FlowState flow) {
        double durationUs = flow.getDurationMs() * 1000.0;   // CICFlowMeter uses microseconds
        double totalPkts  = flow.getPacketCount();
        double totalBytes = flow.getByteCount();
        double durationSec = Math.max(flow.getDurationMs() / 1000.0, 0.001);

        double meanPktLen  = flow.getMeanPacketSize();
        double maxPktLen   = flow.getPacketSizes().stream().mapToInt(Integer::intValue).max().orElse(0);
        double minPktLen   = flow.getPacketSizes().stream().mapToInt(Integer::intValue).min().orElse(0);
        double pktLenVar   = computeVariance(flow.getPacketSizes().stream()
                                .mapToDouble(Integer::doubleValue).toArray(), meanPktLen);
        double pktLenStd   = Math.sqrt(pktLenVar);

        double meanIat     = flow.getMeanInterArrivalMs() * 1000.0;  // µs
        double iatVariance = flow.getInterArrivalVariance();
        double iatStd      = Math.sqrt(iatVariance) * 1000.0;
        double iatMax      = flow.getInterArrivalMs().stream().mapToLong(Long::longValue).max().orElse(0) * 1000.0;
        double iatMin      = flow.getInterArrivalMs().stream().mapToLong(Long::longValue).min().orElse(0) * 1000.0;

        Map<String, Double> f = new LinkedHashMap<>();

        // --- Basic flow identifiers ---
        f.put("Destination Port",            flow.getDestinationPort() != null ? flow.getDestinationPort().doubleValue() : 0.0);
        f.put("Flow Duration",               durationUs);
        f.put("Total Fwd Packets",           totalPkts);
        f.put("Total Length of Fwd Packets", totalBytes);

        // --- Forward packet length stats (treat all packets as fwd for passive capture) ---
        f.put("Fwd Packet Length Max",  maxPktLen);
        f.put("Fwd Packet Length Min",  minPktLen);
        f.put("Fwd Packet Length Mean", meanPktLen);
        f.put("Fwd Packet Length Std",  pktLenStd);

        // --- Backward (zero for one-directional passive capture) ---
        f.put("Bwd Packet Length Max",  0.0);
        f.put("Bwd Packet Length Min",  0.0);
        f.put("Bwd Packet Length Mean", 0.0);
        f.put("Bwd Packet Length Std",  0.0);

        // --- Throughput ---
        f.put("Flow Bytes/s",    totalBytes  / durationSec);
        f.put("Flow Packets/s",  totalPkts   / durationSec);

        // --- Flow IAT ---
        f.put("Flow IAT Mean", meanIat);
        f.put("Flow IAT Std",  iatStd);
        f.put("Flow IAT Max",  iatMax);
        f.put("Flow IAT Min",  iatMin);

        // --- Fwd IAT ---
        f.put("Fwd IAT Total", durationUs);
        f.put("Fwd IAT Mean",  meanIat);
        f.put("Fwd IAT Std",   iatStd);
        f.put("Fwd IAT Max",   iatMax);
        f.put("Fwd IAT Min",   iatMin);

        // --- Bwd IAT (zero) ---
        f.put("Bwd IAT Total", 0.0);
        f.put("Bwd IAT Mean",  0.0);
        f.put("Bwd IAT Std",   0.0);
        f.put("Bwd IAT Max",   0.0);
        f.put("Bwd IAT Min",   0.0);

        // --- Header lengths (TCP = 20 bytes typical) ---
        f.put("Fwd Header Length", totalPkts * 20.0);
        f.put("Bwd Header Length", 0.0);

        // --- Packet rates ---
        f.put("Fwd Packets/s", totalPkts  / durationSec);
        f.put("Bwd Packets/s", 0.0);

        // --- Packet length aggregates ---
        f.put("Min Packet Length",      minPktLen);
        f.put("Max Packet Length",      maxPktLen);
        f.put("Packet Length Mean",     meanPktLen);
        f.put("Packet Length Std",      pktLenStd);
        f.put("Packet Length Variance", pktLenVar);

        // --- TCP flags ---
        f.put("FIN Flag Count", (double) flow.getFinCount());
        f.put("PSH Flag Count", 0.0);  // not tracked in FlowState
        f.put("ACK Flag Count", (double) flow.getAckCount());

        // --- Average packet size ---
        f.put("Average Packet Size", meanPktLen);

        // --- Subflow (same as fwd for passive) ---
        f.put("Subflow Fwd Bytes", totalBytes);

        // --- TCP init window (typical default) ---
        f.put("Init_Win_bytes_forward",  65535.0);
        f.put("Init_Win_bytes_backward", 0.0);

        // --- Active data packets ---
        f.put("act_data_pkt_fwd",      totalPkts);
        f.put("min_seg_size_forward",  minPktLen);

        // --- Active/Idle (zero — not tracked at this level) ---
        f.put("Active Mean", 0.0);
        f.put("Active Max",  0.0);
        f.put("Active Min",  0.0);
        f.put("Idle Mean",   0.0);
        f.put("Idle Max",    0.0);
        f.put("Idle Min",    0.0);

        return f;
    }

    private double computeVariance(double[] values, double mean) {
        if (values.length == 0) return 0.0;
        double sum = 0;
        for (double v : values) sum += (v - mean) * (v - mean);
        return sum / values.length;
    }

    // ── Sliding-window updates ────────────────────────────────────────────────

    private void updateWindowStats(FlowState flow) {
        destFlowCount.merge(flow.getDestinationIp(), 1L, Long::sum);

        String destKey = flow.getDestinationIp() + ":" + flow.getDestinationPort();
        destUniqueSources
                .computeIfAbsent(destKey, k -> Collections.newSetFromMap(new ConcurrentHashMap<>()))
                .add(flow.getSourceIp());

        if (flow.getDestinationPort() != null) {
            srcUniquePorts
                    .computeIfAbsent(flow.getSourceIp(), k -> Collections.newSetFromMap(new ConcurrentHashMap<>()))
                    .add(flow.getDestinationPort());
        }

        srcUniqueHosts
                .computeIfAbsent(flow.getSourceIp(), k -> Collections.newSetFromMap(new ConcurrentHashMap<>()))
                .add(flow.getDestinationIp());

        srcConnectionTimes
                .computeIfAbsent(flow.getSourceIp(), k -> Collections.synchronizedList(new ArrayList<>()))
                .add(System.currentTimeMillis());
    }

    private double calculateEntropy(Set<String> items) {
        if (items.isEmpty()) return 0;
        Map<String, Long> freq = new HashMap<>();
        for (String item : items) {
            String subnet = item.contains(".") ? item.substring(0, item.lastIndexOf('.')) : item;
            freq.merge(subnet, 1L, Long::sum);
        }
        double total = items.size();
        double entropy = 0;
        for (long count : freq.values()) {
            double p = count / total;
            entropy -= p * (Math.log(p) / Math.log(2));
        }
        return entropy;
    }

    /** Reset all sliding-window state — called on replay reset. */
    public void resetWindowStats() {
        destFlowCount.clear();
        destUniqueSources.clear();
        srcUniquePorts.clear();
        srcUniqueHosts.clear();
        srcConnectionTimes.clear();
        alertedKeys.clear();
    }
}
