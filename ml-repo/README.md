# SIH26145 — ML Threat Detection Pipeline

## What this is

A trained machine-learning pipeline that classifies network flow data into
7 categories: benign, DDoS, DoS, Port Scanning, Bots, Brute Force, Web Attacks.
Trained on CICIDS2017 (flow-level features from CICFlowMeter).

## 1. Files you need

models/
- threat_classifier.joblib   -> trained RandomForest
- anomaly_detector.joblib    -> trained IsolationForest
- model_meta.json            -> metadata (feature list, class names, metrics)

src/ml/
- features.py   -> FEATURE_COLUMNS list + feature-matrix builder
- explain.py    -> rule-based natural-language explanation generator
- detector.py   -> ThreatDetector class, main integration point
- api.py        -> optional FastAPI wrapper (HTTP access)

Note: The .joblib model files are NOT in this repo (too large for git).
They will be shared separately (Drive/WhatsApp). Place them inside a
models/ folder before running anything.

## 2. Installation

```bash
pip install -r requirements-inference.txt
```

## 3. Option A — Direct Python import

```python
from detector import ThreatDetector

detector = ThreatDetector()
result = detector.predict(flow_dict)
results = detector.predict_batch(flow_df)
```

## 4. Option B — HTTP API (any language)

Start the server:
```bash
uvicorn src.ml.api:app --host 0.0.0.0 --port 8000
```

Call it:
POST http://<server-ip>:8000/predict


Swagger docs: http://<server-ip>:8000/docs

## 5. Input schema

Every flow must contain all 51 fields listed in FEATURE_COLUMNS
(src/ml/features.py). These are standard CICFlowMeter flow features.
Run CICFlowMeter (free, open-source) on captured traffic to generate them.

## 6. Output schema

```json
{
  "threat": "DDoS",
  "confidence": 1.0,
  "anomaly_score": 0.3703,
  "risk_score": 77.96,
  "severity": "HIGH",
  "evidence": {
    "destination_port": 80,
    "flow_duration": 1293792.0,
    "flow_bytes_per_sec": 8991.4,
    "flow_packets_per_sec": 7.73
  },
  "model_version": "ml-v1",
  "explanation": "This flow is classified as DDoS with very high confidence (100%)..."
}
```

| Field | Meaning |
|---|---|
| threat | "benign" or one of the 6 attack classes |
| confidence | Classifier's confidence in its prediction (0-1) |
| anomaly_score | How unusual this flow is vs. normal baseline (0-1) |
| risk_score | Combined score, 0-100, ready to sort/display on dashboard |
| severity | NONE / LOW / MEDIUM / HIGH / CRITICAL |
| evidence | Key raw values, for operator context |
| model_version | For tracking model versions across retraining |
| explanation | Full English sentence explaining the verdict (rule-based, no LLM) |

## 7. Runtime requirements

CPU only, no GPU needed. ~62ms per single-flow prediction.
Use predict_batch() for bulk throughput instead of looping predict().

## 8. What you do NOT need

The training dataset (CICIDS2017, ~700MB) is not required for inference.
The .joblib files already contain everything the model learned.
Inference only needs those 2 files + model_meta.json, nothing from data/.

## 9. Known limitations (documented honestly)

- Bots class: high recall (~98%) but lower precision (~24%). The model
  catches almost all bot traffic but also raises some false alarms on this
  class. The risk-score formula partially compensates: a "Bots" prediction
  only reaches HIGH/CRITICAL severity if classifier confidence is also
  genuinely high, not just present.
- DNS tunnelling: not classifiable. CICIDS2017 contains no DNS-payload
  metadata. Would need a supplementary dataset to add this class.
- Class imbalance: Web Attacks and Bots have far fewer training samples
  (~2,000 each) than other classes (100K+), so their metrics carry more
  uncertainty on unseen traffic.