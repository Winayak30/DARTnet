# NEXUS SOC
## AI-Based Detection of Cyber Threats in Unidirectional IP Traffic

**SIH Problem Statement:** SIH26145  
**Organization:** National Technical Research Organisation (NTRO)  
**Event:** Smart India Hackathon 2026  

---

## What is NEXUS SOC?

NEXUS SOC is a **passive, AI-assisted network threat detection and security operations platform** that analyzes one-directional IP traffic using only passively collected network metadata. It generates explainable, structured security alerts in near real time.

The system is an **observation and intelligence system**, not an active defense system:

- ✓ One-way / Read Only  
- ✓ No Active Probing  
- ✓ No Payload Decryption  
- ✓ No Mitigation Commands  

---

## Why Unidirectional / Passive Traffic?

In many high-security network environments (government, critical infrastructure), a **hardware data diode** or network tap allows traffic to flow **only in one direction** — from the monitored network to the analysis system. The analysis system:

- Cannot send packets back to observed hosts
- Cannot complete TCP handshakes
- Cannot issue commands to network devices
- Can only observe packet metadata passively

NEXUS SOC is designed to operate correctly and usefully within these constraints.

---

## Architecture

```
PASSIVE NETWORK TRAFFIC
        |
        v
┌────────────────────┐
│ PCAP / Flow        │
│ Ingestion          │  ← Replay engine or live tap
└─────────┬──────────┘
          |
          v
┌────────────────────┐
│ Flow Reconstruction│  ← FlowAssembler
└─────────┬──────────┘
          |
          v
┌────────────────────┐
│ Feature Extraction │  ← FeatureExtractor (per detector type)
└────┬───────────────┘
     |               |
     v               v
Rule/Statistical   ML Detection (Python FastAPI)
Detectors          RandomForest / XGBoost
     |               |
     └────────┬──────┘
              |
              v
       Threat Scoring (score fusion)
              |
              v
       Alert Generation
              |
    ┌─────────┴─────────┐
    v                   v
PostgreSQL         WebSocket/SSE
                        |
                        v
                  React Dashboard
```

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for full details.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Java 17, Spring Boot 3.2, Spring WebSocket (STOMP) |
| Database | PostgreSQL 15, Flyway migrations |
| ML Service | Python 3.11, FastAPI, scikit-learn, XGBoost |
| Frontend | React 18, TypeScript, Vite, Recharts |
| Infra | Docker, Docker Compose |

---

## Threat Detectors

| Detector | Model | Status |
|----------|-------|--------|
| DDoS / SYN Flood | RandomForest | ✅ Implemented |
| Port Scan | RandomForest | ✅ Implemented |
| DNS Tunneling / DGA | RandomForest | ✅ Implemented |
| C2 Beaconing | XGBoost | ✅ Implemented |
| Data Exfiltration | RandomForest | ✅ Implemented |
| Encrypted Traffic Analysis | Metadata-only rules | ✅ Implemented (metadata only) |

---

## Quick Start

### Prerequisites

- Docker Desktop
- Docker Compose v2+
- (Optional, for local dev) Java 17, Node 20, Python 3.11

### Run with Docker Compose

```bash
git clone <repo>
cd nexus-soc

# Start all services (trains ML models, initializes DB, starts frontend)
docker compose up --build

# Open browser
open http://localhost:3000
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- ML Service: http://localhost:8000
- PostgreSQL: localhost:5432

### Local Development

```bash
# 1. Start PostgreSQL
docker compose up postgres -d

# 2. Train ML models
cd ml-service
pip install -r requirements.txt
python train_models.py  # outputs to ../models/

# 3. Seed database model records
cd ../scripts
python seed_models.py

# 4. Start backend
cd ../backend
./mvnw spring-boot:run

# 5. Start frontend
cd ../frontend
npm install
npm run dev   # http://localhost:3000
```

---

## Demo Guide

### Step-by-Step Demo

1. Open http://localhost:3000
2. Observe **PASSIVE MONITORING** indicator in sidebar (always visible)
3. Note the system state: STOPPED

**DDoS Demo:**
4. In top bar, select scenario: **DDoS SYN Flood**
5. Click **▶ Play**
6. Observe traffic metrics rise in Overview
7. Watch alerts appear in the alert queue (real alerts from actual detection)
8. Click a **SYN_FLOOD** alert
9. Investigation panel opens → Evidence tab shows actual SYN ratio, unique source IPs, source entropy
10. Note the detection latency (measured, not fabricated)

**C2 Beacon Demo:**
11. Click **↺ Reset**, select **C2 Beacon** scenario
12. Click **▶ Play**
13. After ~30 seconds, C2 beacon alerts appear
14. Open investigation → Evidence shows periodicity score, mean inter-arrival time
15. Navigate to Threat Analytics → C2 Beaconing → view beacon interval visualization

**Models:**
16. Open Models page → view actual measured F1/Precision/Recall metrics
17. Metrics are computed during training — not fabricated

**System:**
18. Open System page → real CPU, memory, latency metrics from running system

---

## Benchmark

```bash
# Requires running backend
cd scripts
pip install requests
python benchmark.py --host http://localhost:8080 --scenario DDOS_SYN_FLOOD --duration 60 --speed 5
```

Outputs: packets/sec, throughput Mbps, p50/p95 detection latency, CPU/memory.

---

## Project Structure

```
nexus-soc/
├── frontend/          React + TypeScript UI
├── backend/           Spring Boot backend
│   └── src/main/java/com/nexussoc/
│       ├── pipeline/  Flow assembly & feature extraction
│       ├── replay/    Scenario replay engine
│       ├── service/   Detection orchestrator, alert service
│       ├── ml/        ML service client
│       ├── controller/REST API endpoints
│       └── websocket/ Real-time event broadcasting
├── ml-service/        Python FastAPI ML inference service
│   ├── main.py        API endpoints
│   ├── models.py      Detector implementations
│   └── train_models.py Training script
├── data/              PCAP files and datasets
├── models/            Trained .joblib model files
├── scripts/           Benchmark, seed, utility scripts
├── docs/              Architecture, API, pipeline documentation
└── docker-compose.yml
```

---

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — System design
- [API.md](docs/API.md) — REST and WebSocket API reference
- [ML_PIPELINE.md](docs/ML_PIPELINE.md) — Training and evaluation
- [THREAT_DETECTORS.md](docs/THREAT_DETECTORS.md) — Detector specifications
- [LIMITATIONS.md](docs/LIMITATIONS.md) — Known limitations and scope
- [DEMO_GUIDE.md](docs/DEMO_GUIDE.md) — Step-by-step demo instructions

---

## Security Notice

NEXUS SOC does **not**:
- Send probes to observed hosts
- Ping observed hosts  
- Initiate connections to observed hosts
- Block source IPs
- Modify traffic
- Inject packets
- Decrypt payloads
- Provide inline IPS functionality

These are architectural constraints, not configurable settings.
