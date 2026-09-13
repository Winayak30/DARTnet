package com.nexussoc.controller;

import com.nexussoc.domain.entity.ModelVersion;
import com.nexussoc.domain.repository.ModelVersionRepository;
import com.nexussoc.dto.ModelDTO;
import com.nexussoc.ml.MlServiceClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/models")
@RequiredArgsConstructor
public class ModelController {

    private final ModelVersionRepository modelRepository;
    private final MlServiceClient mlClient;
    private final ObjectMapper objectMapper;

    @GetMapping
    public ResponseEntity<List<ModelDTO>> getModels() {
        List<ModelVersion> models = modelRepository.findByIsActiveTrue();
        List<ModelDTO> dtos = models.stream().map(this::toDTO).toList();
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ModelDTO> getModel(@PathVariable Long id) {
        return modelRepository.findById(id)
                .map(m -> ResponseEntity.ok(toDTO(m)))
                .orElse(ResponseEntity.notFound().build());
    }

    private ModelDTO toDTO(ModelVersion m) {
        List<String> features = List.of();
        Map<String, Double> metrics = Map.of();
        try {
            if (m.getFeaturesJson() != null) {
                features = objectMapper.readValue(m.getFeaturesJson(), new TypeReference<>() {});
            }
            if (m.getMetricsJson() != null) {
                metrics = objectMapper.readValue(m.getMetricsJson(), new TypeReference<>() {});
            }
        } catch (Exception ignored) {}

        return ModelDTO.builder()
                .id(m.getId())
                .name(m.getName())
                .version(m.getVersion())
                .modelType(m.getModelType())
                .threatClass(m.getThreatClass())
                .dataset(m.getDataset())
                .features(features)
                .metrics(metrics)
                .isActive(m.getIsActive())
                .createdAt(m.getCreatedAt() != null ? m.getCreatedAt().toString() : null)
                .status("LOADED")
                .build();
    }
}
