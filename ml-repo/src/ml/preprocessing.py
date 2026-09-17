import pandas as pd
import numpy as np

RAW_PATH = "data/raw/cicids2017/cicids2017_cleaned.csv"
PROCESSED_PATH = "data/processed/cicids2017_clean.parquet"

INVALID_IF_NEGATIVE = [
    "Flow Duration", "Flow Bytes/s", "Flow Packets/s",
    "Flow IAT Mean", "Flow IAT Max", "Flow IAT Min",
    "Fwd IAT Min", "Fwd Header Length", "Bwd Header Length",
]


def load_and_clean() -> pd.DataFrame:
    df = pd.read_csv(RAW_PATH)
    n_start = len(df)

    df = df.drop_duplicates()
    n_after_dedup = len(df)

    mask_invalid = (df[INVALID_IF_NEGATIVE] < 0).any(axis=1)
    df = df[~mask_invalid]
    n_after_negdrop = len(df)

    print(f"Start rows: {n_start}")
    print(f"After dedup: {n_after_dedup} (dropped {n_start - n_after_dedup})")
    print(f"After negative-drop: {n_after_negdrop} (dropped {n_after_dedup - n_after_negdrop})")
    print(f"Total dropped: {n_start - n_after_negdrop} ({(n_start - n_after_negdrop) / n_start * 100:.3f}%)")

    df = df.reset_index(drop=True)
    return df


if __name__ == "__main__":
    df = load_and_clean()
    df.to_parquet(PROCESSED_PATH, index=False)
    print(f"Saved to: {PROCESSED_PATH}")
    print(f"Final shape: {df.shape}")
    print(df["Attack Type"].value_counts())