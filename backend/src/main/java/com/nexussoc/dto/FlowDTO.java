package com.nexussoc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;
import java.time.Instant;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class FlowDTO {
    private String id;
    private Instant flowStart;
    private Instant flowEnd;
    private String sourceIp;
    private String destinationIp;
    private Integer sourcePort;
    private Integer destinationPort;
    private String protocol;
    private Long packetCount;
    private Long byteCount;
    private Long durationMs;
    private Double threatScore;
    private String threatType;
    private String status;
}
