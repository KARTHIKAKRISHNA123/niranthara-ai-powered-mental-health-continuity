# models/model_trainer.py — XGBoost training with CPU optimization per Build Guide §20
# Optimized for i5-13450HX (6 P-cores + 4 E-cores)

# ── Threading limits — MUST be first, before any ML import ──────────────
import os
os.environ["OMP_NUM_THREADS"]      = "6"
os.environ["MKL_NUM_THREADS"]      = "6"
os.environ["OPENBLAS_NUM_THREADS"]  = "6"
os.environ["VECLIB_MAXIMUM_THREADS"]= "6"
os.environ["NUMEXPR_NUM_THREADS"]   = "6"

import xgboost as xgb
import pandas as pd
import numpy as np
import pickle
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    roc_auc_score, precision_recall_fscore_support
)

# ── 14-feature vector matching the predict.py router ────────────────────
FEATURE_ORDER = [
    "mood_score_avg_7d", "sleep_hours_avg_7d", "steps_deviation_score",
    "anxiety_level_avg_7d", "cycle_vulnerability_score", "gps_entropy_deviation_score",
    "journal_sentiment_score", "emotion_distress_score", "crisis_probability",
    "app_engagement_score", "missed_checkins_count", "mood_sentiment_divergence",
    "screen_time_night_ratio", "social_connectivity_score",
]

# P-core count for i5-13450HX — keeps heavy ML on the 6 fast cores
P_CORE_COUNT = 6


# ═══════════════════════════════════════════════════════════════════════
# SYNTHETIC DATA GENERATOR (fallback when no real data available)
# ═══════════════════════════════════════════════════════════════════════
def generate_synthetic_dataset(n=600, output_path="data/phq9_dataset.csv"):
    """
    Generate synthetic PHQ-9 aligned training dataset.
    4 classes: 0=low, 1=moderate, 2=high, 3=crisis
    Use ONLY as fallback — real data always preferred.
    """
    np.random.seed(42)
    os.makedirs("data", exist_ok=True)

    rows = []
    for cls in range(4):
        n_cls = n // 4
        base_mood      = [4.5, 3.2, 2.0, 1.2][cls]
        base_sleep     = [7.5, 6.5, 5.5, 4.5][cls]
        base_anxiety   = [2.0, 5.0, 7.5, 9.0][cls]
        base_steps_dev = [0.1, 0.3, 0.55, 0.8][cls]
        base_crisis    = [0.02, 0.08, 0.25, 0.75][cls]
        base_sentiment = [0.15, 0.4, 0.65, 0.85][cls]
        base_vuln      = [0.15, 0.35, 0.65, 0.85][cls]

        for _ in range(n_cls):
            row = {
                "mood_score_avg_7d":           np.clip(np.random.normal(base_mood, 0.5), 1, 5),
                "sleep_hours_avg_7d":          np.clip(np.random.normal(base_sleep, 1.0), 2, 12),
                "steps_deviation_score":       np.clip(np.random.normal(base_steps_dev, 0.12), 0, 1),
                "anxiety_level_avg_7d":        np.clip(np.random.normal(base_anxiety, 1.5), 1, 10),
                "cycle_vulnerability_score":   np.clip(np.random.normal(base_vuln, 0.15), 0, 1),
                "gps_entropy_deviation_score": np.clip(np.random.normal(base_steps_dev, 0.12), 0, 1),
                "journal_sentiment_score":     np.clip(np.random.normal(base_sentiment, 0.12), 0, 1),
                "emotion_distress_score":      np.clip(np.random.normal(base_sentiment * 0.9, 0.12), 0, 1),
                "crisis_probability":          np.clip(np.random.normal(base_crisis, 0.08), 0, 1),
                "app_engagement_score":        np.clip(np.random.normal(1 - base_steps_dev, 0.1), 0, 1),
                "missed_checkins_count":       float(np.random.poisson([0, 1, 2.5, 5][cls])),
                "mood_sentiment_divergence":   np.clip(np.random.normal([0.05, 0.15, 0.3, 0.45][cls], 0.1), 0, 1),
                "screen_time_night_ratio":     np.clip(np.random.normal([0.05, 0.15, 0.3, 0.5][cls], 0.08), 0, 1),
                "social_connectivity_score":   np.clip(np.random.normal(1 - base_steps_dev * 0.8, 0.1), 0, 1),
                "depression_severity":         cls
            }
            rows.append(row)

    df = pd.DataFrame(rows).sample(frac=1, random_state=42).reset_index(drop=True)
    df.to_csv(output_path, index=False)
    print(f"Synthetic dataset saved: {output_path} ({len(df)} rows)")
    return df


# ═══════════════════════════════════════════════════════════════════════
# REAL DATA LOADER — loads all available datasets from data/ directory
# ═══════════════════════════════════════════════════════════════════════
def load_real_datasets():
    """
    Scans data/ for real-world CSV datasets and merges them with the
    synthetic baseline. Expected CSV format: must have FEATURE_ORDER
    columns + 'depression_severity' label (0-3).

    Supports:
     - data/phq9_dataset.csv          (synthetic baseline — always present)
     - data/deptweet_features.csv     (DEPTWEET — NLP-derived features)
     - data/mental_health_status.csv  (Kaggle Mental Health Status dataset)
     - data/phq9_students.csv         (PHQ-9 student survey data)
     - Any CSV in data/ matching the schema
    """
    all_frames = []

    # Always include synthetic as a baseline
    synthetic_path = "data/phq9_dataset.csv"
    if os.path.exists(synthetic_path):
        df_syn = pd.read_csv(synthetic_path)
        if "depression_severity" in df_syn.columns:
            all_frames.append(("synthetic", df_syn))
            print(f"  ✓ Loaded synthetic baseline: {len(df_syn)} rows")

    # Scan for additional real datasets
    real_files = [
        "data/deptweet_features.csv",
        "data/mental_health_status.csv",
        "data/phq9_students.csv",
        "data/clef_erisk.csv",
        "data/reddit_depression.csv",
    ]

    for fpath in real_files:
        if os.path.exists(fpath):
            try:
                df = pd.read_csv(fpath)
                if "depression_severity" in df.columns:
                    all_frames.append((os.path.basename(fpath), df))
                    print(f"  ✓ Loaded real dataset: {fpath} ({len(df)} rows)")
                else:
                    print(f"  ⚠ Skipped {fpath} — no 'depression_severity' column")
            except Exception as e:
                print(f"  ✗ Error loading {fpath}: {e}")

    # Also scan for any other CSVs in data/ that match schema
    for f in os.listdir("data"):
        fpath = f"data/{f}"
        if f.endswith(".csv") and fpath not in [synthetic_path] + real_files:
            try:
                df = pd.read_csv(fpath)
                if "depression_severity" in df.columns and all(
                    col in df.columns for col in FEATURE_ORDER[:5]
                ):
                    all_frames.append((f, df))
                    print(f"  ✓ Auto-detected: {f} ({len(df)} rows)")
            except Exception:
                pass

    if not all_frames:
        print("  No datasets found — generating synthetic...")
        df = generate_synthetic_dataset()
        return df

    # Merge all DataFrames
    merged = pd.concat([df for _, df in all_frames], ignore_index=True)
    print(f"\n  Total training data: {len(merged)} rows from {len(all_frames)} source(s)")
    return merged


# ═══════════════════════════════════════════════════════════════════════
# MAIN TRAINING — i5-13450HX optimized, with cross-validation
# ═══════════════════════════════════════════════════════════════════════
def train(dataset_path="data/phq9_dataset.csv", use_cross_validation=True):
    """
    Train XGBoost 14-feature risk classifier.

    CPU optimization:
      - n_jobs=6     → matches P-core count on i5-13450HX
      - tree_method='hist' → fastest CPU algorithm
      - device='cpu'  → keeps GPU free for Ollama/Gemma 4B

    Validation:
      - 5-fold stratified cross-validation (when enabled)
      - Per-class precision/recall/F1
      - Confusion matrix
      - Crisis class recall (most critical metric)
    """
    print("=" * 60)
    print("Niranthara XGBoost Risk Model Training")
    print(f"CPU: i5-13450HX — using {P_CORE_COUNT} P-cores (n_jobs={P_CORE_COUNT})")
    print("=" * 60)

    # Load data — prefer real, fall back to synthetic
    print("\n📂 Loading datasets...")
    if os.path.exists(dataset_path):
        df = load_real_datasets()
    else:
        print("  Dataset not found — generating synthetic dataset...")
        df = generate_synthetic_dataset(output_path=dataset_path)

    # Prepare features and labels
    available_features = [f for f in FEATURE_ORDER if f in df.columns]
    missing_features = [f for f in FEATURE_ORDER if f not in df.columns]
    if missing_features:
        print(f"\n  ⚠ Missing features (will use median fill): {missing_features}")
        for mf in missing_features:
            df[mf] = 0.5  # Neutral default

    X = df[FEATURE_ORDER].fillna(df[FEATURE_ORDER].median())
    y = df["depression_severity"].astype(int)

    # Validate class distribution
    print(f"\n📊 Class distribution:")
    for cls_name, cls_idx in [("low", 0), ("moderate", 1), ("high", 2), ("crisis", 3)]:
        count = (y == cls_idx).sum()
        pct = count / len(y) * 100
        print(f"  {cls_name:>10}: {count:5d} ({pct:.1f}%)")

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    # ── XGBoost configuration — i5-13450HX optimized ──────────────────
    model = xgb.XGBClassifier(
        # Performance
        n_estimators=1000,         # More trees → better generalization
        max_depth=6,               # Balanced depth
        learning_rate=0.05,        # Slow learning with many trees
        subsample=0.8,             # Row sampling
        colsample_bytree=0.8,      # Feature sampling

        # i5-13450HX optimization
        n_jobs=P_CORE_COUNT,       # Pin to 6 P-cores, E-cores free for backend/Chrome
        tree_method="hist",        # Fastest CPU algorithm (histogram-based)
        device="cpu",              # Keep GPU free for Ollama/Gemma 4B

        # Training config
        eval_metric="mlogloss",
        early_stopping_rounds=50,  # More patience with 1000 trees
        random_state=42,
        num_class=4,

        # Regularization (prevents overfitting on synthetic data)
        reg_alpha=0.1,             # L1 regularization
        reg_lambda=1.0,            # L2 regularization
        min_child_weight=3,        # Minimum samples per leaf
        gamma=0.1,                 # Minimum loss reduction for split
    )

    print(f"\n🚀 Training XGBoost (n_jobs={P_CORE_COUNT}, tree_method=hist, device=cpu)...")
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=100
    )

    # ── Evaluation ────────────────────────────────────────────────────
    preds = model.predict(X_test)
    acc   = accuracy_score(y_test, preds)

    print(f"\n{'=' * 60}")
    print(f"RESULTS — Hold-out Test Set")
    print(f"{'=' * 60}")
    print(f"Accuracy: {acc:.4f} ({acc * 100:.2f}%)")
    print(f"\nClassification Report:")
    print(classification_report(y_test, preds, target_names=["low", "moderate", "high", "crisis"]))

    # Confusion matrix
    cm = confusion_matrix(y_test, preds)
    print("Confusion Matrix:")
    print(f"{'':>12} {'pred_low':>10} {'pred_mod':>10} {'pred_high':>10} {'pred_crisis':>12}")
    for i, label in enumerate(["low", "moderate", "high", "crisis"]):
        row = "  ".join(f"{v:>10}" for v in cm[i])
        print(f"  {label:>10} {row}")

    # Crisis recall — THE most critical metric
    prec, rec, f1, sup = precision_recall_fscore_support(y_test, preds, labels=[3])
    print(f"\n⚠️  Crisis class recall: {rec[0]:.4f} (target ≥ 0.95)")
    print(f"   Crisis class precision: {prec[0]:.4f}")
    print(f"   Crisis class F1: {f1[0]:.4f}")

    # ── 5-fold cross-validation (optional but recommended) ────────────
    if use_cross_validation:
        print(f"\n📊 5-Fold Stratified Cross-Validation...")
        cv_model = xgb.XGBClassifier(
            n_estimators=300, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            n_jobs=P_CORE_COUNT, tree_method="hist", device="cpu",
            eval_metric="mlogloss", random_state=42, num_class=4,
            reg_alpha=0.1, reg_lambda=1.0, min_child_weight=3, gamma=0.1,
        )
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_scores = cross_val_score(cv_model, X, y, cv=skf, scoring="accuracy", n_jobs=P_CORE_COUNT)
        print(f"  CV Accuracy: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
        print(f"  Per-fold:    {[f'{s:.4f}' for s in cv_scores]}")

        # ROC-AUC (One-vs-Rest)
        try:
            proba = model.predict_proba(X_test)
            roc = roc_auc_score(y_test, proba, multi_class="ovr", average="weighted")
            print(f"  ROC-AUC (weighted OVR): {roc:.4f}")
        except Exception:
            print("  ROC-AUC: could not compute (class distribution issue)")

    # ── Save model ────────────────────────────────────────────────────
    os.makedirs("models", exist_ok=True)
    with open("models/risk_model.pkl", "wb") as f:
        pickle.dump(model, f)
    print(f"\n✅ Model saved: models/risk_model.pkl")

    # Save training metadata
    metadata = {
        "accuracy": round(acc, 4),
        "crisis_recall": round(float(rec[0]), 4),
        "total_samples": len(df),
        "features": FEATURE_ORDER,
        "n_estimators": model.get_params()["n_estimators"],
        "best_iteration": model.best_iteration if hasattr(model, "best_iteration") else None,
        "cpu_threads": P_CORE_COUNT,
        "tree_method": "hist",
        "trained_at": pd.Timestamp.now().isoformat(),
    }
    with open("models/training_metadata.json", "w") as f:
        import json
        json.dump(metadata, f, indent=2)
    print(f"   Metadata saved: models/training_metadata.json")

    return model


if __name__ == "__main__":
    train()
