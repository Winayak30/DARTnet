package com.dartnet.pipeline;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Stateful flow assembler.
 * Reconstructs bidirectional flows from individual packets.
 * 
 * PASSIVE ONLY: This component only reads packet metadata.
 * No active probing, no packet injection, no response generation.
 */
@Component
@Slf4j
public class FlowAssembler {

    // Flow timeout - flows idle for this long are considered closed
    private static final long FLOW_TIMEOUT_MS = 120_000; // 2 minutes

    // Active flow states keyed by flow tuple
    private final ConcurrentHashMap<String, FlowState> activeFlows = new ConcurrentHashMap<>();

    // Source IP tracking for DDoS detection window
    private final ConcurrentHashMap<String, Long> sourceIpCount = new ConcurrentHashMap<>();

    private long flowIdCounter = 0;

    /**
     * Process a single packet observation and update or create flow state.
     */
    public FlowState processPacket(
            String srcIp, String dstIp,
            Integer srcPort, Integer dstPort,
            String protocol,
            int packetBytes, Instant timestamp, int tcpFlags) {

        String key = makeFlowKey(srcIp, dstIp, srcPort, dstPort, protocol);
        
        FlowState flow = activeFlows.computeIfAbsent(key, k -> {
            String flowId = generateFlowId();
            log.debug("New flow: {} {} -> {}:{}", protocol, srcIp, dstIp, dstPort);
            return new FlowState(flowId, srcIp, dstIp, srcPort, dstPort, protocol);
        });

        flow.addPacket(packetBytes, timestamp, tcpFlags);

        // Track unique sources per destination for DDoS window
        sourceIpCount.merge(dstIp + ":" + dstPort, 1L, Long::sum);

        return flow;
    }

    /**
     * Process a DNS query observation.
     */
    public FlowState processDnsQuery(
            String srcIp, String dstIp, Integer srcPort,
            String domain, Instant timestamp) {

        String key = makeFlowKey(srcIp, dstIp, srcPort, 53, "UDP");
        FlowState flow = activeFlows.computeIfAbsent(key, k ->
                new FlowState(generateFlowId(), srcIp, dstIp, srcPort, 53, "UDP"));
        flow.addPacket(60, timestamp, 0);
        flow.addDnsQuery(domain);
        return flow;
    }

    /**
     * Expire timed-out flows and return them for final processing.
     */
    public List<FlowState> expireFlows() {
        Instant cutoff = Instant.now().minusMillis(FLOW_TIMEOUT_MS);
        List<FlowState> expired = new ArrayList<>();
        Iterator<Map.Entry<String, FlowState>> it = activeFlows.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, FlowState> entry = it.next();
            FlowState flow = entry.getValue();
            if (flow.getLastSeen() != null && flow.getLastSeen().isBefore(cutoff)) {
                flow.setStatus("CLOSED");
                expired.add(flow);
                it.remove();
            }
        }
        return expired;
    }

    public Map<String, FlowState> getActiveFlows() {
        return Collections.unmodifiableMap(activeFlows);
    }

    public int getActiveFlowCount() {
        return activeFlows.size();
    }

    public void reset() {
        activeFlows.clear();
        sourceIpCount.clear();
    }

    private synchronized String generateFlowId() {
        return String.format("FL-%08X", ++flowIdCounter);
    }

    /**
     * Normalize flow key - treat A->B same as B->A for bidirectional flows.
     */
    private String makeFlowKey(String srcIp, String dstIp, Integer srcPort, Integer dstPort, String protocol) {
        // For TCP/UDP, use canonical direction based on port ordering
        String ep1 = srcIp + ":" + srcPort;
        String ep2 = dstIp + ":" + dstPort;
        if (ep1.compareTo(ep2) <= 0) {
            return ep1 + "<->" + ep2 + "/" + protocol;
        } else {
            return ep2 + "<->" + ep1 + "/" + protocol;
        }
    }
}
