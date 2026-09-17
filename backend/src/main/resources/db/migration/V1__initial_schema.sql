-- DARTNet Database Schema
-- V1: Initial Schema

-- Traffic sources (PCAP files, simulated streams, live taps)
CREATE TABLE traffic_sources (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- PCAP, SIMULATED, LIVE
    file_path TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Replay sessions
CREATE TABLE replay_sessions (
    id BIGSERIAL PRIMARY KEY,
    traffic_source_id BIGINT REFERENCES traffic_sources(id),
    scenario VARCHAR(100),
    speed_multiplier DOUBLE PRECISION DEFAULT 1.0,
    status VARCHAR(50) DEFAULT 'STOPPED', -- STOPPED, RUNNING, PAUSED, COMPLETED, ERROR
    started_at TIMESTAMP WITH TIME ZONE,
    paused_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    flows_processed BIGINT DEFAULT 0,
    packets_processed BIGINT DEFAULT 0,
    bytes_processed BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Network flows (reconstructed from packets)
CREATE TABLE network_flows (
    id VARCHAR(36) PRIMARY KEY,   -- FL-XXXXXXXX UUID-like
    replay_session_id BIGINT REFERENCES replay_sessions(id),
    flow_start TIMESTAMP WITH TIME ZONE NOT NULL,
    flow_end TIMESTAMP WITH TIME ZONE,
    source_ip VARCHAR(45) NOT NULL,
    destination_ip VARCHAR(45) NOT NULL,
    source_port INTEGER,
    destination_port INTEGER,
    protocol VARCHAR(20) NOT NULL,
    packet_count BIGINT DEFAULT 0,
    byte_count BIGINT DEFAULT 0,
    duration_ms BIGINT DEFAULT 0,
    threat_score DOUBLE PRECISION DEFAULT 0.0,
    threat_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, CLOSED, TIMEOUT
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_network_flows_source_ip ON network_flows(source_ip);
CREATE INDEX idx_network_flows_dest_ip ON network_flows(destination_ip);
CREATE INDEX idx_network_flows_flow_start ON network_flows(flow_start);
CREATE INDEX idx_network_flows_threat_type ON network_flows(threat_type);
CREATE INDEX idx_network_flows_replay ON network_flows(replay_session_id);

-- Extracted flow features
CREATE TABLE flow_features (
    id BIGSERIAL PRIMARY KEY,
    flow_id VARCHAR(36) REFERENCES network_flows(id),
    feature_name VARCHAR(100) NOT NULL,
    numeric_value DOUBLE PRECISION,
    string_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_flow_features_flow_id ON flow_features(flow_id);

-- Model versions
CREATE TABLE model_versions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL,
    model_type VARCHAR(100) NOT NULL,
    threat_class VARCHAR(100) NOT NULL,
    dataset TEXT,
    features_json JSONB,
    metrics_json JSONB,
    file_path TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, version)
);

-- Detection results from ML service
CREATE TABLE detection_results (
    id BIGSERIAL PRIMARY KEY,
    flow_id VARCHAR(36) REFERENCES network_flows(id),
    model_version_id BIGINT REFERENCES model_versions(id),
    threat_class VARCHAR(100) NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    is_threat BOOLEAN NOT NULL,
    raw_output JSONB,
    detection_latency_ms BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_detection_results_flow_id ON detection_results(flow_id);
CREATE INDEX idx_detection_results_threat_class ON detection_results(threat_class);

-- Canonical threat alerts
CREATE TABLE threat_alerts (
    id VARCHAR(20) PRIMARY KEY, -- ALT-000001 format
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    flow_id VARCHAR(36) REFERENCES network_flows(id),
    threat_class VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- CRITICAL, HIGH, MEDIUM, LOW
    confidence DOUBLE PRECISION NOT NULL,
    source_ip VARCHAR(45),
    destination_ip VARCHAR(45),
    protocol VARCHAR(20),
    detection_latency_ms BIGINT,
    model_version VARCHAR(100),
    status VARCHAR(50) DEFAULT 'NEW', -- NEW, ACKNOWLEDGED, INVESTIGATING, RESOLVED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_threat_alerts_timestamp ON threat_alerts(timestamp DESC);
CREATE INDEX idx_threat_alerts_severity ON threat_alerts(severity);
CREATE INDEX idx_threat_alerts_threat_class ON threat_alerts(threat_class);
CREATE INDEX idx_threat_alerts_source_ip ON threat_alerts(source_ip);
CREATE INDEX idx_threat_alerts_status ON threat_alerts(status);

-- Alert evidence (features that triggered the alert)
CREATE TABLE alert_evidence (
    id BIGSERIAL PRIMARY KEY,
    alert_id VARCHAR(20) REFERENCES threat_alerts(id),
    feature_name VARCHAR(100) NOT NULL,
    observed_value TEXT NOT NULL,
    threshold TEXT,
    interpretation TEXT
);

CREATE INDEX idx_alert_evidence_alert_id ON alert_evidence(alert_id);

-- Related alerts (same source, destination, flow cluster)
CREATE TABLE related_alerts (
    id BIGSERIAL PRIMARY KEY,
    alert_id VARCHAR(20) REFERENCES threat_alerts(id),
    related_alert_id VARCHAR(20) REFERENCES threat_alerts(id),
    relation_type VARCHAR(50), -- SAME_SOURCE, SAME_DEST, SAME_FLOW_CLUSTER, SAME_THREAT_TYPE
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System metrics (time series for dashboard)
CREATE TABLE system_metrics (
    id BIGSERIAL PRIMARY KEY,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    flows_per_sec DOUBLE PRECISION,
    packets_per_sec DOUBLE PRECISION,
    throughput_mbps DOUBLE PRECISION,
    active_flows BIGINT,
    threats_detected BIGINT,
    critical_alerts BIGINT,
    latency_p50_ms DOUBLE PRECISION,
    latency_p95_ms DOUBLE PRECISION,
    queue_depth INTEGER,
    dropped_events BIGINT DEFAULT 0,
    cpu_percent DOUBLE PRECISION,
    memory_percent DOUBLE PRECISION,
    disk_percent DOUBLE PRECISION,
    alert_queue_size INTEGER,
    replay_status VARCHAR(50)
);

CREATE INDEX idx_system_metrics_recorded_at ON system_metrics(recorded_at DESC);

-- Seed default traffic sources / scenarios
INSERT INTO traffic_sources (name, source_type, file_path, description) VALUES
    ('DDoS SYN Flood Scenario', 'PCAP', 'data/pcap/ddos_syn_flood.pcap', 'Simulated SYN flood attack for demonstration'),
    ('Port Scan Scenario', 'PCAP', 'data/pcap/port_scan.pcap', 'Nmap-style port scan reconnaissance'),
    ('DNS Tunneling / DGA Scenario', 'PCAP', 'data/pcap/dns_tunnel.pcap', 'DNS tunneling and DGA domain queries'),
    ('C2 Beaconing Scenario', 'PCAP', 'data/pcap/c2_beacon.pcap', 'Periodic C2 beaconing traffic'),
    ('Mixed Threat Scenario', 'SIMULATED', NULL, 'Mixed realistic traffic with multiple threat types');
