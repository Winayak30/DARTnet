#!/usr/bin/env python3
"""
NEXUS SOC - Seed database with model information.
Run after database is initialized.
"""

import json
import psycopg2
import os
import sys
from pathlib import Path

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "nexussoc")
DB_USER = os.getenv("DB_USER", "nexussoc")
DB_PASS = os.getenv("DB_PASS", "nexussoc_secret")

MODELS = [
    {
        "name": "ddos",
        "version": "v1.0",
        "model_type": "RandomForest",
        "threat_class": "SYN_FLOOD",
        "dataset": "SYNTHETIC",
        "features": ["flow_rate","packet_rate","syn_ratio","unique_source_ips","source_entropy","dest_concentration","mean_packet_size","packets","bytes","duration_ms","syn_count"],
        "metrics": {"precision": 0.967, "recall": 0.951, "f1": 0.959, "false_positive_rate": 0.032},
        "file_path": "models/ddos_model.joblib",
    },
    {
        "name": "portscan",
        "version": "v1.0",
        "model_type": "RandomForest",
        "threat_class": "PORT_SCAN",
        "dataset": "SYNTHETIC",
        "features": ["unique_dest_ports","unique_dest_hosts","fan_out","connection_rate","failed_connections","syn_without_ack","packet_count","duration_ms"],
        "metrics": {"precision": 0.981, "recall": 0.974, "f1": 0.977, "false_positive_rate": 0.019},
        "file_path": "models/portscan_model.joblib",
    },
    {
        "name": "dns_dga",
        "version": "v1.0",
        "model_type": "RandomForest",
        "threat_class": "DNS_TUNNEL",
        "dataset": "SYNTHETIC",
        "features": ["domain_length","entropy","digit_ratio","consonant_ratio","unique_char_ratio","ngram_anomaly_score","query_rate","subdomain_depth","tld_suspicion"],
        "metrics": {"precision": 0.943, "recall": 0.929, "f1": 0.936, "false_positive_rate": 0.057},
        "file_path": "models/dns_dga_model.joblib",
    },
    {
        "name": "c2",
        "version": "v1.0",
        "model_type": "XGBoost",
        "threat_class": "C2_BEACON",
        "dataset": "SYNTHETIC",
        "features": ["mean_inter_arrival_ms","inter_arrival_variance","periodicity_score","connection_count","unique_dest_count","flow_duration_ms","bytes_per_flow","small_packet_ratio"],
        "metrics": {"precision": 0.958, "recall": 0.946, "f1": 0.952, "false_positive_rate": 0.042},
        "file_path": "models/c2_model.joblib",
    },
    {
        "name": "exfil",
        "version": "v1.0",
        "model_type": "RandomForest",
        "threat_class": "DATA_EXFILTRATION",
        "dataset": "SYNTHETIC",
        "features": ["outbound_bytes","inbound_bytes","outbound_inbound_ratio","flow_duration_ms","dest_concentration","transfer_rate_bps","burst_count"],
        "metrics": {"precision": 0.934, "recall": 0.918, "f1": 0.926, "false_positive_rate": 0.066},
        "file_path": "models/exfil_model.joblib",
    },
]

def seed_models(conn):
    cur = conn.cursor()
    for m in MODELS:
        cur.execute("""
            INSERT INTO model_versions (name, version, model_type, threat_class, dataset, features_json, metrics_json, file_path, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, true)
            ON CONFLICT (name, version) DO UPDATE SET
                metrics_json = EXCLUDED.metrics_json,
                is_active = true
        """, (
            m["name"], m["version"], m["model_type"], m["threat_class"],
            m["dataset"],
            json.dumps(m["features"]),
            json.dumps(m["metrics"]),
            m["file_path"],
        ))
    conn.commit()
    cur.close()
    print(f"Seeded {len(MODELS)} model records")


def main():
    try:
        conn = psycopg2.connect(
            host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
            user=DB_USER, password=DB_PASS
        )
        seed_models(conn)
        conn.close()
        print("Seed complete")
    except Exception as e:
        print(f"Seed failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
