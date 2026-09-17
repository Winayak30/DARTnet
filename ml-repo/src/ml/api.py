from typing import Dict, List
import pandas as pd
from fastapi import FastAPI

try:
    from ml.detector import ThreatDetector
except ImportError:
    from detector import ThreatDetector  # type: ignore

app = FastAPI(title="SIH26145 Threat Detector API", version="ml-v1")
detector = ThreatDetector()


@app.get("/health")
def health():
    return {"status": "ok", "model_version": detector.meta["model_version"]}


@app.post("/predict")
def predict(flow: Dict):
    return detector.predict(flow)


@app.post("/predict_batch")
def predict_batch(flows: List[Dict]):
    df = pd.DataFrame(flows)
    return detector.predict_batch(df)