FROM python:3.11-slim

WORKDIR /app

# System deps (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY ml-service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy ml-repo source (ThreatDetector + features + explain)
COPY ml-repo/src /app/ml-repo/src

# Copy ml-repo model artefacts (pre-trained .joblib + model_meta.json)
COPY ml-repo/models /app/ml-repo/models

# Copy the FastAPI entrypoint
COPY ml-service/main.py /app/main.py

# Fix: hardcode container paths — do not rely on relative __file__ resolution
ENV MODEL_DIR=/app/ml-repo/models
ENV ML_REPO_SRC=/app/ml-repo/src
ENV LOG_LEVEL=INFO
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
