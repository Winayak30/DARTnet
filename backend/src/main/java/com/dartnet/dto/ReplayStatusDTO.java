package com.dartnet.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ReplayStatusDTO {
    private Long sessionId;
    private String scenario;
    private String status;      // STOPPED, RUNNING, PAUSED, COMPLETED, ERROR
    private Double speedMultiplier;
    private Long flowsProcessed;
    private Long packetsProcessed;
    private Long bytesProcessed;
    private String startedAt;
    private Double progressPercent;
    private String errorMessage;
}
