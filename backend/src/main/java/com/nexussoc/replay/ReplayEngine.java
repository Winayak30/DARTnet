package com.nexussoc.replay;

import com.nexussoc.domain.entity.NetworkFlow;
import com.nexussoc.domain.entity.ReplaySession;
import com.nexussoc.domain.repository.NetworkFlowRepository;
import com.nexussoc.domain.repository.ReplaySessionRepository;
import com.nexussoc.dto.AlertDTO;
import com.nexussoc.dto.ReplayStatusDTO;
import com.nexussoc.metrics.MetricsCollector;
import com.nexussoc.pipeline.FeatureExtractor;
import com.nexussoc.pipeline.FlowAssembler;
import com.nexussoc.pipeline.FlowState;
import com.nexussoc.service.AlertService;
import com.nexussoc.service.DetectionOrchestrator;
import com.nexussoc.websocket.WebSocketBroadcaster;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

/**
 * PCAP / simulated traffic replay engine.
 * 
 * Processes traffic INCREMENTALLY - not as a batch.
 * Features, inference, and alerts are generated as replay progresses.
 * 
 * This engine uses the same pipeline as any live traffic input.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReplayEngine {

    private final FlowAssembler flowAssembler;
    private final FeatureExtractor featureExtractor;
    private final DetectionOrchestrator detectionOrchestrator;
    private final AlertService alertService;
    private final ReplaySessionRepository replaySessionRepository;
    private final NetworkFlowRepository flowRepository;
    private final WebSocketBroadcaster broadcaster;
    private final MetricsCollector metricsCollector;

    private volatile ReplaySession currentSession;
    private volatile boolean running = false;
    private volatile boolean paused = false;
    private volatile double speedMultiplier = 1.0;
    private ExecutorService replayExecutor = Executors.newSingleThreadExecutor();

    private final AtomicLong flowsProcessed = new AtomicLong(0);
    private final AtomicLong packetsProcessed = new AtomicLong(0);

    /**
     * Start a replay session for the given scenario.
     * Processing is incremental and non-blocking.
     */
    public ReplayStatusDTO startReplay(String scenario, double speed) {
        if (running) {
            stopReplay();
        }

        flowAssembler.reset();
        flowsProcessed.set(0);
        packetsProcessed.set(0);

        ReplaySession session = new ReplaySession();
        session.setScenario(scenario);
        session.setSpeedMultiplier(speed);
        session.setStatus("RUNNING");
        session.setStartedAt(Instant.now());
        currentSession = replaySessionRepository.save(session);

        running = true;
        paused = false;
        speedMultiplier = speed;

        replayExecutor.submit(() -> runReplay(scenario));

        log.info("Replay started: scenario={} speed={}x", scenario, speed);
        return buildStatus();
    }

    public ReplayStatusDTO pauseReplay() {
        paused = true;
        if (currentSession != null) {
            currentSession.setPausedAt(Instant.now());
            currentSession.setStatus("PAUSED");
            replaySessionRepository.save(currentSession);
        }
        broadcaster.broadcastReplayUpdate(buildStatus());
        return buildStatus();
    }

    public ReplayStatusDTO resumeReplay() {
        paused = false;
        if (currentSession != null) {
            currentSession.setStatus("RUNNING");
            replaySessionRepository.save(currentSession);
        }
        broadcaster.broadcastReplayUpdate(buildStatus());
        return buildStatus();
    }

    public ReplayStatusDTO stopReplay() {
        running = false;
        paused = false;
        if (currentSession != null) {
            currentSession.setStatus("STOPPED");
            currentSession.setCompletedAt(Instant.now());
            replaySessionRepository.save(currentSession);
        }
        broadcaster.broadcastReplayUpdate(buildStatus());
        return buildStatus();
    }

    public ReplayStatusDTO resetReplay() {
        stopReplay();
        flowAssembler.reset();
        flowsProcessed.set(0);
        packetsProcessed.set(0);
        return buildStatus();
    }

    public ReplayStatusDTO getStatus() {
        return buildStatus();
    }

    public boolean isRunning() {
        return running;
    }

    /**
     * Main replay loop - runs in background thread.
     * Generates synthetic traffic according to scenario.
     */
    private void runReplay(String scenario) {
        try {
            TrafficScenarioGenerator generator = new TrafficScenarioGenerator(scenario, speedMultiplier);
            log.info("Running scenario: {}", scenario);

            while (running && generator.hasMore()) {
                while (paused && running) {
                    Thread.sleep(100);
                }
                if (!running) break;

                // Get next synthetic packet event
                TrafficScenarioGenerator.PacketEvent event = generator.nextEvent();
                if (event == null) break;

                // Simulate real-time pacing based on speed
                long delayMs = (long) (event.delayMs() / speedMultiplier);
                if (delayMs > 0 && delayMs < 5000) {
                    Thread.sleep(delayMs);
                }

                // Process packet through pipeline
                FlowState flow = flowAssembler.processPacket(
                        event.srcIp(), event.dstIp(),
                        event.srcPort(), event.dstPort(),
                        event.protocol(),
                        event.bytes(), event.timestamp(),
                        event.tcpFlags()
                );

                if (event.dnsQuery() != null) {
                    flow = flowAssembler.processDnsQuery(
                            event.srcIp(), event.dstIp(), event.srcPort(),
                            event.dnsQuery(), event.timestamp()
                    );
                }

                packetsProcessed.incrementAndGet();

                // Periodically persist flow and run detection
                if (packetsProcessed.get() % 50 == 0 || event.isFinal()) {
                    persistAndDetect(flow, event.scenarioContext());
                }

                metricsCollector.recordPacket(event.bytes());
            }

            // Process expired flows
            flowAssembler.expireFlows().forEach(f -> persistAndDetect(f, scenario));

            if (running) {
                if (currentSession != null) {
                    currentSession.setStatus("COMPLETED");
                    currentSession.setCompletedAt(Instant.now());
                    replaySessionRepository.save(currentSession);
                }
                running = false;
                log.info("Scenario {} completed. Flows: {}, Packets: {}",
                        scenario, flowsProcessed.get(), packetsProcessed.get());
                broadcaster.broadcastReplayUpdate(buildStatus());
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.info("Replay interrupted");
        } catch (Exception e) {
            log.error("Replay error: {}", e.getMessage(), e);
            if (currentSession != null) {
                currentSession.setStatus("ERROR");
                replaySessionRepository.save(currentSession);
            }
            running = false;
            broadcaster.broadcastReplayUpdate(buildStatus());
        }
    }

    private void persistAndDetect(FlowState flowState, String context) {
        try {
            // Persist/update flow record
            NetworkFlow flow = persistFlow(flowState);
            
            // Run detection pipeline
            detectionOrchestrator.processFlow(flowState, flow, context);
            
            flowsProcessed.incrementAndGet();
            if (currentSession != null) {
                currentSession.setFlowsProcessed(flowsProcessed.get());
                currentSession.setPacketsProcessed(packetsProcessed.get());
            }

        } catch (Exception e) {
            log.warn("Error in persistAndDetect for flow {}: {}", flowState.getFlowId(), e.getMessage());
        }
    }

    private NetworkFlow persistFlow(FlowState fs) {
        NetworkFlow flow = flowRepository.findById(fs.getFlowId()).orElseGet(() -> {
            NetworkFlow nf = new NetworkFlow();
            nf.setId(fs.getFlowId());
            nf.setSourceIp(fs.getSourceIp());
            nf.setDestinationIp(fs.getDestinationIp());
            nf.setSourcePort(fs.getSourcePort());
            nf.setDestinationPort(fs.getDestinationPort());
            nf.setProtocol(fs.getProtocol());
            nf.setFlowStart(fs.getFirstSeen() != null ? fs.getFirstSeen() : Instant.now());
            if (currentSession != null) nf.setReplaySessionId(currentSession.getId());
            return nf;
        });
        flow.setPacketCount(fs.getPacketCount());
        flow.setByteCount(fs.getByteCount());
        flow.setDurationMs(fs.getDurationMs());
        flow.setFlowEnd(fs.getLastSeen());
        flow.setStatus(fs.getStatus());
        return flowRepository.save(flow);
    }

    private ReplayStatusDTO buildStatus() {
        String status = running ? (paused ? "PAUSED" : "RUNNING") : "STOPPED";
        if (currentSession != null) {
            String dbStatus = currentSession.getStatus();
            if ("COMPLETED".equals(dbStatus) || "ERROR".equals(dbStatus)) status = dbStatus;
        }
        return ReplayStatusDTO.builder()
                .sessionId(currentSession != null ? currentSession.getId() : null)
                .scenario(currentSession != null ? currentSession.getScenario() : null)
                .status(status)
                .speedMultiplier(speedMultiplier)
                .flowsProcessed(flowsProcessed.get())
                .packetsProcessed(packetsProcessed.get())
                .build();
    }
}
