import json
import joblib
import numpy as np
import pandas as pd

try:
    from ml.features import FEATURE_COLUMNS, build_feature_matrix
    from ml.explain import generate_explanation
except ImportError:
    # Fallback when run directly from ml-repo/src/ml/
    from features import FEATURE_COLUMNS, build_feature_matrix  # type: ignore
    from explain import generate_explanation  # type: ignore

MODEL_DIR = "models"

SEVERITY_WEIGHTS = {
    "DDoS": 1.0,
    "DoS": 1.0,
    "Bots": 0.85,
    "Brute Force": 0.9,
    "Web Attacks": 0.9,
    "Port Scanning": 0.6,
    "Normal Traffic": 0.0,
}

BENIGN_LABEL = "Normal Traffic"
CONFIDENCE_WEIGHT = 0.65
ANOMALY_WEIGHT = 0.35


def _severity_bucket(risk_score: float) -> str:
    if risk_score >= 80:
        return "CRITICAL"
    if risk_score >= 60:
        return "HIGH"
    if risk_score >= 35:
        return "MEDIUM"
    return "LOW"


class ThreatDetector:
    def __init__(self, model_dir: str = MODEL_DIR):
        self.clf = joblib.load(f"{model_dir}/threat_classifier.joblib")
        self.iso = joblib.load(f"{model_dir}/anomaly_detector.joblib")
        with open(f"{model_dir}/model_meta.json") as f:
            self.meta = json.load(f)

    def _normalize_anomaly_score(self, raw_scores: np.ndarray) -> np.ndarray:
        clipped = np.clip(raw_scores, -0.5, 0.5)
        return 0.5 - clipped

    def predict_batch(self, df: pd.DataFrame) -> list[dict]:
        X = build_feature_matrix(df)

        proba = self.clf.predict_proba(X)
        class_labels = self.clf.classes_
        top_idx = proba.argmax(axis=1)
        top_classes = class_labels[top_idx]
        top_confidence = proba[np.arange(len(proba)), top_idx]

        raw_anomaly = self.iso.decision_function(X)
        anomaly_score = self._normalize_anomaly_score(raw_anomaly)

        results = []
        for i in range(len(df)):
            threat_class = top_classes[i]
            confidence = float(top_confidence[i])
            anomaly = float(anomaly_score[i])
            severity_weight = SEVERITY_WEIGHTS.get(threat_class, 0.7)

            risk_score = (
                (CONFIDENCE_WEIGHT * confidence + ANOMALY_WEIGHT * anomaly)
                * severity_weight * 100
            )
            risk_score = round(min(max(risk_score, 0), 100), 2)

            row = X.iloc[i]
            evidence = {
                "destination_port": int(row["Destination Port"]),
                "flow_duration": float(row["Flow Duration"]),
                "flow_bytes_per_sec": float(row["Flow Bytes/s"]),
                "flow_packets_per_sec": float(row["Flow Packets/s"]),
            }

            result = {
                "threat": threat_class if threat_class != BENIGN_LABEL else "benign",
                "confidence": round(confidence, 4),
                "anomaly_score": round(anomaly, 4),
                "risk_score": risk_score,
                "severity": _severity_bucket(risk_score) if threat_class != BENIGN_LABEL else "NONE",
                "evidence": evidence,
                "model_version": self.meta["model_version"],
            }
            result["explanation"] = generate_explanation(result)
            results.append(result)
        return results

    def predict(self, flow: dict) -> dict:
        df = pd.DataFrame([flow])
        return self.predict_batch(df)[0]


if __name__ == "__main__":
    df = pd.read_parquet("data/processed/cicids2017_clean.parquet")
    detector = ThreatDetector()
    sample = df.drop(columns=["Attack Type"]).iloc[0].to_dict()
    print(json.dumps(detector.predict(sample), indent=2))