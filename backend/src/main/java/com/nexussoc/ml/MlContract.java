package com.nexussoc.ml;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;
import java.util.Map;

/**
 * Pydantic-compatible request/response for ML inference.
 * Shared contract between Java backend and Python ML service.
 */
public class MlContract {

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PredictRequest {
        private String flowId;
        private String detectorType;  // DDOS, PORT_SCAN, DNS_DGA, C2, EXFILTRATION, ENCRYPTED
        private Map<String, Double> features;
    }

    @Data
    public static class PredictResponse {
        private String flowId;
        private String threatClass;
        private Double confidence;
        private Boolean isThreat;
        private String modelVersion;
        private Map<String, Double> featureImportance;
        private Long inferenceLatencyMs;
    }

    @Data
    public static class BatchPredictRequest {
        private String detectorType;
        private java.util.List<PredictRequest> flows;
    }

    @Data
    public static class ModelInfo {
        private String name;
        private String version;
        private String modelType;
        private String threatClass;
        private Boolean loaded;
        private Map<String, Double> metrics;
    }
}
