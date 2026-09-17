import time
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix

from features import FEATURE_COLUMNS, LABEL_COL, build_feature_matrix

PROCESSED_PATH = "data/processed/cicids2017_clean.parquet"
MODEL_DIR = "models"
BENIGN_LABEL = "Normal Traffic"
RANDOM_STATE = 42


def main():
    df = pd.read_parquet(PROCESSED_PATH)
    X = build_feature_matrix(df)
    y = df[LABEL_COL]

    _, X_test, _, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    clf = joblib.load(f"{MODEL_DIR}/threat_classifier.joblib")
    iso = joblib.load(f"{MODEL_DIR}/anomaly_detector.joblib")

    y_pred = clf.predict(X_test)

    print(classification_report(y_test, y_pred, digits=4))

    labels = sorted(y.unique())
    cm = confusion_matrix(y_test, y_pred, labels=labels)
    cm_df = pd.DataFrame(cm, index=labels, columns=labels)
    cm_df.to_csv("data/processed/confusion_matrix.csv")
    print("Confusion matrix saved.")

    y_test_binary = (y_test != BENIGN_LABEL).astype(int)
    y_pred_binary = (pd.Series(y_pred, index=y_test.index) != BENIGN_LABEL).astype(int)

    fp = ((y_test_binary == 0) & (y_pred_binary == 1)).sum()
    fn = ((y_test_binary == 1) & (y_pred_binary == 0)).sum()
    tn = ((y_test_binary == 0) & (y_pred_binary == 0)).sum()
    tp = ((y_test_binary == 1) & (y_pred_binary == 1)).sum()

    print(f"\nFalse Positive Rate: {fp / (fp + tn):.4%}")
    print(f"False Negative Rate: {fn / (fn + tp):.4%}")
    print(f"TP={tp} TN={tn} FP={fp} FN={fn}")

    sample = X_test.iloc[[0]]
    n_runs = 200
    t0 = time.time()
    for _ in range(n_runs):
        clf.predict(sample)
        iso.decision_function(sample)
    elapsed = time.time() - t0
    print(f"\nAvg latency per flow: {elapsed / n_runs * 1000:.2f} ms")


if __name__ == "__main__":
    main()