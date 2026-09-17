package com.dartnet.ml;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * HTTP client for the Python ML inference service (ml-repo CICIDS2017 unified model).
 *
 * The service accepts 51 CICFlowMeter features and returns a unified prediction
 * containing threatClass, confidence, anomalyScore, riskScore, severity, and explanation.
 *
 * PASSIVE ONLY — no active probing or command execution.
 */
@Service
@Slf4j
public class MlServiceClient {

    private final WebClient webClient;
    private final int timeoutSeconds;

    public MlServiceClient(
            @Value("${ml-service.url:http://localhost:8000}") String mlServiceUrl,
            @Value("${ml-service.timeout-seconds:30}") int timeoutSeconds) {
        this.webClient = WebClient.builder()
                .baseUrl(mlServiceUrl)
                .build();
        this.timeoutSeconds = timeoutSeconds;
    }

    /**
     * Single-flow inference.
     *
     * @param request carries 51 CICFlowMeter features in {@code features}
     * @return empty if the service is unreachable or returns a non-2xx status
     */
    public Optional<MlContract.PredictResponse> predict(MlContract.PredictRequest request) {
        try {
            long start = System.currentTimeMillis();
            MlContract.PredictResponse response = webClient.post()
                    .uri("/predict")
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(MlContract.PredictResponse.class)
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .block();
            if (response != null) {
                response.setInferenceLatencyMs(System.currentTimeMillis() - start);
            }
            return Optional.ofNullable(response);
        } catch (WebClientResponseException e) {
            log.warn("ML service returned {} for flow {}: {}",
                    e.getStatusCode(), request.getFlowId(), e.getMessage());
            return Optional.empty();
        } catch (Exception e) {
            log.warn("ML service unreachable for flow {}: {}", request.getFlowId(), e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Batch inference — more efficient than N sequential single calls.
     *
     * @param flows list of 51-feature CICFlowMeter maps, one entry per flow
     * @return empty list if the service is unreachable
     */
    public List<MlContract.PredictResponse> predictBatch(List<Map<String, Double>> flows) {
        try {
            MlContract.BatchPredictRequest req = MlContract.BatchPredictRequest.builder()
                    .flows(flows)
                    .build();
            List<MlContract.PredictResponse> responses = webClient.post()
                    .uri("/predict_batch")
                    .bodyValue(req)
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<List<MlContract.PredictResponse>>() {})
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .block();
            return responses != null ? responses : List.of();
        } catch (Exception e) {
            log.warn("ML batch inference failed ({}): {}", flows.size(), e.getMessage());
            return List.of();
        }
    }

    /**
     * Health probe — returns true only when the service reports status "ok".
     */
    public boolean isHealthy() {
        try {
            Map<?, ?> body = webClient.get()
                    .uri("/health")
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(Duration.ofSeconds(5))
                    .block();
            return body != null && "ok".equals(body.get("status"));
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Retrieve unified model metadata from /models endpoint.
     */
    public Optional<MlContract.ModelInfo> getModelInfo() {
        try {
            List<MlContract.ModelInfo> list = webClient.get()
                    .uri("/models")
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<List<MlContract.ModelInfo>>() {})
                    .timeout(Duration.ofSeconds(10))
                    .block();
            return (list != null && !list.isEmpty()) ? Optional.of(list.get(0)) : Optional.empty();
        } catch (Exception e) {
            log.warn("Could not fetch model info: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
