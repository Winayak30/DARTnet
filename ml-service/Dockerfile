FROM python:3.11-slim

WORKDIR /app

# System deps (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY ml-service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy ml-repo source
COPY ml-repo/src /app/ml-repo/src

# Copy trained model artifacts
COPY ml-repo/models /app/ml-repo/models

# Copy FastAPI entrypoint
COPY ml-service/main.py /app/main.py

ENV MODEL_DIR=/app/ml-repo/models
ENV ML_REPO_SRC=/app/ml-repo/src
ENV LOG_LEVEL=INFO
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]