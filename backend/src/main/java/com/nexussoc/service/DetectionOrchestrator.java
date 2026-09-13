package com.nexussoc.service;

import com.nexussoc.domain.entity.NetworkFlow;
import com.nexussoc.dto.AlertDTO;
import com.nexussoc.ml.MlContract;
import com.nexussoc.ml.MlServiceClient;
import com.nexussoc.metrics.MetricsCollector;
import com.nexussoc.pipeline.FeatureExtractor;
import com.nexussoc.pipeline.FlowState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Orchestrates detection pipeline for each processed flow.
 * 
 * For each flow it:
 * 1. Extracts features
 * 2. Runs statistical/rule-based detectors
 * 3. Calls ML service for probabilistic detection
 * 4. Fuses scores
 * 5. Generates alert if threshold exceeded
 * 
 * PASSIVE ONLY: No active responses, no mitigation, no probing.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DetectionOrchestrator {

    private final FeatureExtractor featureExtractor;
    private final MlServiceClient mlClient;
    private final AlertService alertService;
    private final MetricsCollector metricsCollector;

    // Statistical tracking windows (per destination for DDoS, per source for scans)
    private final ConcurrentHashMap<String, Long> destFlowCount = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<String>> destUniqueSources = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<Integer>> srcUniquePorts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<String>> srcUniqueHosts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, List<Long>> srcConnectionTimes = new ConcurrentHashMap<>();

    // Track already-alerted flows to avoid duplicate alerts
    private final Set<String> alertedFlows = Collections.newSetFromMap(new ConcurrentHashMap<>());

    // Detection thresholds
    private static final double DDOS_FLOW_RATE_THRESHOLD = 100.0;
    private static final double DDOS_SYN_RATIO_THRESHOLD = 0.8;
    private static final int PORT_SCAN_MIN_PORTS = 20;
    private static final int PORT_SCAN_MIN_HOSTS = 5;
    private static final double DNS_ENTROPY_THRESHOLD = 3.5;
    private static final int DNS_MIN_QUERY_LENGTH = 20;
    private static final double C2_PERIODICITY_THRESHOLD = 0.7;
    private static final double EXFIL_RATIO_THRESHOLD = 10.0;

    public void processFlow(FlowState flowState, NetworkFlow flow, String context) {
        long detectionStart = System.currentTimeMillis();

        // Track window statistics
        updateWindowStats(flowState);

        // Attempt detection based on context hint and statistical rules
        Optional<AlertDTO> alert = Optional.empty();

        if (shouldRunDdosDetection(flowState)) {
            alert = runDdosDetection(flowState, detectionStart);
        } else if (shouldRunPortScanDetection(flowState)) {
            alert = runPortScanDetection(flowState, detectionStart);
        } else if (isDnsFlow(flowState) && shouldRunDnsDetection(flowState)) {
            alert = runDnsDetection(flowState, detectionStart);
        } else if (shouldRunC2Detection(flowState)) {
            alert = runC2Detection(flowState, detectionStart);
        } else if (shouldRunExfilDetection(flowState)) {
            alert = runExfilDetection(flowState, detectionStart);
        }

        alert.ifPresent(a -> {
            long latency = System.currentTimeMillis() - detectionStart;
            a.setDetectionLatencyMs(latency);
            alertService.createAlert(a);
            metricsCollector.recordDetection(latency);
            alertedFlows.add(flowState.getFlowId());
        });
    }

    // ----- DDoS Detection -----

    private boolean shouldRunDdosDetection(FlowState flow) {
        if (alertedFlows.contains(flow.getFlowId())) return false;
        // Run if SYN ratio is high or flow rate to destination is high
        double synRatio = flow.getSynRatio();
        long flowCount = destFlowCount.getOrDefault(flow.getDestinationIp(), 0L);
        return (synRatio > 0.5 && flow.getPacketCount() > 20) || flowCount > 50;
    }

    private Optional<AlertDTO> runDdosDetection(FlowState flow, long startTime) {
        Set<String> uniqueSources = destUniqueSources.getOrDefault(
                flow.getDestinationIp() + ":" + flow.getDestinationPort(), new HashSet<>());
        long flowCount = destFlowCount.getOrDefault(flow.getDestinationIp(), 0L);

        FeatureExtractor.DdosWindowStats window = new FeatureExtractor.DdosWindowStats(
                flowCount,
                flow.getPacketCount() / Math.max(1.0, flow.getDurationMs() / 1000.0),
                uniqueSources.size(),
                calculateEntropy(uniqueSources),
                uniqueSources.size() > 10 ? (double) flowCount / uniqueSources.size() : 0.0
        );

        Map<String, Double> features = featureExtractor.extractDdosFeatures(flow, window);

        // Rule-based score
        double ruleScore = computeDdosRuleScore(features, flow.getSynRatio(), uniqueSources.size());
        if (ruleScore < 0.3) return Optional.empty();

        // ML inference (if available)
        double mlScore = runMlInference("DDOS", flow.getFlowId(), features);
        double finalScore = fuseScores(ruleScore, mlScore);

        if (finalScore < 0.5) return Optional.empty();

        String severity = finalScore > 0.85 ? "CRITICAL" : finalScore > 0.7 ? "HIGH" : "MEDIUM";

        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("synRatio", String.format("%.3f", flow.getSynRatio()));
        evidence.put("flowRate", String.format("%.1f/s", window.flowRatePerSec()));
        evidence.put("uniqueSourceIps", uniqueSources.size());
        evidence.put("sourceEntropy", String.format("%.3f", window.sourceEntropy()));
        evidence.put("ruleScore", String.format("%.3f", ruleScore));
        evidence.put("mlScore", mlScore > 0 ? String.format("%.3f", mlScore) : "N/A");
        evidence.put("fusedScore", String.format("%.3f", finalScore));

        return Optional.of(AlertDTO.builder()
                .flowId(flow.getFlowId())
                .timestamp(Instant.now())
                .threatClass("SYN_FLOOD")
                .severity(severity)
                .confidence(finalScore)
                .sourceIp(flow.getSourceIp())
                .destinationIp(flow.getDestinationIp())
                .protocol(flow.getProtocol())
                .modelVersion("ddos-v1.0")
                .evidence(evidence)
                .status("NEW")
                .build());
    }

    private double computeDdosRuleScore(Map<String, Double> features, double synRatio, int uniqueSrcs) {
        double score = 0.0;
        if (synRatio > DDOS_SYN_RATIO_THRESHOLD) score += 0.4;
        else if (synRatio > 0.5) score += 0.2;
        if (uniqueSrcs > 100) score += 0.4;
        else if (uniqueSrcs > 20) score += 0.2;
        double flowRate = features.getOrDefault("flow_rate", 0.0);
        if (flowRate > DDOS_FLOW_RATE_THRESHOLD) score += 0.2;
        return Math.min(score, 1.0);
    }

    // ----- Port Scan Detection -----

    private boolean shouldRunPortScanDetection(FlowState flow) {
        if (alertedFlows.contains(flow.getFlowId())) return false;
        Set<Integer> ports = srcUniquePorts.getOrDefault(flow.getSourceIp(), new HashSet<>());
        return ports.size() >= PORT_SCAN_MIN_PORTS;
    }

    private Optional<AlertDTO> runPortScanDetection(FlowState flow, long startTime) {
        Set<Integer> uniquePorts = srcUniquePorts.getOrDefault(flow.getSourceIp(), new HashSet<>());
        Set<String> uniqueHosts = srcUniqueHosts.getOrDefault(flow.getSourceIp(), new HashSet<>());

        FeatureExtractor.PortScanWindowStats window = new FeatureExtractor.PortScanWindowStats(
                uniquePorts.size(), uniqueHosts.size(),
                (double) uniquePorts.size() / Math.max(uniqueHosts.size(), 1),
                uniquePorts.size() / Math.max(1.0, flow.getDurationMs() / 1000.0),
                flow.getSynCount() - flow.getAckCount(),
                flow.getSynCount()
        );

        Map<String, Double> features = featureExtractor.extractPortScanFeatures(flow, window);
        double ruleScore = computePortScanRuleScore(uniquePorts.size(), uniqueHosts.size(), window.fanOut());
        if (ruleScore < 0.4) return Optional.empty();

        double mlScore = runMlInference("PORT_SCAN", flow.getFlowId(), features);
        double finalScore = fuseScores(ruleScore, mlScore);
        if (finalScore < 0.5) return Optional.empty();

        String severity = uniquePorts.size() > 500 ? "HIGH" : "MEDIUM";

        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("uniqueDestPorts", uniquePorts.size());
        evidence.put("uniqueDestHosts", uniqueHosts.size());
        evidence.put("fanOut", String.format("%.1f", window.fanOut()));
        evidence.put("connectionRate", String.format("%.2f/s", window.connectionRatePerSec()));
        evidence.put("synWithoutAck", window.synWithoutAck());
        evidence.put("confidence", String.format("%.3f", finalScore));

        return Optional.of(AlertDTO.builder()
                .flowId(flow.getFlowId())
                .timestamp(Instant.now())
                .threatClass("PORT_SCAN")
                .severity(severity)
                .confidence(finalScore)
                .sourceIp(flow.getSourceIp())
                .destinationIp(flow.getDestinationIp())
                .protocol(flow.getProtocol())
                .modelVersion("portscan-v1.0")
                .evidence(evidence)
                .status("NEW")
                .build());
    }

    private double computePortScanRuleScore(int uniquePorts, int uniqueHosts, double fanOut) {
        double score = 0.0;
        if (uniquePorts > PORT_SCAN_MIN_PORTS) score += 0.3;
        if (uniquePorts > 100) score += 0.2;
        if (uniquePorts > 500) score += 0.2;
        if (uniqueHosts > PORT_SCAN_MIN_HOSTS) score += 0.1;
        if (fanOut > 10) score += 0.2;
        return Math.min(score, 1.0);
    }

    // ----- DNS / DGA Detection -----

    private boolean isDnsFlow(FlowState flow) {
        return "UDP".equals(flow.getProtocol()) && flow.getDnsQueryCount() > 0;
    }

    private boolean shouldRunDnsDetection(FlowState flow) {
        if (alertedFlows.contains(flow.getFlowId())) return false;
        return flow.getDnsQueryCount() > 10;
    }

    private Optional<AlertDTO> runDnsDetection(FlowState flow, long startTime) {
        // Analyze the DNS queries from this flow
        List<String> queries = flow.getDnsQueries();
        if (queries.isEmpty()) return Optional.empty();

        // Find the most anomalous domain
        String worstDomain = queries.stream()
                .filter(d -> d.length() > DNS_MIN_QUERY_LENGTH)
                .max(Comparator.comparingDouble(featureExtractor::calculateEntropy))
                .orElse(queries.get(0));

        FeatureExtractor.DnsWindowStats window = new FeatureExtractor.DnsWindowStats(
                flow.getDnsQueryCount() / Math.max(1.0, flow.getDurationMs() / 1000.0)
        );
        Map<String, Double> features = featureExtractor.extractDnsFeatures(worstDomain, window);

        double entropy = features.getOrDefault("entropy", 0.0);
        double ruleScore = computeDnsRuleScore(features, worstDomain, flow);
        if (ruleScore < 0.4) return Optional.empty();

        double mlScore = runMlInference("DNS_DGA", flow.getFlowId(), features);
        double finalScore = fuseScores(ruleScore, mlScore);
        if (finalScore < 0.5) return Optional.empty();

        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("suspiciousDomain", worstDomain);
        evidence.put("domainEntropy", String.format("%.3f", entropy));
        evidence.put("domainLength", worstDomain.length());
        evidence.put("digitRatio", String.format("%.3f", features.getOrDefault("digit_ratio", 0.0)));
        evidence.put("queryCount", flow.getDnsQueryCount());
        evidence.put("queryRate", String.format("%.2f/s", window.queryRatePerSec()));
        evidence.put("ngramAnomalyScore", String.format("%.3f", features.getOrDefault("ngram_anomaly_score", 0.0)));
        evidence.put("confidence", String.format("%.3f", finalScore));

        return Optional.of(AlertDTO.builder()
                .flowId(flow.getFlowId())
                .timestamp(Instant.now())
                .threatClass("DNS_TUNNEL")
                .severity(finalScore > 0.8 ? "HIGH" : "MEDIUM")
                .confidence(finalScore)
                .sourceIp(flow.getSourceIp())
                .destinationIp(flow.getDestinationIp())
                .protocol("UDP")
                .modelVersion("dns-v1.0")
                .evidence(evidence)
                .status("NEW")
                .build());
    }

    private double computeDnsRuleScore(Map<String, Double> features, String domain, FlowState flow) {
        double score = 0.0;
        double entropy = features.getOrDefault("entropy", 0.0);
        double digitRatio = features.getOrDefault("digit_ratio", 0.0);
        double queryRate = features.getOrDefault("query_rate", 0.0);
        double ngramAnomaly = features.getOrDefault("ngram_anomaly_score", 0.0);
        double tldSuspicion = features.getOrDefault("tld_suspicion", 0.0);

        if (entropy > DNS_ENTROPY_THRESHOLD) score += 0.3;
        else if (entropy > 3.0) score += 0.15;
        if (digitRatio > 0.3) score += 0.15;
        if (domain.length() > DNS_MIN_QUERY_LENGTH) score += 0.1;
        if (queryRate > 1.0) score += 0.2;
        if (ngramAnomaly > 0.6) score += 0.15;
        if (tldSuspicion > 0) score += 0.1;
        return Math.min(score, 1.0);
    }

    // ----- C2 Beaconing Detection -----

    private boolean shouldRunC2Detection(FlowState flow) {
        if (alertedFlows.contains(flow.getFlowId())) return false;
        // Need enough intervals to assess periodicity
        return flow.getInterArrivalMs().size() > 10 && flow.getPacketCount() > 10;
    }

    private Optional<AlertDTO> runC2Detection(FlowState flow, long startTime) {
        double meanIat = flow.getMeanInterArrivalMs();
        double variance = flow.getInterArrivalVariance();
        double periodicityScore = computePeriodicityScore(variance, meanIat);

        if (periodicityScore < C2_PERIODICITY_THRESHOLD) return Optional.empty();

        List<Long> connectionTimes = srcConnectionTimes.getOrDefault(flow.getSourceIp(), List.of());
        FeatureExtractor.C2WindowStats window = new FeatureExtractor.C2WindowStats(
                periodicityScore, connectionTimes.size(), 1L
        );

        Map<String, Double> features = featureExtractor.extractC2Features(flow, window);
        double ruleScore = periodicityScore;

        double mlScore = runMlInference("C2", flow.getFlowId(), features);
        double finalScore = fuseScores(ruleScore, mlScore);
        if (finalScore < 0.5) return Optional.empty();

        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("meanInterArrivalMs", String.format("%.1f", meanIat));
        evidence.put("interArrivalVariance", String.format("%.3f", variance));
        evidence.put("periodicityScore", String.format("%.3f", periodicityScore));
        evidence.put("connectionCount", flow.getPacketCount());
        evidence.put("flowDurationMs", flow.getDurationMs());
        evidence.put("meanPacketBytes", String.format("%.0f", flow.getMeanPacketSize()));

        return Optional.of(AlertDTO.builder()
                .flowId(flow.getFlowId())
                .timestamp(Instant.now())
                .threatClass("C2_BEACON")
                .severity(finalScore > 0.85 ? "HIGH" : "MEDIUM")
                .confidence(finalScore)
                .sourceIp(flow.getSourceIp())
                .destinationIp(flow.getDestinationIp())
                .protocol(flow.getProtocol())
                .modelVersion("c2-v1.0")
                .evidence(evidence)
                .status("NEW")
                .build());
    }

    private double computePeriodicityScore(double variance, double meanIat) {
        if (meanIat <= 0) return 0.0;
        // Coefficient of variation: low CV = high periodicity
        double cv = Math.sqrt(variance) / meanIat;
        // Score inversely related to CV, normalized to [0,1]
        return Math.max(0.0, Math.min(1.0, 1.0 - cv * 0.5));
    }

    // ----- Exfiltration Detection -----

    private boolean shouldRunExfilDetection(FlowState flow) {
        if (alertedFlows.contains(flow.getFlowId())) return false;
        return flow.getByteCount() > 1_000_000; // > 1MB
    }

    private Optional<AlertDTO> runExfilDetection(FlowState flow, long startTime) {
        long outboundBytes = flow.getByteCount();
        long inboundBytes = Math.max(1, outboundBytes / 20); // Approximate for passive one-way

        double ratio = (double) outboundBytes / inboundBytes;
        if (ratio < EXFIL_RATIO_THRESHOLD) return Optional.empty();

        FeatureExtractor.ExfilWindowStats window = new FeatureExtractor.ExfilWindowStats(
                outboundBytes, inboundBytes, ratio, 0.9,
                outboundBytes / Math.max(1.0, flow.getDurationMs() / 1000.0), 3L
        );

        Map<String, Double> features = featureExtractor.extractExfiltrationFeatures(flow, window);
        double ruleScore = Math.min(1.0, (ratio - EXFIL_RATIO_THRESHOLD) / 20.0 + 0.5);
        double mlScore = runMlInference("EXFILTRATION", flow.getFlowId(), features);
        double finalScore = fuseScores(ruleScore, mlScore);
        if (finalScore < 0.5) return Optional.empty();

        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("outboundBytes", outboundBytes);
        evidence.put("inboundBytes", inboundBytes);
        evidence.put("outboundInboundRatio", String.format("%.1f:1", ratio));
        evidence.put("transferRateBps", String.format("%.0f", window.transferRateBps()));
        evidence.put("flowDurationMs", flow.getDurationMs());

        return Optional.of(AlertDTO.builder()
                .flowId(flow.getFlowId())
                .timestamp(Instant.now())
                .threatClass("DATA_EXFILTRATION")
                .severity("HIGH")
                .confidence(finalScore)
                .sourceIp(flow.getSourceIp())
                .destinationIp(flow.getDestinationIp())
                .protocol(flow.getProtocol())
                .modelVersion("exfil-v1.0")
                .evidence(evidence)
                .status("NEW")
                .build());
    }

    // ----- Score Fusion -----

    /**
     * Fuse rule-based and ML scores.
     * If ML is unavailable, rule score is used directly.
     * If both are available, weighted combination is used.
     */
    private double fuseScores(double ruleScore, double mlScore) {
        if (mlScore <= 0) {
            return ruleScore;  // ML unavailable, use rule score
        }
        // Weighted: 40% rules, 60% ML
        return 0.4 * ruleScore + 0.6 * mlScore;
    }

    private double runMlInference(String detectorType, String flowId, Map<String, Double> features) {
        try {
            MlContract.PredictRequest request = MlContract.PredictRequest.builder()
                    .flowId(flowId)
                    .detectorType(detectorType)
                    .features(features)
                    .build();
            return mlClient.predict(request)
                    .filter(MlContract.PredictResponse::getIsThreat)
                    .map(MlContract.PredictResponse::getConfidence)
                    .orElse(0.0);
        } catch (Exception e) {
            log.debug("ML inference failed for {}: {}", detectorType, e.getMessage());
            return 0.0;
        }
    }

    // ----- Window Statistics Updates -----

    private void updateWindowStats(FlowState flow) {
        // Track per-destination flow counts
        destFlowCount.merge(flow.getDestinationIp(), 1L, Long::sum);

        // Track unique sources per destination (for DDoS)
        String destKey = flow.getDestinationIp() + ":" + flow.getDestinationPort();
        destUniqueSources.computeIfAbsent(destKey, k -> Collections.newSetFromMap(new ConcurrentHashMap<>()))
                .add(flow.getSourceIp());

        // Track unique destination ports per source (for port scan)
        if (flow.getDestinationPort() != null) {
            srcUniquePorts.computeIfAbsent(flow.getSourceIp(), k -> Collections.newSetFromMap(new ConcurrentHashMap<>()))
                    .add(flow.getDestinationPort());
        }

        // Track unique destination hosts per source
        srcUniqueHosts.computeIfAbsent(flow.getSourceIp(), k -> Collections.newSetFromMap(new ConcurrentHashMap<>()))
                .add(flow.getDestinationIp());

        // Track connection times for C2 analysis
        srcConnectionTimes.computeIfAbsent(flow.getSourceIp(), k -> Collections.synchronizedList(new ArrayList<>()))
                .add(System.currentTimeMillis());
    }

    private double calculateEntropy(Set<String> items) {
        if (items.isEmpty()) return 0;
        Map<String, Long> freq = new HashMap<>();
        for (String item : items) {
            // Bucket by /24 subnet
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

    /**
     * Reset window statistics - called on replay reset.
     */
    public void resetWindowStats() {
        destFlowCount.clear();
        destUniqueSources.clear();
        srcUniquePorts.clear();
        srcUniqueHosts.clear();
        srcConnectionTimes.clear();
        alertedFlows.clear();
    }
}
