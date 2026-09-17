import json
import time
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

try:
    from ml.features import FEATURE_COLUMNS, LABEL_COL, build_feature_matrix
except ImportError:
    from features import FEATURE_COLUMNS, LABEL_COL, build_feature_matrix  # type: ignore

PROCESSED_PATH = "data/processed/cicids2017_clean.parquet"
MODEL_DIR = "models"
BENIGN_LABEL = "Normal Traffic"
RANDOM_STATE = 42


def main():
    print("Loading data...")
    df = pd.read_parquet(PROCESSED_PATH)

    X = build_feature_matrix(df)
    y = df[LABEL_COL]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )
    print(f"Train: {len(X_train)} | Test: {len(X_test)}")

    print("\nTraining classifier...")
    t0 = time.time()
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=20,
        class_weight="balanced",
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )
    clf.fit(X_train, y_train)
    print(f"Done in {time.time() - t0:.1f}s")

    y_pred = clf.predict(X_test)
    report = classification_report(y_test, y_pred, digits=4, output_dict=True)
    print(classification_report(y_test, y_pred, digits=4))
    print("\nTraining anomaly detector")
    X_train_benign = X_train[y_train == BENIGN_LABEL]

    t0 = time.time()
    iso = IsolationForest(
        n_estimators=200,
        contamination=0.01,
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )
    iso.fit(X_train_benign)
    print(f"Done in {time.time() - t0:.1f}s")

    joblib.dump(clf, f"{MODEL_DIR}/threat_classifier.joblib")
    joblib.dump(iso, f"{MODEL_DIR}/anomaly_detector.joblib")

    meta = {
        "model_version": "ml-v1",
        "feature_columns": FEATURE_COLUMNS,
        "classes": sorted(y.unique().tolist()),
        "benign_label": BENIGN_LABEL,
        "trained_rows": len(X_train),
        "test_rows": len(X_test),
        "test_macro_f1": report["macro avg"]["f1-score"],
        "test_weighted_f1": report["weighted avg"]["f1-score"],
        "test_accuracy": report["accuracy"],
        "per_class_f1": {k: v["f1-score"] for k, v in report.items() if k in y.unique()},
        "sklearn_random_state": RANDOM_STATE,
    }
    with open(f"{MODEL_DIR}/model_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\nSaved models to {MODEL_DIR}/")


if __name__ == "__main__":
    main()