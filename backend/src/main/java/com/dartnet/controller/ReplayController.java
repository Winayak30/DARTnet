package com.dartnet.controller;

import com.dartnet.dto.ReplayStatusDTO;
import com.dartnet.replay.ReplayEngine;
import com.dartnet.service.DetectionOrchestrator;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/replay")
@RequiredArgsConstructor
public class ReplayController {

    private final ReplayEngine replayEngine;
    private final DetectionOrchestrator detectionOrchestrator;

    @PostMapping("/start")
    public ResponseEntity<ReplayStatusDTO> start(@RequestBody Map<String, Object> body) {
        String scenario = (String) body.getOrDefault("scenario", "DDOS_SYN_FLOOD");
        double speed = body.containsKey("speed")
                ? Double.parseDouble(body.get("speed").toString())
                : 1.0;
        return ResponseEntity.ok(replayEngine.startReplay(scenario, speed));
    }

    @PostMapping("/pause")
    public ResponseEntity<ReplayStatusDTO> pause() {
        return ResponseEntity.ok(replayEngine.pauseReplay());
    }

    @PostMapping("/resume")
    public ResponseEntity<ReplayStatusDTO> resume() {
        return ResponseEntity.ok(replayEngine.resumeReplay());
    }

    @PostMapping("/stop")
    public ResponseEntity<ReplayStatusDTO> stop() {
        return ResponseEntity.ok(replayEngine.stopReplay());
    }

    @PostMapping("/reset")
    public ResponseEntity<ReplayStatusDTO> reset() {
        detectionOrchestrator.resetWindowStats();
        return ResponseEntity.ok(replayEngine.resetReplay());
    }

    @GetMapping("/status")
    public ResponseEntity<ReplayStatusDTO> status() {
        return ResponseEntity.ok(replayEngine.getStatus());
    }
}
