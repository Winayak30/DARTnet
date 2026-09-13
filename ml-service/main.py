"""
NEXUS SOC ML Service
SIH26145 - AI-Based Cyber Threat Detection

FastAPI inference service exposing trained models for:
- DDoS / SYN Flood detection
- Port Scan detection
- DNS/DGA detection
- C2 Beaconing detection
- Data Exfiltration detection

PASSIVE ONLY: Models analyze extracted flow features only.
No active probing, no payload decryption.
"""

import os
import time
import logging
from pathlib import Path
from typing import Dict, Optional, List

import numpy as np
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import (
    DDoSDetector, PortScanDetector, DNSDGADetector,
    C2Detector, ExfiltrationDetector
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s %(levelname)s %(name)s - %(message)s')
logger = logging.getLogger("nexussoc.ml")

app = FastAPI(
    title="NEXUS SOC ML Service",
    description="Inference API for passive cyber threat detection. SIH26145.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_DIR = Path(os.getenv("MODEL_DIR", "/app/models"))

# Loaded detectors
detectors: Dict[str, object] = {}


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    flowId: str
    detectorType: str   # DDOS, PORT_SCAN, DNS_DGA, C2, EXFILTRATION
    features: Dict[str, float]


class PredictResponse(BaseModel):
    flowId: str
    threatClass: str
    confidence: float
    isThreat: bool
    modelVersion: str
    featureImportance: Optional[Dict[str, float]] = None
    inferenceLatencyMs: Optional[int] = None


class ModelInfoResponse(BaseModel):
    name: str
    version: str
    modelType: str
    threatClass: str
    loaded: bool
    metrics: Optional[Dict[str, float]] = None


# ── Startup: load models ──────────────────────────────────────────────────────

@app.on_event("startup")
async def load_models():
    global detectors
    detector_classes = {
        "DDOS": DDoSDetector,
        "PORT_SCAN": PortScanDetector,
        "DNS_DGA": DNSDGADetector,
        "C2": C2Detector,
        "EXFILTRATION": ExfiltrationDetector,
    }
    for name, cls in detector_classes.items():
        try:
            model_path = MODEL_DIR / f"{name.lower()}_model.joblib"
            detector = cls(model_path=str(model_path) if model_path.exists() else None)
            detectors[name] = detector
            logger.info(f"Loaded detector: {name} (model={'file' if model_path.exists() else 'fallback'})")
        except Exception as e:
            logger.warning(f"Could not load detector {name}: {e}")
            # Use fallback rule-based detection
            detectors[name] = cls(model_path=None)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "detectors": list(detectors.keys())}


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    start = time.time()
    detector_type = request.detectorType.upper()

    if detector_type not in detectors:
        raise HTTPException(status_code=400, detail=f"Unknown detector: {detector_type}")

    detector = detectors[detector_type]
    result = detector.predict(request.features)

    latency_ms = int((time.time() - start) * 1000)
    logger.debug(f"Prediction {detector_type} flow={request.flowId} "
                 f"threat={result['is_threat']} conf={result['confidence']:.3f} "
                 f"latency={latency_ms}ms")

    return PredictResponse(
        flowId=request.flowId,
        threatClass=result["threat_class"],
        confidence=result["confidence"],
        isThreat=result["is_threat"],
        modelVersion=result["model_version"],
        featureImportance=result.get("feature_importance"),
        inferenceLatencyMs=latency_ms,
    )


@app.get("/models/{detector_type}", response_model=ModelInfoResponse)
def get_model_info(detector_type: str):
    dt = detector_type.upper()
    if dt not in detectors:
        raise HTTPException(status_code=404, detail=f"Detector not found: {detector_type}")
    d = detectors[dt]
    return ModelInfoResponse(
        name=d.name,
        version=d.version,
        modelType=d.model_type,
        threatClass=d.threat_class,
        loaded=d.is_loaded(),
        metrics=d.get_metrics(),
    )


@app.get("/models")
def list_models():
    return [
        {
            "detectorType": k,
            "name": v.name,
            "version": v.version,
            "loaded": v.is_loaded(),
            "metrics": v.get_metrics(),
        }
        for k, v in detectors.items()
    ]
