package com.dartnet.pipeline;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Extracts numeric features from a FlowState for ML inference.
 * Each detector type uses a specific feature set.
 * 
 * Features are derived from passive traffic metadata only.
 * No payload inspection, no active probing.
 */
@Component
@Slf4j
public class FeatureExtractor {

    /**
     * Features for DDoS / volumetric flooding detection.
     */
    public Map<String, Double> extractDdosFeatures(FlowState flow, DdosWindowStats window) {
        Map<String, Double> features = new LinkedHashMap<>();
        features.put("flow_rate", window.flowRatePerSec());
        features.put("packet_rate", window.packetRatePerSec());
        features.put("syn_ratio", flow.getSynRatio());
        features.put("unique_source_ips", (double) window.uniqueSourceIps());
        features.put("source_entropy", window.sourceEntropy());
        features.put("dest_concentration", window.destinationConcentration());
        features.put("mean_packet_size", flow.getMeanPacketSize());
        features.put("packets", (double) flow.getPacketCount());
        features.put("bytes", (double) flow.getByteCount());
        features.put("duration_ms", (double) flow.getDurationMs());
        features.put("syn_count", (double) flow.getSynCount());
        return features;
    }

    /**
     * Features for port scan / reconnaissance detection.
     */
    public Map<String, Double> extractPortScanFeatures(FlowState flow, PortScanWindowStats window) {
        Map<String, Double> features = new LinkedHashMap<>();
        features.put("unique_dest_ports", (double) window.uniqueDestPorts());
        features.put("unique_dest_hosts", (double) window.uniqueDestHosts());
        features.put("fan_out", window.fanOut());
        features.put("connection_rate", window.connectionRatePerSec());
        features.put("failed_connections", (double) window.failedConnections());
        features.put("syn_without_ack", (double) window.synWithoutAck());
        features.put("packet_count", (double) flow.getPacketCount());
        features.put("duration_ms", (double) flow.getDurationMs());
        return features;
    }

    /**
     * Features for DNS tunneling / DGA detection.
     */
    public Map<String, Double> extractDnsFeatures(String domain, DnsWindowStats window) {
        Map<String, Double> features = new LinkedHashMap<>();
        features.put("domain_length", (double) domain.length());
        features.put("entropy", calculateEntropy(domain));
        features.put("digit_ratio", digitRatio(domain));
        features.put("consonant_ratio", consonantRatio(domain));
        features.put("unique_char_ratio", uniqueCharRatio(domain));
        features.put("ngram_anomaly_score", ngramAnomalyScore(domain));
        features.put("query_rate", window.queryRatePerSec());
        features.put("subdomain_depth", (double) countSubdomainDepth(domain));
        features.put("tld_suspicion", isSuspiciousTld(domain) ? 1.0 : 0.0);
        return features;
    }

    /**
     * Features for C2 beaconing detection.
     */
    public Map<String, Double> extractC2Features(FlowState flow, C2WindowStats window) {
        Map<String, Double> features = new LinkedHashMap<>();
        features.put("mean_inter_arrival_ms", flow.getMeanInterArrivalMs());
        features.put("inter_arrival_variance", flow.getInterArrivalVariance());
        features.put("periodicity_score", window.periodicityScore());
        features.put("connection_count", (double) window.connectionCount());
        features.put("unique_dest_count", (double) window.uniqueDestCount());
        features.put("flow_duration_ms", (double) flow.getDurationMs());
        features.put("bytes_per_flow", (double) flow.getByteCount());
        features.put("small_packet_ratio", smallPacketRatio(flow));
        return features;
    }

    /**
     * Features for data exfiltration detection.
     */
    public Map<String, Double> extractExfiltrationFeatures(FlowState flow, ExfilWindowStats window) {
        Map<String, Double> features = new LinkedHashMap<>();
        features.put("outbound_bytes", (double) window.outboundBytes());
        features.put("inbound_bytes", (double) window.inboundBytes());
        features.put("outbound_inbound_ratio", window.outboundInboundRatio());
        features.put("flow_duration_ms", (double) flow.getDurationMs());
        features.put("dest_concentration", window.destConcentration());
        features.put("transfer_rate_bps", window.transferRateBps());
        features.put("burst_count", (double) window.burstCount());
        return features;
    }

    // ----- Helper computations -----

    public double calculateEntropy(String s) {
        if (s == null || s.isEmpty()) return 0.0;
        Map<Character, Integer> freq = new HashMap<>();
        for (char c : s.toCharArray()) freq.merge(c, 1, Integer::sum);
        double entropy = 0.0;
        int len = s.length();
        for (int count : freq.values()) {
            double p = (double) count / len;
            entropy -= p * (Math.log(p) / Math.log(2));
        }
        return entropy;
    }

    private double digitRatio(String s) {
        if (s.isEmpty()) return 0;
        long digits = s.chars().filter(Character::isDigit).count();
        return (double) digits / s.length();
    }

    private double consonantRatio(String s) {
        String consonants = "bcdfghjklmnpqrstvwxyz";
        long count = s.toLowerCase().chars().filter(c -> consonants.indexOf(c) >= 0).count();
        return s.isEmpty() ? 0 : (double) count / s.length();
    }

    private double uniqueCharRatio(String s) {
        if (s.isEmpty()) return 0;
        long unique = s.chars().distinct().count();
        return (double) unique / s.length();
    }

    /**
     * Simple n-gram anomaly score based on common English bigrams.
     * Higher score = less likely human-readable = more suspicious.
     */
    private double ngramAnomalyScore(String domain) {
        String[] label = domain.split("\\.")[0].toLowerCase().split("");
        if (label.length < 2) return 0.0;
        // Common bigrams in legitimate domains
        Set<String> commonBigrams = Set.of(
            "an","at","in","on","re","er","en","te","or","es",
            "st","al","ar","ro","to","is","ne","it","ti","le"
        );
        int rare = 0;
        for (int i = 0; i < label.length - 1; i++) {
            String bg = label[i] + label[i+1];
            if (!commonBigrams.contains(bg)) rare++;
        }
        return label.length <= 1 ? 0.0 : (double) rare / (label.length - 1);
    }

    private int countSubdomainDepth(String domain) {
        return domain.split("\\.").length - 1;
    }

    private boolean isSuspiciousTld(String domain) {
        Set<String> suspiciousTlds = Set.of("xyz","top","club","online","site","info","biz","tk","ml","ga","cf");
        String[] parts = domain.split("\\.");
        String tld = parts[parts.length - 1].toLowerCase();
        return suspiciousTlds.contains(tld);
    }

    private double smallPacketRatio(FlowState flow) {
        if (flow.getPacketSizes().isEmpty()) return 0;
        long small = flow.getPacketSizes().stream().filter(s -> s < 128).count();
        return (double) small / flow.getPacketSizes().size();
    }

    // ----- Window stats data classes -----

    public record DdosWindowStats(
        double flowRatePerSec,
        double packetRatePerSec,
        long uniqueSourceIps,
        double sourceEntropy,
        double destinationConcentration
    ) {}

    public record PortScanWindowStats(
        long uniqueDestPorts,
        long uniqueDestHosts,
        double fanOut,
        double connectionRatePerSec,
        long failedConnections,
        long synWithoutAck
    ) {}

    public record DnsWindowStats(
        double queryRatePerSec
    ) {}

    public record C2WindowStats(
        double periodicityScore,
        long connectionCount,
        long uniqueDestCount
    ) {}

    public record ExfilWindowStats(
        long outboundBytes,
        long inboundBytes,
        double outboundInboundRatio,
        double destConcentration,
        double transferRateBps,
        long burstCount
    ) {}
}
