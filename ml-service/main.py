"""
DARTNet ML Service — CICIDS2017 Unified Threat Detector
SIH26145 - AI-Based Cyber Threat Detection (NTRO)

FastAPI inference service backed by ml-repo ThreatDetector:
  - RandomForest trained on 2.5M CICIDS2017 rows  (99.68% accuracy)
  - IsolationForest anomaly detector               (trained on benign-only)
  - 51 CICFlowMeter standard features
  - 7 classes: DDoS | DoS | Port Scanning | Bots | Brute Force | Web Attacks | Normal Traffic
  - Risk-score fusion: 65% classifier confidence + 35% anomaly score

PASSIVE ONLY: analyses extracted flow features only.
No active probing, no payload decryption.
"""

import os
import sys
import logging
import time
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Import ml-repo source ──────────────────────────────────────────────────────
# In Docker: ML_REPO_SRC=/app/ml-repo/src  (set in Dockerfile ENV)
# Locally:   fall back to sibling directory relative to this file
_REPO_SRC = os.environ.get(
    "ML_REPO_SRC",
    str(Path(__file__).resolve().parent.parent / "ml-repo" / "src"),
)
if _REPO_SRC not in sys.path:
    sys.path.insert(0, _REPO_SRC)

# Default MODEL_DIR — overridden by Dockerfile ENV
_DEFAULT_MODEL_DIR = str(Path(__file__).resolve().parent.parent / "ml-repo" / "models")
os.environ.setdefault("MODEL_DIR", _DEFAULT_MODEL_DIR)

from ml.detector import ThreatDetector  # noqa: E402
from ml.features import FEATURE_COLUMNS  # noqa: E402

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger("dartnet.ml")

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="DARTNet ML Service",
    description=(
        "Unified passive threat detection — CICIDS2017 RandomForest + IsolationForest. "
        "SIH26145 — NTRO."
    ),
    version="ml-v1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Singleton ThreatDetector ───────────────────────────────────────────────────
_detector: Optional[ThreatDetector] = None


@app.on_event("startup")
async def load_model() -> None:
    global _detector
    model_dir = os.environ["MODEL_DIR"]
    try:
        _detector = ThreatDetector(model_dir=model_dir)
        logger.info(
            "ThreatDetector loaded — dir=%s  version=%s  classes=%s",
            model_dir,
            _detector.meta.get("model_version", "?"),
            _detector.meta.get("classes", []),
        )
    except Exception as exc:
        logger.error("Could not load ThreatDetector from %s: %s", model_dir, exc)
        _detector = None


def _require_detector() -> ThreatDetector:
    if _detector is None:
        raise HTTPException(
            status_code=503,
            detail="ML model not loaded — check MODEL_DIR and that .joblib files exist",
        )
    return _detector


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    """
    Single-flow inference request.
    `features` must contain the 51 CICFlowMeter columns (see FEATURE_COLUMNS).
    `flowId` and `detectorType` are optional / legacy; `detectorType` is ignored.
    """
    flowId: Optional[str] = None
    detectorType: Optional[str] = None   # ignored — unified model handles all classes
    features: Dict[str, float]


class PredictResponse(BaseModel):
    flowId: Optional[str] = None
    threatClass: str       # "DDoS" | "DoS" | "Port Scanning" | … | "Normal Traffic"
    threat: str            # same value, alias used by Java client
    confidence: float
    anomalyScore: float
    riskScore: float
    severity: str          # CRITICAL | HIGH | MEDIUM | LOW | NONE
    isThreat: bool
    modelVersion: str
    explanation: str
    evidence: Optional[Dict] = None
    inferenceLatencyMs: Optional[int] = None


class BatchPredictRequest(BaseModel):
    flows: List[Dict[str, float]]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _build_response(
    result: dict,
    flow_id: Optional[str],
    latency_ms: int,
) -> PredictResponse:
    threat_class = result["threat"] if result["threat"] != "benign" else "Normal Traffic"
    return PredictResponse(
        flowId=flow_id,
        threatClass=threat_class,
        threat=threat_class,
        confidence=result["confidence"],
        anomalyScore=result["anomaly_score"],
        riskScore=result["risk_score"],
        severity=result["severity"],
        isThreat=(result["threat"] != "benign"),
        modelVersion=result["model_version"],
        explanation=result.get("explanation", ""),
        evidence=result.get("evidence"),
        inferenceLatencyMs=latency_ms,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    if _detector is None:
        return {"status": "degraded", "model_version": "not_loaded", "classes": []}
    return {
        "status": "ok",
        "model_version": _detector.meta.get("model_version", "unknown"),
        "feature_count": len(FEATURE_COLUMNS),
        "classes": _detector.meta.get("classes", []),
    }


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest) -> PredictResponse:
    det = _require_detector()
    t0 = time.time()
    result = det.predict(request.features)
    latency_ms = int((time.time() - t0) * 1000)
    logger.debug(
        "predict flow=%s class=%s conf=%.3f risk=%.1f latency=%dms",
        request.flowId, result["threat"], result["confidence"],
        result["risk_score"], latency_ms,
    )
    return _build_response(result, request.flowId, latency_ms)


@app.post("/predict_batch", response_model=List[PredictResponse])
def predict_batch(request: BatchPredictRequest) -> List[PredictResponse]:
    import pandas as pd
    det = _require_detector()
    t0 = time.time()
    df = pd.DataFrame(request.flows)
    results = det.predict_batch(df)
    total_ms = int((time.time() - t0) * 1000)
    per_ms = total_ms // max(len(results), 1)
    return [_build_response(r, None, per_ms) for r in results]


@app.get("/models")
def list_models() -> list:
    """Backward-compatible endpoint — returns unified model info."""
    if _detector is None:
        return []
    meta = _detector.meta
    return [{
        "detectorType": "UNIFIED",
        "name": "DARTNet CICIDS2017 Classifier",
        "version": meta.get("model_version", "ml-v1"),
        "loaded": True,
        "classes": meta.get("classes", []),
        "trainedRows": meta.get("trained_rows"),
        "testAccuracy": meta.get("test_accuracy"),
        "testWeightedF1": meta.get("test_weighted_f1"),
        "testMacroF1": meta.get("test_macro_f1"),
        "metrics": {
            "accuracy": meta.get("test_accuracy", 0),
            "weighted_f1": meta.get("test_weighted_f1", 0),
            "macro_f1": meta.get("test_macro_f1", 0),
        },
    }]
