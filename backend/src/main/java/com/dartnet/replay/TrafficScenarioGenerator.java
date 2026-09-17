package com.dartnet.replay;

import lombok.extern.slf4j.Slf4j;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Generates synthetic, deterministic traffic scenarios for replay demonstration.
 * 
 * Each scenario produces packet-level events that feed the same pipeline
 * as real PCAP data would. No fake pre-computed alerts - the detectors
 * run on the actual generated traffic features.
 */
@Slf4j
public class TrafficScenarioGenerator {

    public record PacketEvent(
        String srcIp,
        String dstIp,
        int srcPort,
        int dstPort,
        String protocol,
        int bytes,
        Instant timestamp,
        int tcpFlags,
        String dnsQuery,
        boolean isFinal,
        long delayMs,
        String scenarioContext
    ) {}

    private final String scenario;
    private final double speedMultiplier;
    private final List<PacketEvent> events;
    private int position = 0;

    // TCP flags
    private static final int TCP_SYN = 0x02;
    private static final int TCP_ACK = 0x10;
    private static final int TCP_SYN_ACK = 0x12;
    private static final int TCP_FIN = 0x01;

    private static final Random RAND = new Random(42); // deterministic seed

    public TrafficScenarioGenerator(String scenario, double speedMultiplier) {
        this.scenario = scenario;
        this.speedMultiplier = speedMultiplier;
        this.events = generateScenario(scenario);
        log.info("Scenario {} generated {} events", scenario, events.size());
    }

    public boolean hasMore() {
        return position < events.size();
    }

    public PacketEvent nextEvent() {
        if (!hasMore()) return null;
        return events.get(position++);
    }

    private List<PacketEvent> generateScenario(String scenario) {
        return switch (scenario.toUpperCase()) {
            case "DDOS_SYN_FLOOD" -> generateDdosSynFlood();
            case "PORT_SCAN" -> generatePortScan();
            case "DNS_TUNNEL", "DNS_DGA" -> generateDnsTunnel();
            case "C2_BEACON" -> generateC2Beacon();
            case "DATA_EXFIL" -> generateDataExfil();
            case "MIXED" -> generateMixed();
            default -> {
                log.warn("Unknown scenario: {}, using MIXED", scenario);
                yield generateMixed();
            }
        };
    }

    private List<PacketEvent> generateDdosSynFlood() {
        List<PacketEvent> events = new ArrayList<>();
        Instant base = Instant.now();
        String victim = "192.168.10.50";
        int victimPort = 80;

        // Background normal traffic (30 seconds)
        for (int i = 0; i < 200; i++) {
            String src = randomIp("10.0.1.");
            events.add(packet(src, victim, randomPort(), victimPort, "TCP",
                    randomBytes(64, 512), base.plusMillis(i * 150L), TCP_SYN, null, false, 150, "NORMAL"));
        }

        // SYN flood begins (60 seconds, high rate)
        for (int i = 0; i < 3000; i++) {
            String src = "10." + RAND.nextInt(255) + "." + RAND.nextInt(255) + "." + RAND.nextInt(255);
            long delay = i < 100 ? 50 : (i < 500 ? 20 : 5); // escalating
            events.add(packet(src, victim, randomPort(), victimPort, "TCP",
                    44, // SYN packet is typically small
                    base.plusMillis(30_000 + i * 20L), TCP_SYN, null,
                    i == 2999, delay, "DDOS_SYN_FLOOD"));
        }

        return events;
    }

    private List<PacketEvent> generatePortScan() {
        List<PacketEvent> events = new ArrayList<>();
        Instant base = Instant.now();
        String scanner = "10.5.0.100";
        String target = "192.168.1.50";

        // Normal traffic
        for (int i = 0; i < 50; i++) {
            events.add(packet(randomIp("10.0.2."), randomIp("192.168.1."),
                    randomPort(), 80, "TCP", randomBytes(200, 1500), base.plusMillis(i * 300L),
                    TCP_SYN | TCP_ACK, null, false, 300, "NORMAL"));
        }

        // Aggressive port scan - sequential ports
        for (int port = 1; port <= 1024; port++) {
            events.add(packet(scanner, target, randomPort(), port, "TCP",
                    44, base.plusMillis(15_000 + port * 10L), TCP_SYN, null,
                    port == 1024, 10, "PORT_SCAN"));
        }

        return events;
    }

    private List<PacketEvent> generateDnsTunnel() {
        List<PacketEvent> events = new ArrayList<>();
        Instant base = Instant.now();
        String client = "10.3.0.55";
        String dnsServer = "8.8.8.8";

        // Normal DNS
        String[] normalDomains = {"google.com", "microsoft.com", "amazon.com", "github.com"};
        for (int i = 0; i < 30; i++) {
            String domain = normalDomains[RAND.nextInt(normalDomains.length)];
            events.add(dnsEvent(client, dnsServer, domain, base.plusMillis(i * 2000L), false));
        }

        // DGA-style domains with encoded data
        for (int i = 0; i < 200; i++) {
            String dgaDomain = generateDgaDomain() + ".malicious-c2.xyz";
            long delay = 500;
            events.add(dnsEvent(client, dnsServer, dgaDomain,
                    base.plusMillis(60_000 + i * 500L), i == 199));
        }

        return events;
    }

    private List<PacketEvent> generateC2Beacon() {
        List<PacketEvent> events = new ArrayList<>();
        Instant base = Instant.now();
        String infected = "10.2.0.77";
        String c2Server = "185.220.101.55"; // suspicious external
        int c2Port = 443;

        // Normal background
        for (int i = 0; i < 50; i++) {
            events.add(packet(randomIp("10.0.0."), "8.8.8.8", randomPort(), 53, "UDP",
                    randomBytes(40, 200), base.plusMillis(i * 1000L), 0, null, false, 1000, "NORMAL"));
        }

        // C2 beaconing - very regular intervals (every 30 seconds)
        for (int i = 0; i < 60; i++) {
            // Beacon: small outbound packet
            events.add(packet(infected, c2Server, randomPort(), c2Port, "TCP",
                    randomBytes(100, 250), // small, encoded beacon
                    base.plusMillis(30_000 + i * 30_000L), TCP_SYN | TCP_ACK, null, false, 100, "C2_BEACON"));
            // Response: small inbound packet
            if (i < 59) {
                events.add(packet(c2Server, infected, c2Port, randomPort(), "TCP",
                        randomBytes(100, 300),
                        base.plusMillis(30_000 + i * 30_000L + 200), TCP_ACK, null,
                        i == 58, 100, "C2_BEACON"));
            }
        }

        return events;
    }

    private List<PacketEvent> generateDataExfil() {
        List<PacketEvent> events = new ArrayList<>();
        Instant base = Instant.now();
        String internal = "10.1.0.30";
        String external = "45.77.123.55";

        // Normal symmetric traffic
        for (int i = 0; i < 100; i++) {
            events.add(packet(internal, external, randomPort(), 443, "TCP",
                    randomBytes(200, 800), base.plusMillis(i * 500L), TCP_ACK, null, false, 500, "NORMAL"));
        }

        // Large outbound data exfiltration
        for (int i = 0; i < 500; i++) {
            events.add(packet(internal, external, randomPort(), 443, "TCP",
                    randomBytes(1200, 1500), // large outbound packets
                    base.plusMillis(50_000 + i * 200L), TCP_ACK, null, i == 499, 200, "DATA_EXFIL"));
        }

        return events;
    }

    private List<PacketEvent> generateMixed() {
        List<PacketEvent> all = new ArrayList<>();
        all.addAll(generateDdosSynFlood().subList(0, Math.min(500, generateDdosSynFlood().size())));
        all.addAll(generatePortScan().subList(0, Math.min(200, generatePortScan().size())));
        all.addAll(generateC2Beacon().subList(0, Math.min(100, generateC2Beacon().size())));
        return all;
    }

    private PacketEvent packet(String src, String dst, int srcPort, int dstPort,
            String proto, int bytes, Instant ts, int flags,
            String dns, boolean isFinal, long delay, String context) {
        return new PacketEvent(src, dst, srcPort, dstPort, proto, bytes, ts, flags, dns, isFinal, delay, context);
    }

    private PacketEvent dnsEvent(String src, String dst, String domain, Instant ts, boolean isFinal) {
        return new PacketEvent(src, dst, randomPort(), 53, "UDP", 60, ts, 0, domain, isFinal, 500, "DNS");
    }

    private String randomIp(String prefix) {
        return prefix + (1 + RAND.nextInt(254));
    }

    private int randomPort() {
        return 1024 + RAND.nextInt(64511);
    }

    private int randomBytes(int min, int max) {
        return min + RAND.nextInt(max - min);
    }

    private String generateDgaDomain() {
        // Simulate DGA output: high entropy, mixed chars/digits
        StringBuilder sb = new StringBuilder();
        int len = 12 + RAND.nextInt(8);
        String chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        for (int i = 0; i < len; i++) {
            sb.append(chars.charAt(RAND.nextInt(chars.length())));
        }
        return sb.toString();
    }
}
