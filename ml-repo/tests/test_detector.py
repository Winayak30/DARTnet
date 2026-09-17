import json
import sys
sys.path.insert(0, "src/ml")

import pandas as pd
from detector import ThreatDetector

PROCESSED_PATH = "data/processed/cicids2017_clean.parquet"

SCENARIOS = [
    ("Normal Traffic", "Normal Traffic"),
    ("DDoS", "DDoS"),
    ("Port Scanning", "Port Scanning"),
    ("Bots", "Botnet / Beaconing"),
    ("Brute Force", "Brute Force"),
    ("Web Attacks", "Web Application Attack"),
]


def run_scenario(detector, df, attack_type, label):
    subset = df[df["Attack Type"] == attack_type]
    row = subset.drop(columns=["Attack Type"]).iloc[0].to_dict()
    result = detector.predict(row)

    print(f"\n{'-' * 60}")
    print(f"SCENARIO: {label}")
    print(f"{'-' * 60}")
    print(json.dumps(result, indent=2))


def main():
    df = pd.read_parquet(PROCESSED_PATH)
    detector = ThreatDetector()

    for attack_type, label in SCENARIOS:
        run_scenario(detector, df, attack_type, label)


if __name__ == "__main__":
    main()