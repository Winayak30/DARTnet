package com.nexussoc.pipeline;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for FeatureExtractor.
 * Verifies that feature computation logic is correct for each detector type.
 */
class FeatureExtractorTest {

    private FeatureExtractor extractor;

    @BeforeEach
    void setup() {
        extractor = new FeatureExtractor();
    }

    @Test
    void testEntropy_highEntropyString() {
        // Random-looking string should have high entropy
        double entropy = extractor.calculateEntropy("xk2j9mq4np8wz5");
        assertTrue(entropy > 3.0, "High-entropy string should have entropy > 3.0, got: " + entropy);
    }

    @Test
    void testEntropy_lowEntropyString() {
        // Repeating string should have low entropy
        double entropy = extractor.calculateEntropy("aaaaaaa");
        assertEquals(0.0, entropy, 0.001, "Repeating chars should have zero entropy");
    }

    @Test
    void testEntropy_normalDomain() {
        // Normal domain should have moderate entropy
        double entropy = extractor.calculateEntropy("google");
        assertTrue(entropy < 3.5, "Normal domain should have entropy < 3.5, got: " + entropy);
    }

    @Test
    void testDdosFeatureExtraction() {
        FlowState flow = new FlowState("FL-001", "10.0.0.1", "192.168.1.1", 50000, 80, "TCP");
        Instant now = Instant.now();
        // Add SYN packets (flags = 0x02)
        for (int i = 0; i < 100; i++) {
            flow.addPacket(44, now.plusMillis(i * 5), 0x02); // SYN
        }
        // Add a few ACK packets
        for (int i = 0; i < 2; i++) {
            flow.addPacket(500, now.plusMillis(500 + i * 10), 0x10); // ACK
        }

        FeatureExtractor.DdosWindowStats window = new FeatureExtractor.DdosWindowStats(
                200.0, 1000.0, 5000, 0.15, 0.9
        );

        Map<String, Double> features = extractor.extractDdosFeatures(flow, window);

        assertNotNull(features);
        assertTrue(features.containsKey("syn_ratio"));
        assertTrue(features.containsKey("flow_rate"));
        assertTrue(features.containsKey("unique_source_ips"));

        // SYN ratio should be very high (100 SYN / 102 total)
        double synRatio = features.get("syn_ratio");
        assertTrue(synRatio > 0.95, "SYN ratio should be > 0.95, got: " + synRatio);
    }

    @Test
    void testC2FeatureExtraction_regularIntervals() {
        FlowState flow = new FlowState("FL-002", "10.0.0.50", "185.0.0.1", 12345, 443, "TCP");
        Instant base = Instant.now();
        // Add packets with very regular 30-second intervals
        long beaconInterval = 30_000;
        for (int i = 0; i < 20; i++) {
            flow.addPacket(200, base.plusMillis(i * beaconInterval), 0x10);
        }

        FeatureExtractor.C2WindowStats window = new FeatureExtractor.C2WindowStats(0.92, 20, 1);
        Map<String, Double> features = extractor.extractC2Features(flow, window);

        assertNotNull(features);
        assertTrue(features.containsKey("mean_inter_arrival_ms"));
        assertTrue(features.containsKey("periodicity_score"));

        double meanIat = features.get("mean_inter_arrival_ms");
        // Should be approximately 30000ms
        assertTrue(meanIat > 25000 && meanIat < 35000,
                "Mean inter-arrival should be ~30000ms, got: " + meanIat);
    }

    @Test
    void testPortScanFeatureExtraction() {
        FlowState flow = new FlowState("FL-003", "10.5.0.1", "192.168.1.100", 55000, 22, "TCP");
        Instant base = Instant.now();
        for (int i = 0; i < 50; i++) {
            flow.addPacket(44, base.plusMillis(i * 10), 0x02); // SYN
        }

        FeatureExtractor.PortScanWindowStats window = new FeatureExtractor.PortScanWindowStats(
                1024, 50, 20.0, 100.0, 900, 900
        );

        Map<String, Double> features = extractor.extractPortScanFeatures(flow, window);

        assertNotNull(features);
        assertEquals(1024.0, features.get("unique_dest_ports"), 0.01);
        assertEquals(20.0, features.get("fan_out"), 0.01);
    }

    @Test
    void testDnsFeatures_dgaDomain() {
        String dgaDomain = "xk2mq9p8nwz5j4v.malicious-c2.xyz";
        FeatureExtractor.DnsWindowStats window = new FeatureExtractor.DnsWindowStats(5.0);
        Map<String, Double> features = extractor.extractDnsFeatures(dgaDomain, window);

        assertNotNull(features);
        assertTrue(features.containsKey("entropy"));
        assertTrue(features.containsKey("domain_length"));
        assertTrue(features.containsKey("tld_suspicion"));

        // Should detect suspicious TLD
        assertEquals(1.0, features.get("tld_suspicion"), 0.01);
        // Domain length should be captured
        assertTrue(features.get("domain_length") > 10);
    }
}
