"""
NEXUS SOC Detector Models
Each detector wraps a trained scikit-learn / XGBoost model
with a fallback rule-based scorer when no model file exists.

IMPORTANT:
- Models classify based on passive flow features only
- No payload inspection, no active probing
- Fallback rules are for demo/development; trained models are preferred
"""

from __future__ import annotations
import logging
import os
from typing import Dict, Optional, Any
from pathlib import Path

import numpy as np
import joblib

logger = logging.getLogger("nexussoc.models")


class BaseDetector:
    """Base class for all threat detectors."""

    name: str = "base"
    version: str = "v1.0"
    model_type: str = "RulesBased"
    threat_class: str = "UNKNOWN"

    # Ordered feature list expected by the model
    feature_names: list[str] = []

    def __init__(self, model_path: Optional[str] = None):
        self.model = None
        self.model_path = model_path
        self._metrics: Dict[str, float] = {}

        if model_path and Path(model_path).exists():
            try:
                data = joblib.load(model_path)
                if isinstance(data, dict):
                    self.model = data.get("model")
                    self._metrics = data.get("metrics", {})
                    if "feature_names" in data:
                        self.feature_names = data["feature_names"]
                else:
                    self.model = data
                logger.info(f"Loaded model from {model_path}")
            except Exception as e:
                logger.warning(f"Could not load model from {model_path}: {e}")
                self.model = None

    def is_loaded(self) -> bool:
        return self.model is not None

    def get_metrics(self) -> Dict[str, float]:
        return self._metrics

    def _extract_feature_vector(self, features: Dict[str, float]) -> np.ndarray:
        """Extract ordered feature vector from dict."""
        return np.array([features.get(f, 0.0) for f in self.feature_names]).reshape(1, -1)

    def predict(self, features: Dict[str, float]) -> Dict[str, Any]:
        """Run inference. Override rule_score() for fallback logic."""
        if self.model is not None:
            try:
                X = self._extract_feature_vector(features)
                proba = self.model.predict_proba(X)[0]
                # Assume class 1 = threat
                confidence = float(proba[1]) if len(proba) > 1 else float(proba[0])
                is_threat = confidence >= 0.5

                # Feature importance (for tree models)
                fi = None
                if hasattr(self.model, "feature_importances_") and self.feature_names:
                    fi_vals = self.model.feature_importances_
                    fi = {self.feature_names[i]: float(fi_vals[i])
                          for i in range(min(len(self.feature_names), len(fi_vals)))}

                return {
                    "threat_class": self.threat_class,
                    "confidence": confidence,
                    "is_threat": is_threat,
                    "model_version": f"{self.name}-{self.version}",
                    "feature_importance": fi,
                }
            except Exception as e:
                logger.warning(f"{self.name} ML inference failed: {e}, using fallback")

        # Fallback: rule-based score
        score = self.rule_score(features)
        return {
            "threat_class": self.threat_class,
            "confidence": score,
            "is_threat": score >= 0.5,
            "model_version": f"{self.name}-{self.version}-rules",
            "feature_importance": None,
        }

    def rule_score(self, features: Dict[str, float]) -> float:
        """Override in subclasses for rule-based fallback scoring."""
        return 0.0


# ── DDoS / SYN Flood Detector ─────────────────────────────────────────────────

class DDoSDetector(BaseDetector):
    name = "ddos"
    version = "v1.0"
    model_type = "RandomForest"
    threat_class = "SYN_FLOOD"
    feature_names = [
        "flow_rate", "packet_rate", "syn_ratio", "unique_source_ips",
        "source_entropy", "dest_concentration", "mean_packet_size",
        "packets", "bytes", "duration_ms", "syn_count"
    ]

    def rule_score(self, features: Dict[str, float]) -> float:
        score = 0.0
        syn_ratio = features.get("syn_ratio", 0)
        unique_srcs = features.get("unique_source_ips", 0)
        flow_rate = features.get("flow_rate", 0)

        if syn_ratio > 0.9: score += 0.45
        elif syn_ratio > 0.7: score += 0.25
        elif syn_ratio > 0.5: score += 0.10

        if unique_srcs > 1000: score += 0.35
        elif unique_srcs > 100: score += 0.20
        elif unique_srcs > 20: score += 0.10

        if flow_rate > 500: score += 0.20
        elif flow_rate > 100: score += 0.10

        return min(score, 1.0)


# ── Port Scan Detector ────────────────────────────────────────────────────────

class PortScanDetector(BaseDetector):
    name = "portscan"
    version = "v1.0"
    model_type = "RandomForest"
    threat_class = "PORT_SCAN"
    feature_names = [
        "unique_dest_ports", "unique_dest_hosts", "fan_out",
        "connection_rate", "failed_connections", "syn_without_ack",
        "packet_count", "duration_ms"
    ]

    def rule_score(self, features: Dict[str, float]) -> float:
        score = 0.0
        ports = features.get("unique_dest_ports", 0)
        hosts = features.get("unique_dest_hosts", 0)
        fan_out = features.get("fan_out", 0)

        if ports > 1000: score += 0.50
        elif ports > 100: score += 0.35
        elif ports > 20: score += 0.20

        if hosts > 50: score += 0.25
        elif hosts > 10: score += 0.10

        if fan_out > 100: score += 0.25

        return min(score, 1.0)


# ── DNS / DGA Detector ────────────────────────────────────────────────────────

class DNSDGADetector(BaseDetector):
    name = "dns"
    version = "v1.0"
    model_type = "RandomForest"
    threat_class = "DNS_TUNNEL"
    feature_names = [
        "domain_length", "entropy", "digit_ratio", "consonant_ratio",
        "unique_char_ratio", "ngram_anomaly_score", "query_rate",
        "subdomain_depth", "tld_suspicion"
    ]

    def rule_score(self, features: Dict[str, float]) -> float:
        score = 0.0
        entropy = features.get("entropy", 0)
        length = features.get("domain_length", 0)
        digit_ratio = features.get("digit_ratio", 0)
        ngram = features.get("ngram_anomaly_score", 0)
        query_rate = features.get("query_rate", 0)
        tld = features.get("tld_suspicion", 0)

        if entropy > 3.8: score += 0.35
        elif entropy > 3.2: score += 0.20
        elif entropy > 2.8: score += 0.10

        if length > 30: score += 0.20
        elif length > 20: score += 0.10

        if digit_ratio > 0.4: score += 0.15
        if ngram > 0.7: score += 0.20
        if query_rate > 2.0: score += 0.10
        if tld > 0: score += 0.10

        return min(score, 1.0)


# ── C2 Beaconing Detector ─────────────────────────────────────────────────────

class C2Detector(BaseDetector):
    name = "c2"
    version = "v1.0"
    model_type = "XGBoost"
    threat_class = "C2_BEACON"
    feature_names = [
        "mean_inter_arrival_ms", "inter_arrival_variance", "periodicity_score",
        "connection_count", "unique_dest_count", "flow_duration_ms",
        "bytes_per_flow", "small_packet_ratio"
    ]

    def rule_score(self, features: Dict[str, float]) -> float:
        score = 0.0
        periodicity = features.get("periodicity_score", 0)
        mean_iat = features.get("mean_inter_arrival_ms", 0)
        variance = features.get("inter_arrival_variance", 0)
        count = features.get("connection_count", 0)

        # High periodicity = suspicious
        if periodicity > 0.85: score += 0.50
        elif periodicity > 0.70: score += 0.30
        elif periodicity > 0.55: score += 0.15

        # Regular interval around 30s, 60s, 300s (common beacon intervals)
        for beacon_interval in [30000, 60000, 300000, 3600000]:
            if mean_iat > 0 and abs(mean_iat - beacon_interval) / beacon_interval < 0.2:
                score += 0.20
                break

        if count > 20: score += 0.15
        if variance < mean_iat * 0.1 and mean_iat > 0: score += 0.15  # very low jitter

        return min(score, 1.0)


# ── Data Exfiltration Detector ────────────────────────────────────────────────

class ExfiltrationDetector(BaseDetector):
    name = "exfil"
    version = "v1.0"
    model_type = "IsolationForest"
    threat_class = "DATA_EXFILTRATION"
    feature_names = [
        "outbound_bytes", "inbound_bytes", "outbound_inbound_ratio",
        "flow_duration_ms", "dest_concentration", "transfer_rate_bps", "burst_count"
    ]

    def rule_score(self, features: Dict[str, float]) -> float:
        score = 0.0
        ratio = features.get("outbound_inbound_ratio", 0)
        outbound = features.get("outbound_bytes", 0)
        rate = features.get("transfer_rate_bps", 0)

        if ratio > 50: score += 0.50
        elif ratio > 20: score += 0.35
        elif ratio > 10: score += 0.20

        if outbound > 10_000_000: score += 0.30
        elif outbound > 1_000_000: score += 0.15

        if rate > 10_000_000: score += 0.20  # > 10 MB/s sustained

        return min(score, 1.0)
