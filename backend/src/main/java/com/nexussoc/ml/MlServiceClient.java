package com.nexussoc.ml;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;

/**
 * HTTP client for the Python ML inference service.
 * Passive detection only - no active probing or command execution.
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
     * Run inference for a single flow.
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
            long elapsed = System.currentTimeMillis() - start;
            if (response != null) {
                response.setInferenceLatencyMs(elapsed);
            }
            return Optional.ofNullable(response);
        } catch (WebClientResponseException e) {
            log.warn("ML service returned {} for detector {}: {}",
                    e.getStatusCode(), request.getDetectorType(), e.getMessage());
            return Optional.empty();
        } catch (Exception e) {
            log.warn("ML service unreachable for detector {}: {}", request.getDetectorType(), e.getMessage());
            return Optional.empty();
        }
    }

    public boolean isHealthy() {
        try {
            String status = webClient.get()
                    .uri("/health")
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(5))
                    .block();
            return status != null;
        } catch (Exception e) {
            return false;
        }
    }

    public Optional<Map> getModelInfo(String detectorType) {
        try {
            Map result = webClient.get()
                    .uri("/models/{type}", detectorType)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(Duration.ofSeconds(10))
                    .block();
            return Optional.ofNullable(result);
        } catch (Exception e) {
            log.warn("Could not fetch model info for {}: {}", detectorType, e.getMessage());
            return Optional.empty();
        }
    }
}
