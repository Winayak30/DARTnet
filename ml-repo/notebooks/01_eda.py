import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")  
import matplotlib.pyplot as plt

DATA_PATH = "data/raw/cicids2017/cicids2017_cleaned.csv"
OUT_DIR = "data/processed"

df = pd.read_csv(DATA_PATH)

print("=" * 60)
print("1. SHAPE & COLUMNS")
print("=" * 60)
print("Shape:", df.shape)
print("\nColumns:")
for c in df.columns:
    print(" -", c)

print("\n" + "=" * 60)
print("2. DATA TYPES")
print("=" * 60)
print(df.dtypes)

print("\n" + "=" * 60)
print("3. MISSING VALUES")
print("=" * 60)
missing = df.isna().sum()
print(missing[missing > 0] if missing.sum() > 0 else "No missing values found.")

print("\n" + "=" * 60)
print("4. DUPLICATE ROWS")
print("=" * 60)
dupe_count = df.duplicated().sum()
print(f"Fully duplicated rows: {dupe_count} ({dupe_count / len(df) * 100:.2f}%)")

print("\n" + "=" * 60)
print("5. LABEL DISTRIBUTION (Attack Type)")
print("=" * 60)
print(df["Attack Type"].value_counts())
print("\nAs percentage:")
print((df["Attack Type"].value_counts(normalize=True) * 100).round(3))

print("\n" + "=" * 60)
print("6. INFINITE / NEGATIVE VALUE CHECK (numeric columns)")
print("=" * 60)
numeric_cols = df.select_dtypes(include=[np.number]).columns
inf_counts = np.isinf(df[numeric_cols]).sum()
print("Columns with infinite values:")
print(inf_counts[inf_counts > 0] if inf_counts.sum() > 0 else "None found.")

neg_counts = (df[numeric_cols] < 0).sum()
print("\nColumns with negative values (may be invalid for counts/durations):")
print(neg_counts[neg_counts > 0] if neg_counts.sum() > 0 else "None found.")

print("\n" + "=" * 60)
print("7. CONSTANT / NEAR-CONSTANT COLUMNS")
print("=" * 60)
nunique = df.nunique()
constant_cols = nunique[nunique <= 1]
print("Fully constant columns (useless for the model):")
print(constant_cols if len(constant_cols) > 0 else "None found.")

print("\n" + "=" * 60)
print("8. DESTINATION PORT DISTRIBUTION (top 15)")
print("=" * 60)
print(df["Destination Port"].value_counts().head(15))

print("\n" + "=" * 60)
print("9. LEAKAGE-RISK COLUMN CHECK")
print("=" * 60)
risky_names = ["Flow ID", "Source IP", "Src IP", "Destination IP", "Dst IP", "Timestamp"]
present_risky = [c for c in risky_names if c in df.columns]
print("Identity/timestamp columns present in this file:", present_risky if present_risky else "None (already stripped)")
print("NOTE: 'Destination Port' IS present and is a known strong-but-risky feature —")
print("it can make the model memorize which port = which attack rather than learning traffic behavior.")
print("We will decide how to handle it explicitly in the feature-engineering phase, not silently.")


plt.figure(figsize=(10, 6))
df["Attack Type"].value_counts().plot(kind="bar")
plt.title("Attack Type Distribution")
plt.ylabel("Count")
plt.xticks(rotation=75, ha="right")
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/eda_label_distribution.png")
print(f"\nSaved plot: {OUT_DIR}/eda_label_distribution.png")

plt.figure(figsize=(8, 5))
df["Flow Duration"].clip(upper=df["Flow Duration"].quantile(0.99)).hist(bins=50)
plt.title("Flow Duration Distribution (99th percentile clipped)")
plt.xlabel("Flow Duration")
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/eda_flow_duration.png")
print(f"Saved plot: {OUT_DIR}/eda_flow_duration.png")

print("\nEDA script complete.")