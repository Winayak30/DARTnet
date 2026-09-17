package com.dartnet.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
@Builder
public class ModelDTO {
    private Long id;
    private String name;
    private String version;
    private String modelType;
    private String threatClass;
    private String dataset;
    private List<String> features;
    private Map<String, Double> metrics;  // precision, recall, f1, fpr
    private Boolean isActive;
    private String createdAt;
    private String status;
    private String description;
    private String validationStrategy;
    private String limitations;
}
