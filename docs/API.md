# NEXUS SOC API Reference

## Base URL
`http://localhost:8080`

## REST Endpoints

### Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/overview` | KPI summary for overview page |

### Alerts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/alerts` | Paginated alert list (params: `page`, `size`, `severity`, `status`) |
| GET | `/api/alerts/{id}` | Alert detail with evidence |
| PATCH | `/api/alerts/{id}/status` | Update alert lifecycle status |
| GET | `/api/alerts/recent` | Recent N alerts (param: `limit`) |

**Alert Status Values:** `NEW`, `ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED`

### Flows

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/flows` | Paginated flow list |
| GET | `/api/flows/{id}` | Flow detail + extracted features |

### Replay

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/replay/start` | Start replay: `{"scenario": "DDOS_SYN_FLOOD", "speed": 1.0}` |
| POST | `/api/replay/pause` | Pause replay |
| POST | `/api/replay/resume` | Resume paused replay |
| POST | `/api/replay/stop` | Stop replay |
| POST | `/api/replay/reset` | Reset all state |
| GET | `/api/replay/status` | Current replay status |

**Scenarios:** `DDOS_SYN_FLOOD`, `PORT_SCAN`, `DNS_DGA`, `C2_BEACON`, `DATA_EXFIL`, `MIXED`

### Models

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/models` | All active model versions |
| GET | `/api/models/{id}` | Model detail |

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/system/health` | Full pipeline and resource health |
| GET | `/api/system/metrics?minutes=60` | Historical metrics time series |

### Reports

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/reports/alerts/export` | Export alerts: `{"format": "JSON"}` or `{"format": "CSV"}` |
| POST | `/api/reports/incidents` | Generate incident report text |

---

## WebSocket (STOMP over SockJS)

**Endpoint:** `ws://localhost:8080/ws`

### Topics

| Topic | Description |
|-------|-------------|
| `/topic/alerts` | Alert created/updated events |
| `/topic/traffic` | Traffic metric updates (every 1s) |
| `/topic/system` | System health/pipeline events |
| `/topic/replay` | Replay state change events |

### Event Envelope

```json
{
  "eventType": "ALERT_CREATED",
  "timestamp": "2026-09-13T10:42:31Z",
  "payload": { ...canonical alert or metric... }
}
```

### Event Types

- `ALERT_CREATED` — New threat alert
- `ALERT_UPDATED` — Alert status changed
- `TRAFFIC_UPDATE` — SystemMetric with current traffic rates
- `SYSTEM_UPDATE` — SystemMetric update
- `REPLAY_UPDATE` — Replay state change
- `PIPELINE_UPDATE` — Pipeline component status change

---

## Canonical Alert Schema

```json
{
  "id": "ALT-000001",
  "timestamp": "2026-09-13T10:42:31Z",
  "flowId": "FL-8F32A91C",
  "threatClass": "SYN_FLOOD",
  "severity": "CRITICAL",
  "confidence": 0.974,
  "sourceIp": "10.2.1.41",
  "destinationIp": "192.168.0.10",
  "protocol": "TCP",
  "detectionLatencyMs": 143,
  "modelVersion": "ddos-v1.0",
  "evidence": {
    "synRatio": "0.984",
    "flowRate": "18421.0/s",
    "uniqueSourceIps": "4832",
    "sourceEntropy": "0.210",
    "ruleScore": "0.850",
    "mlScore": "0.974"
  },
  "status": "NEW"
}
```

---

## ML Service API

**Base URL:** `http://localhost:8000`

### POST /predict

```json
{
  "flowId": "FL-8F32A91C",
  "detectorType": "DDOS",
  "features": {
    "syn_ratio": 0.984,
    "unique_source_ips": 4832,
    "source_entropy": 0.21
  }
}
```

Response:

```json
{
  "flowId": "FL-8F32A91C",
  "threatClass": "SYN_FLOOD",
  "confidence": 0.974,
  "isThreat": true,
  "modelVersion": "ddos-v1.0",
  "featureImportance": { "syn_ratio": 0.41, "unique_source_ips": 0.28 },
  "inferenceLatencyMs": 12
}
```

### GET /health

```json
{"status": "ok", "detectors": ["DDOS", "PORT_SCAN", "DNS_DGA", "C2", "EXFILTRATION"]}
```

### GET /models/{detector_type}

Returns model info including metrics for the specified detector.
