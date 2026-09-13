package com.nexussoc.pipeline;

import lombok.Data;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * Mutable state of a single network flow being assembled.
 * Thread-safe counters for incremental processing.
 */
@Data
public class FlowState {

    private final String flowId;
    private final String sourceIp;
    private final String destinationIp;
    private final Integer sourcePort;
    private final Integer destinationPort;
    private final String protocol;

    private Instant firstSeen;
    private Instant lastSeen;

    private long packetCount = 0;
    private long byteCount = 0;
    private long synCount = 0;
    private long ackCount = 0;
    private long finCount = 0;
    private long rstCount = 0;
    private long udpCount = 0;

    // Per-packet sizes for stats
    private final Deque<Integer> packetSizes = new ConcurrentLinkedDeque<>();
    // Inter-arrival times in ms
    private final Deque<Long> interArrivalMs = new ConcurrentLinkedDeque<>();
    private Instant lastPacketTime;

    // DNS-specific
    private int dnsQueryCount = 0;
    private final List<String> dnsQueries = Collections.synchronizedList(new ArrayList<>());

    private String status = "ACTIVE";

    public void addPacket(int bytes, Instant ts, int tcpFlags) {
        packetCount++;
        byteCount += bytes;
        if (firstSeen == null) firstSeen = ts;
        lastSeen = ts;

        packetSizes.add(bytes);
        if (packetSizes.size() > 1000) packetSizes.pollFirst(); // bound memory

        if (lastPacketTime != null) {
            long iat = ts.toEpochMilli() - lastPacketTime.toEpochMilli();
            if (iat >= 0) {
                interArrivalMs.add(iat);
                if (interArrivalMs.size() > 500) interArrivalMs.pollFirst();
            }
        }
        lastPacketTime = ts;

        // TCP flags: SYN=2, ACK=16, FIN=1, RST=4
        if ((tcpFlags & 0x02) != 0) synCount++;
        if ((tcpFlags & 0x10) != 0) ackCount++;
        if ((tcpFlags & 0x01) != 0) finCount++;
        if ((tcpFlags & 0x04) != 0) rstCount++;
    }

    public void addDnsQuery(String domain) {
        dnsQueryCount++;
        dnsQueries.add(domain);
        if (dnsQueries.size() > 200) dnsQueries.remove(0);
    }

    public long getDurationMs() {
        if (firstSeen == null || lastSeen == null) return 0;
        return lastSeen.toEpochMilli() - firstSeen.toEpochMilli();
    }

    public double getSynRatio() {
        return packetCount == 0 ? 0.0 : (double) synCount / packetCount;
    }

    public double getMeanPacketSize() {
        if (packetSizes.isEmpty()) return 0;
        return packetSizes.stream().mapToInt(Integer::intValue).average().orElse(0);
    }

    public double getMeanInterArrivalMs() {
        if (interArrivalMs.isEmpty()) return 0;
        return interArrivalMs.stream().mapToLong(Long::longValue).average().orElse(0);
    }

    public double getInterArrivalVariance() {
        if (interArrivalMs.size() < 2) return 0;
        double mean = getMeanInterArrivalMs();
        return interArrivalMs.stream()
                .mapToDouble(v -> (v - mean) * (v - mean))
                .average().orElse(0);
    }

    public String getFlowKey() {
        return sourceIp + ":" + sourcePort + "->" + destinationIp + ":" + destinationPort + "/" + protocol;
    }
}
