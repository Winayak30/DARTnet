package com.dartnet.ml;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * Request / Response DTOs for the unified CICIDS2017-backed ML service.
 *
 * Breaking changes from v1:
 *  - PredictRequest no longer carries detectorType (unified model handles all classes)
 *  - PredictResponse adds anomalyScore, riskScore, severity, explanation
 *  - New BatchPredictRequest / BatchPredictResponse wrappers for /predict_batch
 */
public class MlContract {

    // ── Request ───────────────────────────────────────────────────────────────

    /**
     * Single-flow inference request.
     * {@code features} must contain the 51 CICFlowMeter columns defined in
     * ml-repo/src/ml/features.py::FEATURE_COLUMNS.
     */
    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PredictRequest {
        /** Opaque ID echoed back in the response for correlation. */
        private String flowId;

        /**
         * Feature map: key = CICFlowMeter column name, value = double.
         * e.g. "Destination Port", "Flow Duration", "Flow Bytes/s", …
         */
        private Map<String, Double> features;
    }

    // ── Response ──────────────────────────────────────────────────────────────

    /**
     * Unified inference response from the CICIDS2017 model.
     * Unknown JSON properties are ignored for forward-compatibility.
     */
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PredictResponse {
        /** Echoed flow ID. */
        private String flowId;

        /**
         * Predicted threat class: "DDoS" | "DoS" | "Port Scanning" | "Bots" |
         * "Brute Force" | "Web Attacks" | "Normal Traffic"
         */
        private String threatClass;

        /** Alias for threatClass (snake-case field from Python). */
        private String threat;

        /** Classifier probability for the top class (0–1). */
        private Double confidence;

        /** IsolationForest normalized anomaly score (0–1; higher = more anomalous). */
        @JsonProperty("anomalyScore")
        private Double anomalyScore;

        /**
         * Fused risk score 0–100.
         * risk = (0.65 * confidence + 0.35 * anomalyScore) * severityWeight * 100
         */
        @JsonProperty("riskScore")
        private Double riskScore;

        /** CRITICAL | HIGH | MEDIUM | LOW | NONE */
        private String severity;

        /** True when the predicted class is not Normal Traffic. */
        private Boolean isThreat;

        /** Model artifact version (e.g. "ml-v1"). */
        private String modelVersion;

        /** Human-readable natural-language explanation (from explain.py). */
        private String explanation;

        /** Key evidence features extracted by the detector. */
        private Map<String, Object> evidence;

        /** Round-trip inference latency in milliseconds (set client-side). */
        private Long inferenceLatencyMs;
    }

    // ── Batch ─────────────────────────────────────────────────────────────────

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class BatchPredictRequest {
        private List<Map<String, Double>> flows;
    }

    // ── Model metadata ────────────────────────────────────────────────────────

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ModelInfo {
        private String name;
        private String version;
        private String detectorType;
        private Boolean loaded;
        private List<String> classes;
        private Long trainedRows;
        private Double testAccuracy;
        private Double testWeightedF1;
        private Double testMacroF1;
        private Map<String, Double> metrics;
    }
}
