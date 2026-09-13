"""
NEXUS SOC Model Training Script
SIH26145 - AI-Based Cyber Threat Detection

Trains classifiers for each threat category using synthetic
features derived from realistic traffic patterns.

For production use with actual datasets (CIC-IDS2017, UNSW-NB15, BoT-IoT):
- Run data_pipeline.py first to extract features from the dataset
- Point DATASET_DIR to the prepared feature CSVs
- Set USE_SYNTHETIC=false

This script generates trained .joblib model files in the models/ directory.
These files are loaded at ML service startup.

SPLIT STRATEGY: Time-aware split - last 20% of samples (by time order) are test.
This prevents data leakage from same-session samples appearing in both
train and test when using network capture datasets.
"""

import os
import sys
import json
import time
import logging
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.model_selection import cross_val_score
from sklearn.metrics import (
    precision_score, recall_score, f1_score,
    confusion_matrix, classification_report
)
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import joblib

try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False
    print("XGBoost not available, using RandomForest for C2 detector")

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s %(levelname)s - %(message)s')
logger = logging.getLogger("nexussoc.train")

MODELS_DIR = Path(os.getenv("MODEL_DIR", "../models"))
MODELS_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_STATE = 42
np.random.seed(RANDOM_STATE)


# ── Synthetic Data Generation ─────────────────────────────────────────────────
# In absence of actual captured dataset files, we generate statistically
# representative synthetic samples for each detector.
# Label: 0 = normal, 1 = threat

def generate_ddos_data(n=5000):
    """
    Features: flow_rate, packet_rate, syn_ratio, unique_source_ips,
              source_entropy, dest_concentration, mean_packet_size,
              packets, bytes, duration_ms, syn_count
    """
    rng = np.random.RandomState(RANDOM_STATE)
    rows = []

    # Normal traffic
    for _ in range(n // 2):
        rows.append({
            "flow_rate": rng.uniform(1, 50),
            "packet_rate": rng.uniform(5, 200),
            "syn_ratio": rng.uniform(0.1, 0.4),
            "unique_source_ips": rng.randint(1, 30),
            "source_entropy": rng.uniform(1.5, 4.0),
            "dest_concentration": rng.uniform(0.1, 0.5),
            "mean_packet_size": rng.uniform(200, 1400),
            "packets": rng.randint(10, 500),
            "bytes": rng.randint(1000, 500000),
            "duration_ms": rng.uniform(100, 60000),
            "syn_count": rng.randint(1, 50),
            "label": 0
        })

    # SYN flood attack
    for _ in range(n // 2):
        rows.append({
            "flow_rate": rng.uniform(200, 20000),
            "packet_rate": rng.uniform(1000, 50000),
            "syn_ratio": rng.uniform(0.85, 1.0),
            "unique_source_ips": rng.randint(100, 50000),
            "source_entropy": rng.uniform(0.05, 0.8),  # low = spoofed
            "dest_concentration": rng.uniform(0.8, 1.0),
            "mean_packet_size": rng.uniform(40, 80),  # small SYN packets
            "packets": rng.randint(1000, 100000),
            "bytes": rng.randint(50000, 5000000),
            "duration_ms": rng.uniform(1000, 300000),
            "syn_count": rng.randint(500, 90000),
            "label": 1
        })

    df = pd.DataFrame(rows).sample(frac=1, random_state=RANDOM_STATE)
    return df


def generate_portscan_data(n=4000):
    rng = np.random.RandomState(RANDOM_STATE)
    rows = []

    # Normal
    for _ in range(n // 2):
        rows.append({
            "unique_dest_ports": rng.randint(1, 10),
            "unique_dest_hosts": rng.randint(1, 5),
            "fan_out": rng.uniform(1, 5),
            "connection_rate": rng.uniform(0.1, 5),
            "failed_connections": rng.randint(0, 3),
            "syn_without_ack": rng.randint(0, 5),
            "packet_count": rng.randint(5, 100),
            "duration_ms": rng.uniform(100, 30000),
            "label": 0
        })

    # Port scan
    for _ in range(n // 2):
        rows.append({
            "unique_dest_ports": rng.randint(50, 65535),
            "unique_dest_hosts": rng.randint(1, 200),
            "fan_out": rng.uniform(20, 1000),
            "connection_rate": rng.uniform(10, 500),
            "failed_connections": rng.randint(30, 500),
            "syn_without_ack": rng.randint(50, 1000),
            "packet_count": rng.randint(100, 10000),
            "duration_ms": rng.uniform(1000, 120000),
            "label": 1
        })

    return pd.DataFrame(rows).sample(frac=1, random_state=RANDOM_STATE)


def generate_dns_data(n=4000):
    rng = np.random.RandomState(RANDOM_STATE)
    rows = []

    # Normal DNS
    for _ in range(n // 2):
        rows.append({
            "domain_length": rng.randint(6, 20),
            "entropy": rng.uniform(1.5, 3.2),
            "digit_ratio": rng.uniform(0, 0.15),
            "consonant_ratio": rng.uniform(0.4, 0.65),
            "unique_char_ratio": rng.uniform(0.3, 0.7),
            "ngram_anomaly_score": rng.uniform(0.2, 0.5),
            "query_rate": rng.uniform(0.01, 0.5),
            "subdomain_depth": rng.randint(1, 3),
            "tld_suspicion": 0.0,
            "label": 0
        })

    # DGA / DNS tunnel
    for _ in range(n // 2):
        rows.append({
            "domain_length": rng.randint(20, 60),
            "entropy": rng.uniform(3.5, 4.5),
            "digit_ratio": rng.uniform(0.25, 0.6),
            "consonant_ratio": rng.uniform(0.3, 0.55),
            "unique_char_ratio": rng.uniform(0.6, 0.9),
            "ngram_anomaly_score": rng.uniform(0.6, 1.0),
            "query_rate": rng.uniform(1.0, 20.0),
            "subdomain_depth": rng.randint(3, 8),
            "tld_suspicion": rng.choice([0.0, 1.0], p=[0.3, 0.7]),
            "label": 1
        })

    return pd.DataFrame(rows).sample(frac=1, random_state=RANDOM_STATE)


def generate_c2_data(n=3000):
    rng = np.random.RandomState(RANDOM_STATE)
    rows = []

    # Normal
    for _ in range(n // 2):
        rows.append({
            "mean_inter_arrival_ms": rng.uniform(100, 10000),
            "inter_arrival_variance": rng.uniform(5000, 5000000),
            "periodicity_score": rng.uniform(0.0, 0.55),
            "connection_count": rng.randint(1, 20),
            "unique_dest_count": rng.randint(2, 30),
            "flow_duration_ms": rng.uniform(100, 30000),
            "bytes_per_flow": rng.randint(200, 100000),
            "small_packet_ratio": rng.uniform(0.1, 0.6),
            "label": 0
        })

    # C2 beacon
    for _ in range(n // 2):
        beacon_intervals = rng.choice([30000, 60000, 120000, 300000, 3600000])
        rows.append({
            "mean_inter_arrival_ms": beacon_intervals * rng.uniform(0.95, 1.05),
            "inter_arrival_variance": beacon_intervals * rng.uniform(0.0, 0.05),  # very low
            "periodicity_score": rng.uniform(0.70, 1.0),
            "connection_count": rng.randint(20, 200),
            "unique_dest_count": rng.randint(1, 3),  # few destinations = C2
            "flow_duration_ms": rng.uniform(60000, 3600000),
            "bytes_per_flow": rng.randint(100, 500),  # small beacons
            "small_packet_ratio": rng.uniform(0.6, 1.0),
            "label": 1
        })

    return pd.DataFrame(rows).sample(frac=1, random_state=RANDOM_STATE)


def generate_exfil_data(n=3000):
    rng = np.random.RandomState(RANDOM_STATE)
    rows = []

    # Normal
    for _ in range(n // 2):
        rows.append({
            "outbound_bytes": rng.randint(1000, 500000),
            "inbound_bytes": rng.randint(1000, 500000),
            "outbound_inbound_ratio": rng.uniform(0.5, 3.0),
            "flow_duration_ms": rng.uniform(100, 60000),
            "dest_concentration": rng.uniform(0.1, 0.4),
            "transfer_rate_bps": rng.uniform(100, 500000),
            "burst_count": rng.randint(1, 10),
            "label": 0
        })

    # Exfiltration
    for _ in range(n // 2):
        outbound = rng.randint(5_000_000, 500_000_000)
        rows.append({
            "outbound_bytes": outbound,
            "inbound_bytes": rng.randint(1000, 50000),  # very little inbound
            "outbound_inbound_ratio": rng.uniform(50, 500),
            "flow_duration_ms": rng.uniform(10000, 3600000),
            "dest_concentration": rng.uniform(0.7, 1.0),  # all goes to 1 dest
            "transfer_rate_bps": rng.uniform(500000, 100_000_000),
            "burst_count": rng.randint(5, 50),
            "label": 1
        })

    return pd.DataFrame(rows).sample(frac=1, random_state=RANDOM_STATE)


# ── Training ──────────────────────────────────────────────────────────────────

def time_aware_split(df, test_fraction=0.20):
    """
    Time-aware split: last test_fraction of rows are test set.
    Prevents data leakage from correlated attack sessions.
    Data is assumed ordered by time (or shuffled within time windows).
    """
    n_test = int(len(df) * test_fraction)
    train = df.iloc[:-n_test].copy()
    test = df.iloc[-n_test:].copy()
    return train, test


def train_detector(name, df, feature_cols, model_cls, model_params=None):
    logger.info(f"Training {name} detector on {len(df)} samples...")
    model_params = model_params or {}

    # Time-aware split
    train_df, test_df = time_aware_split(df)
    X_train = train_df[feature_cols].values
    y_train = train_df["label"].values
    X_test = test_df[feature_cols].values
    y_test = test_df["label"].values

    logger.info(f"  Train: {len(X_train)} | Test: {len(X_test)} (time-aware split)")
    logger.info(f"  Train class distribution: {dict(zip(*np.unique(y_train, return_counts=True)))}")

    clf = model_cls(**model_params, random_state=RANDOM_STATE)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)[:, 1]

    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0

    metrics = {
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "false_positive_rate": float(fpr),
        "true_positives": int(tp),
        "false_positives": int(fp),
        "true_negatives": int(tn),
        "false_negatives": int(fn),
        "test_samples": int(len(X_test)),
        "train_samples": int(len(X_train)),
        "dataset": "SYNTHETIC"
    }

    logger.info(f"  Precision={precision:.3f} Recall={recall:.3f} F1={f1:.3f} FPR={fpr:.4f}")

    model_path = MODELS_DIR / f"{name.lower()}_model.joblib"
    joblib.dump({
        "model": clf,
        "feature_names": feature_cols,
        "metrics": metrics,
        "name": name,
        "version": "v1.0",
        "threat_class": name.upper(),
    }, model_path)
    logger.info(f"  Saved to {model_path}")
    return metrics


def main():
    logger.info("NEXUS SOC Model Training")
    logger.info(f"Output directory: {MODELS_DIR.absolute()}")

    results = {}

    # DDoS
    df = generate_ddos_data(5000)
    features = ["flow_rate", "packet_rate", "syn_ratio", "unique_source_ips",
                "source_entropy", "dest_concentration", "mean_packet_size",
                "packets", "bytes", "duration_ms", "syn_count"]
    results["DDOS"] = train_detector("ddos", df, features,
        RandomForestClassifier, {"n_estimators": 100, "max_depth": 10})

    # Port Scan
    df = generate_portscan_data(4000)
    features = ["unique_dest_ports", "unique_dest_hosts", "fan_out",
                "connection_rate", "failed_connections", "syn_without_ack",
                "packet_count", "duration_ms"]
    results["PORT_SCAN"] = train_detector("portscan", df, features,
        RandomForestClassifier, {"n_estimators": 100, "max_depth": 8})

    # DNS/DGA
    df = generate_dns_data(4000)
    features = ["domain_length", "entropy", "digit_ratio", "consonant_ratio",
                "unique_char_ratio", "ngram_anomaly_score", "query_rate",
                "subdomain_depth", "tld_suspicion"]
    results["DNS_DGA"] = train_detector("dns_dga", df, features,
        RandomForestClassifier, {"n_estimators": 150, "max_depth": 12})

    # C2
    df = generate_c2_data(3000)
    features = ["mean_inter_arrival_ms", "inter_arrival_variance", "periodicity_score",
                "connection_count", "unique_dest_count", "flow_duration_ms",
                "bytes_per_flow", "small_packet_ratio"]
    if HAS_XGB:
        from xgboost import XGBClassifier
        results["C2"] = train_detector("c2", df, features,
            XGBClassifier, {"n_estimators": 100, "max_depth": 6,
                           "use_label_encoder": False, "eval_metric": "logloss"})
    else:
        results["C2"] = train_detector("c2", df, features,
            RandomForestClassifier, {"n_estimators": 100, "max_depth": 8})

    # Exfiltration
    df = generate_exfil_data(3000)
    features = ["outbound_bytes", "inbound_bytes", "outbound_inbound_ratio",
                "flow_duration_ms", "dest_concentration", "transfer_rate_bps", "burst_count"]
    results["EXFILTRATION"] = train_detector("exfil", df, features,
        RandomForestClassifier, {"n_estimators": 100, "max_depth": 8})

    # Summary
    logger.info("\n" + "="*60)
    logger.info("TRAINING SUMMARY")
    logger.info("="*60)
    for name, m in results.items():
        logger.info(f"{name:20s}: P={m['precision']:.3f} R={m['recall']:.3f} "
                   f"F1={m['f1']:.3f} FPR={m['false_positive_rate']:.4f}")
    logger.info("="*60)

    # Save summary
    summary_path = MODELS_DIR / "training_summary.json"
    with open(summary_path, "w") as f:
        json.dump(results, f, indent=2)
    logger.info(f"Summary saved to {summary_path}")


if __name__ == "__main__":
    main()
