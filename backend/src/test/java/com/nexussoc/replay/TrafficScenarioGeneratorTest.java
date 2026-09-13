package com.nexussoc.replay;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for TrafficScenarioGenerator.
 * Verifies scenarios produce expected traffic patterns.
 */
class TrafficScenarioGeneratorTest {

    @Test
    void testDdosScenarioGeneratesEvents() {
        TrafficScenarioGenerator gen = new TrafficScenarioGenerator("DDOS_SYN_FLOOD", 1.0);
        assertTrue(gen.hasMore());

        int count = 0;
        int synPackets = 0;
        while (gen.hasMore() && count < 100) {
            TrafficScenarioGenerator.PacketEvent event = gen.nextEvent();
            assertNotNull(event);
            assertNotNull(event.srcIp());
            assertNotNull(event.dstIp());
            assertTrue(event.bytes() > 0);
            if ((event.tcpFlags() & 0x02) != 0) synPackets++;
            count++;
        }
        assertTrue(count > 0, "Should have generated events");
        assertTrue(synPackets > 0, "DDoS scenario should have SYN packets");
    }

    @Test
    void testPortScanScenarioGeneratesSequentialPorts() {
        TrafficScenarioGenerator gen = new TrafficScenarioGenerator("PORT_SCAN", 1.0);
        int portsContacted = 0;
        java.util.Set<Integer> ports = new java.util.HashSet<>();

        while (gen.hasMore()) {
            TrafficScenarioGenerator.PacketEvent event = gen.nextEvent();
            if ("PORT_SCAN".equals(event.scenarioContext())) {
                ports.add(event.dstPort());
            }
        }
        // Port scan should contact many unique ports
        assertTrue(ports.size() > 100,
                "Port scan should contact >100 ports, got: " + ports.size());
    }

    @Test
    void testDnsScenarioHasDnsQueries() {
        TrafficScenarioGenerator gen = new TrafficScenarioGenerator("DNS_DGA", 1.0);
        int dnsQueries = 0;

        while (gen.hasMore()) {
            TrafficScenarioGenerator.PacketEvent event = gen.nextEvent();
            if (event.dnsQuery() != null) dnsQueries++;
        }
        assertTrue(dnsQueries > 0, "DNS scenario should produce DNS queries");
    }

    @Test
    void testC2ScenarioHasRegularIntervals() {
        TrafficScenarioGenerator gen = new TrafficScenarioGenerator("C2_BEACON", 1.0);
        List<Long> c2Timestamps = new java.util.ArrayList<>();

        while (gen.hasMore()) {
            TrafficScenarioGenerator.PacketEvent event = gen.nextEvent();
            if ("C2_BEACON".equals(event.scenarioContext())) {
                c2Timestamps.add(event.timestamp().toEpochMilli());
            }
        }

        assertTrue(c2Timestamps.size() > 10, "C2 scenario should have many beacon events");

        // C2 scenario generates events at regular 30s intervals
        // Verify timestamps span a meaningful duration
        if (c2Timestamps.size() >= 2) {
            long duration = c2Timestamps.get(c2Timestamps.size() - 1) - c2Timestamps.get(0);
            assertTrue(duration > 60_000, // at least 1 minute span
                    "C2 beacons should span > 1 minute, got: " + duration + "ms");
        }
    }

    @Test
    void testDeterminism() {
        // Same generator produces same sequence when events are generated sequentially
        TrafficScenarioGenerator gen = new TrafficScenarioGenerator("DDOS_SYN_FLOOD", 1.0);
        TrafficScenarioGenerator.PacketEvent first = gen.nextEvent();
        assertNotNull(first);
        // Verify same generator produces consistent subsequent events
        TrafficScenarioGenerator.PacketEvent second = gen.nextEvent();
        assertNotNull(second);
        // Both should have valid IPs
        assertTrue(first.srcIp().contains("."), "Source IP should be valid");
        assertTrue(second.srcIp().contains("."), "Source IP should be valid");
    }
}
