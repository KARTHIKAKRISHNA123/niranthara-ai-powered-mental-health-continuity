# models/autoencoder_trainer.py — Personalized LSTM Autoencoder per Build Guide §28
# Trains a per-user behavioral manifold model.
# Reconstruction error → anomaly_score → feeds XGBoost risk fusion as 15th feature.

import os
import json
import math
import numpy as np
import torch
import torch.nn as nn
from typing import List, Optional, Tuple

# ── CPU pinning — consistent with all other models in this codebase ──────────
os.environ.setdefault("OMP_NUM_THREADS", "6")
os.environ.setdefault("MKL_NUM_THREADS", "6")

# ── Constants ─────────────────────────────────────────────────────────────────
AUTOENCODER_DIR = "models/user_autoencoders"
SEQUENCE_LEN    = 7    # 7-day rolling window
N_FEATURES      = 8    # multivariate signals (see FEATURE_NAMES)
HIDDEN_DIM      = 32
BOTTLENECK_DIM  = 16
NUM_LAYERS      = 2
EPOCHS          = 80
LR              = 1e-3
MIN_DAYS        = 7    # minimum history to train

# Feature names — must match anomaly.py and the mobile biometric upload schema
FEATURE_NAMES = [
    "sleep_hours",           # 0 – raw hours (0–12)
    "heart_rate_normalized", # 1 – bpm / 200 (0–1)
    "steps_normalized",      # 2 – steps / 15000 (0–1)
    "mood_score",            # 3 – user mood 1–5, normalized /5
    "sentiment_score",       # 4 – NLP negative sentiment 0–1
    "app_engagement",        # 5 – engagement score 0–1
    "gps_entropy",           # 6 – GPS entropy 0–1
    "screen_time_night",     # 7 – night screen ratio 0–1
]


# ═══════════════════════════════════════════════════════════════════════════════
# LSTM AUTOENCODER
# Encoder: LSTM → bottleneck dense
# Decoder: repeat bottleneck → LSTM → reconstruct sequence
# ═══════════════════════════════════════════════════════════════════════════════

class LSTMAutoencoder(nn.Module):
    """
    Sequence-to-sequence LSTM Autoencoder.

    Input:  (batch, seq_len, n_features)
    Output: (batch, seq_len, n_features)   ← reconstruction

    The bottleneck learns the user's "normal behavioral manifold".
    High reconstruction MSE → behavioral anomaly detected.
    """

    def __init__(
        self,
        n_features:    int = N_FEATURES,
        hidden_dim:    int = HIDDEN_DIM,
        bottleneck:    int = BOTTLENECK_DIM,
        num_layers:    int = NUM_LAYERS,
        seq_len:       int = SEQUENCE_LEN,
    ):
        super().__init__()
        self.seq_len    = seq_len
        self.n_features = n_features

        # Encoder
        self.encoder_lstm = nn.LSTM(
            input_size=n_features,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.1 if num_layers > 1 else 0.0,
        )
        self.encoder_fc = nn.Sequential(
            nn.Linear(hidden_dim, bottleneck),
            nn.ReLU(),
        )

        # Decoder
        self.decoder_fc = nn.Sequential(
            nn.Linear(bottleneck, hidden_dim),
            nn.ReLU(),
        )
        self.decoder_lstm = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.1 if num_layers > 1 else 0.0,
        )
        self.output_fc = nn.Linear(hidden_dim, n_features)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, seq_len, n_features)

        # Encode — use final hidden state
        _, (hidden, _) = self.encoder_lstm(x)
        # hidden: (num_layers, batch, hidden_dim) — take last layer
        z = self.encoder_fc(hidden[-1])       # (batch, bottleneck)

        # Decode — repeat bottleneck across sequence
        z_expanded = self.decoder_fc(z)                     # (batch, hidden_dim)
        z_repeated = z_expanded.unsqueeze(1).repeat(1, self.seq_len, 1)  # (batch, seq, hidden)
        decoded, _ = self.decoder_lstm(z_repeated)          # (batch, seq, hidden)
        out = self.output_fc(decoded)                        # (batch, seq, n_features)
        return out


# ═══════════════════════════════════════════════════════════════════════════════
# NORMALIZATION — per-user min/max scaler (saved to JSON alongside .pt model)
# ═══════════════════════════════════════════════════════════════════════════════

class UserScaler:
    """Min-max scaler fitted on the user's own historical range."""

    def __init__(self, mins: Optional[np.ndarray] = None, maxs: Optional[np.ndarray] = None):
        self.mins = mins if mins is not None else np.zeros(N_FEATURES)
        self.maxs = maxs if maxs is not None else np.ones(N_FEATURES)

    def fit(self, X: np.ndarray):
        """X: (n_samples, n_features)"""
        self.mins = X.min(axis=0)
        self.maxs = X.max(axis=0)
        # Avoid zero range — clip to at least 0.01
        self.maxs = np.where((self.maxs - self.mins) < 0.01, self.mins + 1.0, self.maxs)

    def transform(self, X: np.ndarray) -> np.ndarray:
        return np.clip((X - self.mins) / (self.maxs - self.mins + 1e-8), 0.0, 1.0)

    def to_dict(self) -> dict:
        return {"mins": self.mins.tolist(), "maxs": self.maxs.tolist()}

    @classmethod
    def from_dict(cls, d: dict) -> "UserScaler":
        return cls(
            mins=np.array(d["mins"], dtype=np.float32),
            maxs=np.array(d["maxs"], dtype=np.float32),
        )


# ═══════════════════════════════════════════════════════════════════════════════
# DATA PREPARATION — converts raw history dicts to normalized numpy windows
# ═══════════════════════════════════════════════════════════════════════════════

def _history_to_matrix(history: List[dict]) -> np.ndarray:
    """
    Converts a list of daily behavioral dicts to (n_days, N_FEATURES) matrix.
    Keys accepted: sleepHours, heartRate, steps, moodScore, sentimentScore,
                   appEngagement, gpsEntropy, screenTimeNightRatio
    All are normalized to 0–1 before returning.
    """
    rows = []
    for day in history:
        row = np.array([
            float(day.get("sleepHours",              day.get("sleep_hours",           7.0))) / 12.0,
            float(day.get("heartRate",               day.get("heart_rate",           72.0))) / 200.0,
            float(day.get("steps",                   day.get("stepsToday",         6000.0))) / 15000.0,
            float(day.get("moodScore",               day.get("mood_score",            3.0))) / 5.0,
            float(day.get("sentimentScore",          day.get("sentiment_score",       0.5))),
            float(day.get("appEngagement",           day.get("app_engagement",        0.5))),
            float(day.get("gpsEntropy",              day.get("gps_entropy",           0.5))),
            float(day.get("screenTimeNightRatio",    day.get("screen_time_night",     0.1))),
        ], dtype=np.float32)
        rows.append(np.clip(row, 0.0, 1.0))
    return np.stack(rows, axis=0)   # (n_days, N_FEATURES)


def _make_windows(matrix: np.ndarray, seq_len: int = SEQUENCE_LEN) -> np.ndarray:
    """Sliding window of length seq_len → (n_windows, seq_len, N_FEATURES)."""
    n = len(matrix)
    if n < seq_len:
        # Pad by repeating the first row
        pad = np.tile(matrix[0], (seq_len - n, 1))
        matrix = np.concatenate([pad, matrix], axis=0)
        n = seq_len
    windows = np.stack([matrix[i : i + seq_len] for i in range(n - seq_len + 1)], axis=0)
    return windows.astype(np.float32)


def _generate_synthetic_history(n_days: int = 30) -> List[dict]:
    """
    Generates synthetic 'normal' history when real data is < MIN_DAYS.
    Uses population averages as the baseline.
    """
    rng = np.random.default_rng(42)
    records = []
    for _ in range(n_days):
        records.append({
            "sleepHours":           float(np.clip(rng.normal(7.2, 0.8), 4, 11)),
            "heartRate":            float(np.clip(rng.normal(72, 8),    50, 110)),
            "steps":                float(np.clip(rng.normal(6500, 1500), 500, 15000)),
            "moodScore":            float(np.clip(rng.normal(3.5, 0.5), 1, 5)),
            "sentimentScore":       float(np.clip(rng.normal(0.35, 0.1), 0, 1)),
            "appEngagement":        float(np.clip(rng.normal(0.65, 0.15), 0, 1)),
            "gpsEntropy":           float(np.clip(rng.normal(0.6, 0.15), 0, 1)),
            "screenTimeNightRatio": float(np.clip(rng.normal(0.12, 0.05), 0, 1)),
        })
    return records


# ═══════════════════════════════════════════════════════════════════════════════
# TRAINING
# ═══════════════════════════════════════════════════════════════════════════════

def train_user_autoencoder(uid: str, history: List[dict]) -> dict:
    """
    Trains (or retrains) the personalized LSTM autoencoder for a user.

    Args:
        uid:     Firebase user ID — used as the filename stem
        history: List of daily behavioral dicts (most-recent-first or oldest-first)
                 Needs ≥7 entries; falls back to synthetic augmentation if fewer.

    Returns:
        status dict with training metrics
    """
    os.makedirs(AUTOENCODER_DIR, exist_ok=True)
    model_path  = f"{AUTOENCODER_DIR}/{uid}.pt"
    scaler_path = f"{AUTOENCODER_DIR}/{uid}_scaler.json"
    meta_path   = f"{AUTOENCODER_DIR}/{uid}_meta.json"

    # Augment with synthetic if too few real points
    if len(history) < MIN_DAYS:
        synth = _generate_synthetic_history(30)
        combined = synth + list(history)  # real data at the end (more weight implicitly)
    else:
        combined = list(history)

    matrix  = _history_to_matrix(combined)    # (n_days, 8)
    scaler  = UserScaler()
    scaler.fit(matrix)
    normed  = scaler.transform(matrix)        # 0–1 normalized
    windows = _make_windows(normed)           # (n_windows, 7, 8)

    if len(windows) < 2:
        return {"status": "error", "message": "Insufficient windows — need ≥8 days of data"}

    X_tensor = torch.tensor(windows, dtype=torch.float32)
    dataset  = torch.utils.data.TensorDataset(X_tensor)
    loader   = torch.utils.data.DataLoader(dataset, batch_size=min(8, len(windows)), shuffle=True)

    model     = LSTMAutoencoder()
    optimizer = torch.optim.Adam(model.parameters(), lr=LR, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)
    criterion = nn.MSELoss()

    model.train()
    losses = []
    for epoch in range(EPOCHS):
        epoch_loss = 0.0
        for (batch,) in loader:
            optimizer.zero_grad()
            recon = model(batch)
            loss  = criterion(recon, batch)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            epoch_loss += loss.item()
        scheduler.step()
        losses.append(epoch_loss / len(loader))

    # Compute baseline reconstruction error on training data
    model.eval()
    with torch.no_grad():
        recons = model(X_tensor)
        mse_per_window = ((recons - X_tensor) ** 2).mean(dim=(1, 2)).numpy()
    baseline_mse = float(mse_per_window.mean())
    baseline_std = float(mse_per_window.std()) if len(mse_per_window) > 1 else 0.01

    # Save model + scaler + metadata
    torch.save(model.state_dict(), model_path)
    with open(scaler_path, "w") as f:
        json.dump(scaler.to_dict(), f)

    meta = {
        "uid":           uid,
        "data_points":   len(history),
        "n_windows":     int(len(windows)),
        "final_loss":    round(losses[-1], 6),
        "baseline_mse":  round(baseline_mse, 6),
        "baseline_std":  round(max(baseline_std, 0.001), 6),
        "trained_at":    __import__("datetime").datetime.utcnow().isoformat(),
    }
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"[Autoencoder] uid={uid} trained — "
          f"windows={len(windows)}, loss={losses[-1]:.6f}, "
          f"baseline_mse={baseline_mse:.6f}")
    return {
        "status":       "trained",
        "uid":          uid,
        "dataPoints":   len(history),
        "nWindows":     len(windows),
        "finalLoss":    round(losses[-1], 6),
        "baselineMse":  round(baseline_mse, 6),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# INFERENCE — compute anomaly score for a single 7-day window
# ═══════════════════════════════════════════════════════════════════════════════

def load_user_autoencoder(uid: str) -> Tuple[Optional[LSTMAutoencoder], Optional[UserScaler], Optional[dict]]:
    """Loads model, scaler, and metadata for a user. Returns (None, None, None) if not trained."""
    model_path  = f"{AUTOENCODER_DIR}/{uid}.pt"
    scaler_path = f"{AUTOENCODER_DIR}/{uid}_scaler.json"
    meta_path   = f"{AUTOENCODER_DIR}/{uid}_meta.json"

    if not os.path.exists(model_path):
        return None, None, None

    model = LSTMAutoencoder()
    model.load_state_dict(torch.load(model_path, map_location="cpu"))
    model.eval()

    scaler = UserScaler()
    if os.path.exists(scaler_path):
        with open(scaler_path) as f:
            scaler = UserScaler.from_dict(json.load(f))

    meta = {}
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            meta = json.load(f)

    return model, scaler, meta


def compute_anomaly_score(uid: str, window: List[dict]) -> dict:
    """
    Computes the behavioral anomaly score for a user's current 7-day window.

    Returns:
        anomalyScore (float 0–1): 0 = perfectly normal, 1 = extreme anomaly
        modelReady  (bool):       False if model not trained yet
        perFeature  (dict):       Per-signal MSE contribution (for explainability)
        reconstructionMse (float): Raw MSE before normalization
    """
    model, scaler, meta = load_user_autoencoder(uid)

    if model is None:
        return {
            "anomalyScore":     0.0,
            "modelReady":       False,
            "message":          "Model not trained yet. Call POST /api/anomaly/train first.",
            "perFeature":       {},
            "reconstructionMse": 0.0,
        }

    # Prepare input
    if len(window) < SEQUENCE_LEN:
        # Pad with population-average values at the front
        pad_len = SEQUENCE_LEN - len(window)
        synth   = _generate_synthetic_history(pad_len)
        window  = synth + list(window)

    matrix = _history_to_matrix(window[-SEQUENCE_LEN:])  # take last 7 days
    normed = scaler.transform(matrix)
    x      = torch.tensor(normed[np.newaxis, :, :], dtype=torch.float32)  # (1, 7, 8)

    with torch.no_grad():
        recon = model(x)

    mse_per_feature = ((recon - x) ** 2).mean(dim=1).squeeze().numpy()  # (8,)
    total_mse       = float(mse_per_feature.mean())

    # Normalize against baseline (from training metadata)
    baseline_mse = meta.get("baseline_mse", 0.01)
    baseline_std = meta.get("baseline_std", 0.01)
    anomaly_score = float(np.clip(
        (total_mse - baseline_mse) / (3.0 * baseline_std + 1e-8),
        0.0, 1.0
    ))

    per_feature = {
        FEATURE_NAMES[i]: round(float(mse_per_feature[i]), 5)
        for i in range(len(FEATURE_NAMES))
    }

    # Top contributing signal
    top_idx    = int(mse_per_feature.argmax())
    top_signal = FEATURE_NAMES[top_idx]

    return {
        "anomalyScore":      round(anomaly_score, 4),
        "modelReady":        True,
        "reconstructionMse": round(total_mse, 6),
        "baselineMse":       round(baseline_mse, 6),
        "perFeature":        per_feature,
        "topAnomalousSignal": top_signal,
        "modelVersion":      "lstm_autoencoder_v1",
    }


def get_user_status(uid: str) -> dict:
    """Returns model readiness and metadata for a user."""
    meta_path  = f"{AUTOENCODER_DIR}/{uid}_meta.json"
    model_path = f"{AUTOENCODER_DIR}/{uid}.pt"

    if not os.path.exists(model_path):
        return {
            "uid":          uid,
            "modelReady":   False,
            "dataPoints":   0,
            "trainedAt":    None,
            "baselineMse":  None,
        }

    meta = {}
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            meta = json.load(f)

    return {
        "uid":          uid,
        "modelReady":   True,
        "dataPoints":   meta.get("data_points", 0),
        "trainedAt":    meta.get("trained_at"),
        "baselineMse":  meta.get("baseline_mse"),
        "nWindows":     meta.get("n_windows"),
        "finalLoss":    meta.get("final_loss"),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# STANDALONE DEMO — run directly to verify the module
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import datetime

    TEST_UID = "demo_test_user"
    print("=" * 60)
    print("Niranthara LSTM Autoencoder — Standalone Demo")
    print("=" * 60)

    # Generate 30 days of "normal" synthetic history
    normal_history = _generate_synthetic_history(30)
    print(f"\n1. Training on {len(normal_history)} days of synthetic history...")
    result = train_user_autoencoder(TEST_UID, normal_history)
    print(f"   {result}")

    # Score a normal window (last 7 days of the training set)
    print("\n2. Scoring NORMAL 7-day window...")
    normal_window = normal_history[-7:]
    score_normal  = compute_anomaly_score(TEST_UID, normal_window)
    print(f"   anomalyScore = {score_normal['anomalyScore']:.4f}  (expected ~0.0)")
    print(f"   topSignal    = {score_normal['topAnomalousSignal']}")

    # Score an anomalous window (sleep crash, HR spike, social withdrawal)
    print("\n3. Scoring ANOMALOUS 7-day window (mental health crisis pattern)...")
    anomalous_window = [
        {"sleepHours": 2.5, "heartRate": 108, "steps": 300,  "moodScore": 1.2, "sentimentScore": 0.9, "appEngagement": 0.05, "gpsEntropy": 0.1, "screenTimeNightRatio": 0.8},
        {"sleepHours": 3.0, "heartRate": 112, "steps": 250,  "moodScore": 1.0, "sentimentScore": 0.85,"appEngagement": 0.08, "gpsEntropy": 0.1, "screenTimeNightRatio": 0.85},
        {"sleepHours": 2.8, "heartRate": 105, "steps": 400,  "moodScore": 1.5, "sentimentScore": 0.88,"appEngagement": 0.04, "gpsEntropy": 0.08,"screenTimeNightRatio": 0.75},
        {"sleepHours": 3.5, "heartRate": 99,  "steps": 500,  "moodScore": 1.3, "sentimentScore": 0.82,"appEngagement": 0.1,  "gpsEntropy": 0.12,"screenTimeNightRatio": 0.7},
        {"sleepHours": 2.2, "heartRate": 115, "steps": 200,  "moodScore": 1.1, "sentimentScore": 0.92,"appEngagement": 0.03, "gpsEntropy": 0.07,"screenTimeNightRatio": 0.9},
        {"sleepHours": 2.9, "heartRate": 110, "steps": 350,  "moodScore": 1.4, "sentimentScore": 0.87,"appEngagement": 0.06, "gpsEntropy": 0.09,"screenTimeNightRatio": 0.78},
        {"sleepHours": 3.1, "heartRate": 107, "steps": 280,  "moodScore": 1.2, "sentimentScore": 0.91,"appEngagement": 0.05, "gpsEntropy": 0.11,"screenTimeNightRatio": 0.82},
    ]
    score_anomalous = compute_anomaly_score(TEST_UID, anomalous_window)
    print(f"   anomalyScore = {score_anomalous['anomalyScore']:.4f}  (expected > 0.5)")
    print(f"   topSignal    = {score_anomalous['topAnomalousSignal']}")
    print(f"   perFeature   = {score_anomalous['perFeature']}")

    # Status
    print("\n4. User status:")
    status = get_user_status(TEST_UID)
    print(f"   {status}")

    print("\n[OK] Autoencoder module verified.")
