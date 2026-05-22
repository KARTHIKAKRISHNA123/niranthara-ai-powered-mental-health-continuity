# routers/anomaly.py — Personalized LSTM Autoencoder anomaly detection per Build Guide §28
# POST /api/anomaly/score  → behavioral anomaly score (0-1) from reconstruction error
# POST /api/anomaly/train  → train/retrain per-user autoencoder
# GET  /api/anomaly/status/{uid} → model readiness + metadata

import os
import json
import sys
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

# Make models/ importable from the routers/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models.autoencoder_trainer import (
    train_user_autoencoder,
    compute_anomaly_score,
    get_user_status,
    _generate_synthetic_history,
    FEATURE_NAMES,
    MIN_DAYS,
)

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class DayBiometrics(BaseModel):
    """
    One day of multivariate behavioral data.
    All fields are optional with sensible defaults — missing = population average.
    """
    sleepHours:            Optional[float] = 7.0    # raw hours
    heartRate:             Optional[float] = 72.0   # bpm
    steps:                 Optional[int]   = 6000   # daily step count
    moodScore:             Optional[float] = 3.0    # 1–5 user mood
    sentimentScore:        Optional[float] = 0.5    # NLP negative sentiment 0–1
    appEngagement:         Optional[float] = 0.5    # engagement score 0–1
    gpsEntropy:            Optional[float] = 0.5    # GPS entropy 0–1
    screenTimeNightRatio:  Optional[float] = 0.1    # night screen ratio 0–1
    date:                  Optional[str]   = None   # ISO date (unused in model, kept for logging)


class AnomalyScoreRequest(BaseModel):
    uid:    str
    window: List[DayBiometrics]    # last 7 days (oldest → newest); padded if fewer


class TrainRequest(BaseModel):
    uid:     str
    history: List[DayBiometrics]   # up to 30 days of behavioral history
    force:   bool = False          # if True, retrain even if model already exists


# ── Helper ────────────────────────────────────────────────────────────────────

def _biometrics_to_dicts(items: List[DayBiometrics]) -> List[dict]:
    return [item.model_dump() for item in items]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/score")
async def score_anomaly(request: AnomalyScoreRequest):
    """
    Compute behavioral anomaly score for a user's current 7-day window.

    The autoencoder reconstructs the input window from the learned behavioral
    manifold. High reconstruction error (MSE) → high anomaly score.

    Returns:
        anomalyScore  (0.0–1.0): 0 = normal, 1 = extreme behavioral anomaly
        modelReady    (bool):    False if the user's model hasn't been trained yet
        topAnomalousSignal:      The signal contributing most to the anomaly
        perFeature    (dict):    Per-signal reconstruction error (explainability)
    """
    if not request.uid:
        raise HTTPException(status_code=400, detail="uid is required")
    if not request.window:
        raise HTTPException(status_code=400, detail="window must have ≥1 day")

    window_dicts = _biometrics_to_dicts(request.window)
    result       = compute_anomaly_score(request.uid, window_dicts)

    # Enrich with clinical interpretation
    score = result.get("anomalyScore", 0.0)
    if not result.get("modelReady"):
        interpretation = "Model not trained — call POST /api/anomaly/train first."
        severity       = "unknown"
    elif score < 0.2:
        interpretation = "Behavioral patterns are within personal normal range."
        severity       = "normal"
    elif score < 0.4:
        interpretation = "Minor deviation from personal baseline — monitor."
        severity       = "mild"
    elif score < 0.65:
        interpretation = "Significant behavioral shift from personal baseline."
        severity       = "moderate"
    else:
        interpretation = "Severe behavioral anomaly — possible early relapse signal."
        severity       = "severe"

    result["interpretation"] = interpretation
    result["severity"]       = severity
    return result


@router.post("/train")
async def train_anomaly_model(request: TrainRequest):
    """
    Train (or retrain) the personalized LSTM autoencoder for a user.

    - Requires ≥7 days of real behavioral data for clinical-grade results.
    - If fewer than 7 days, the model is trained with synthetic augmentation
      (population averages) as a warm-start. Scores will improve as real
      data accumulates.
    - Training is CPU-only (~2–5 seconds on i5-13450HX).
    - Called automatically by the Node backend after each mood log.

    Returns training metrics: finalLoss, baselineMse, dataPoints.
    """
    if not request.uid:
        raise HTTPException(status_code=400, detail="uid is required")

    # Check if already trained and force=False
    model_path = f"models/user_autoencoders/{request.uid}.pt"
    if os.path.exists(model_path) and not request.force and len(request.history) < MIN_DAYS:
        status = get_user_status(request.uid)
        return {
            "status":  "skipped",
            "reason":  "Model already trained; use force=true to retrain or provide ≥7 days",
            "current": status,
        }

    history_dicts = _biometrics_to_dicts(request.history)
    result        = train_user_autoencoder(request.uid, history_dicts)
    return result


@router.get("/status/{uid}")
async def get_model_status(uid: str):
    """
    Returns whether the user's autoencoder is trained, when it was last
    trained, how many data points were used, and the training baseline MSE.
    """
    if not uid:
        raise HTTPException(status_code=400, detail="uid is required")
    return get_user_status(uid)


@router.post("/demo")
async def run_demo(uid: str = "demo_user"):
    """
    Dev/demo endpoint: trains the model with 30-day synthetic history,
    then scores a normal window and an anomalous window side by side.
    Demonstrates the full pipeline without needing real data.
    """
    from models.autoencoder_trainer import _generate_synthetic_history

    # Train on synthetic normal history
    synth_history = _generate_synthetic_history(30)
    train_result  = train_user_autoencoder(uid, synth_history)

    # Normal window (last 7 days of training data)
    normal_window  = synth_history[-7:]
    normal_score   = compute_anomaly_score(uid, normal_window)

    # Anomalous window — crisis-level behavioral collapse
    anomalous_window = [
        {"sleepHours": 2.5, "heartRate": 108, "steps": 300,  "moodScore": 1.2, "sentimentScore": 0.9, "appEngagement": 0.05, "gpsEntropy": 0.1, "screenTimeNightRatio": 0.8},
        {"sleepHours": 3.0, "heartRate": 112, "steps": 250,  "moodScore": 1.0, "sentimentScore": 0.85,"appEngagement": 0.08, "gpsEntropy": 0.1, "screenTimeNightRatio": 0.85},
        {"sleepHours": 2.8, "heartRate": 105, "steps": 400,  "moodScore": 1.5, "sentimentScore": 0.88,"appEngagement": 0.04, "gpsEntropy": 0.08,"screenTimeNightRatio": 0.75},
        {"sleepHours": 3.5, "heartRate": 99,  "steps": 500,  "moodScore": 1.3, "sentimentScore": 0.82,"appEngagement": 0.1,  "gpsEntropy": 0.12,"screenTimeNightRatio": 0.7},
        {"sleepHours": 2.2, "heartRate": 115, "steps": 200,  "moodScore": 1.1, "sentimentScore": 0.92,"appEngagement": 0.03, "gpsEntropy": 0.07,"screenTimeNightRatio": 0.9},
        {"sleepHours": 2.9, "heartRate": 110, "steps": 350,  "moodScore": 1.4, "sentimentScore": 0.87,"appEngagement": 0.06, "gpsEntropy": 0.09,"screenTimeNightRatio": 0.78},
        {"sleepHours": 3.1, "heartRate": 107, "steps": 280,  "moodScore": 1.2, "sentimentScore": 0.91,"appEngagement": 0.05, "gpsEntropy": 0.11,"screenTimeNightRatio": 0.82},
    ]
    anomalous_score = compute_anomaly_score(uid, anomalous_window)

    return {
        "demo":           True,
        "uid":            uid,
        "training":       train_result,
        "normalWindow":   {"anomalyScore": normal_score["anomalyScore"],   "severity": "normal"   if normal_score["anomalyScore"] < 0.2 else "elevated"},
        "anomalousWindow":{"anomalyScore": anomalous_score["anomalyScore"],"severity": "severe"   if anomalous_score["anomalyScore"] > 0.5 else "moderate", "topSignal": anomalous_score.get("topAnomalousSignal")},
        "interpretation": "Reconstruction error spikes when behavioral patterns deviate from personal baseline — enables early relapse detection days before standard thresholds.",
    }
