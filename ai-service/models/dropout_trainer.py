# models/dropout_trainer.py — binary dropout prediction model

import os
import pickle

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split


FEATURE_ORDER = [
    "days_since_last_checkin",
    "notification_open_rate_trend",
    "session_length_trend",
    "jitai_response_rate",
    "app_open_frequency_7d_trend",
]


def generate_synthetic_dataset(n=800, output_path="data/dropout_dataset.csv"):
    """Create a startup-friendly synthetic dataset for dropout-risk training."""
    np.random.seed(42)
    os.makedirs("data", exist_ok=True)

    rows = []
    for _ in range(n):
        days_since_last_checkin = np.clip(np.random.gamma(2.0, 2.0), 0, 21)
        notification_open_rate_trend = np.clip(np.random.normal(0.55, 0.2), 0, 1)
        session_length_trend = np.clip(np.random.normal(0.55, 0.2), 0, 1)
        jitai_response_rate = np.clip(np.random.normal(0.55, 0.25), 0, 1)
        app_open_frequency_7d_trend = np.clip(np.random.normal(0.55, 0.22), 0, 1)

        dropout_pressure = (
            (days_since_last_checkin / 21.0) * 0.45
            + (1 - notification_open_rate_trend) * 0.15
            + (1 - session_length_trend) * 0.15
            + (1 - jitai_response_rate) * 0.15
            + (1 - app_open_frequency_7d_trend) * 0.10
        )
        label = int(dropout_pressure > 0.55)

        rows.append({
            "days_since_last_checkin": days_since_last_checkin,
            "notification_open_rate_trend": notification_open_rate_trend,
            "session_length_trend": session_length_trend,
            "jitai_response_rate": jitai_response_rate,
            "app_open_frequency_7d_trend": app_open_frequency_7d_trend,
            "will_drop_out_in_7d": label,
        })

    df = pd.DataFrame(rows).sample(frac=1, random_state=42).reset_index(drop=True)
    df.to_csv(output_path, index=False)
    print(f"Synthetic dropout dataset saved: {output_path} ({len(df)} rows)")
    return df


def train(dataset_path="data/dropout_dataset.csv"):
    if not os.path.exists(dataset_path):
        print("Dropout dataset not found — generating synthetic dataset...")
        df = generate_synthetic_dataset(output_path=dataset_path)
    else:
        df = pd.read_csv(dataset_path)

    X = df[FEATURE_ORDER].fillna(df[FEATURE_ORDER].median())
    y = df["will_drop_out_in_7d"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    model = xgb.XGBClassifier(
        n_estimators=250,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        eval_metric="logloss",
        tree_method="hist",
        random_state=42,
    )
    model.fit(
        X_train,
        y_train,
        eval_set=[(X_test, y_test)],
        verbose=50,
    )

    preds = model.predict(X_test)
    acc = accuracy_score(y_test, preds)
    print(f"\nDropout accuracy: {acc:.4f}")
    print(classification_report(y_test, preds, target_names=["stay", "dropout"]))

    os.makedirs("models", exist_ok=True)
    with open("models/dropout_model.pkl", "wb") as f:
        pickle.dump(model, f)
    print("Saved: models/dropout_model.pkl")
    return model


if __name__ == "__main__":
    train()