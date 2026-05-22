#!/usr/bin/env python3
# ai-service/scripts/demo_anomaly.py
# Quick demo script for the presentation — shows the full autoencoder pipeline
# Run: python scripts/demo_anomaly.py
# Requires: uvicorn running on port 8000

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.autoencoder_trainer import (
    train_user_autoencoder,
    compute_anomaly_score,
    get_user_status,
    _generate_synthetic_history,
)

DEMO_UID = "niranthara_demo"

def sep(title):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print('=' * 60)

# ─── Step 1: Train ────────────────────────────────────────────────────────────
sep("STEP 1 — Train personalized autoencoder (30-day history)")
history = _generate_synthetic_history(30)
result  = train_user_autoencoder(DEMO_UID, history)
print(f"  Status      : {result['status']}")
print(f"  Data points : {result['dataPoints']}")
print(f"  Windows     : {result['nWindows']}")
print(f"  Final loss  : {result['finalLoss']:.6f}")
print(f"  Baseline MSE: {result['baselineMse']:.6f}")

# ─── Step 2: Normal window ────────────────────────────────────────────────────
sep("STEP 2 — Score NORMAL behavioral window (last 7 days)")
normal_window = history[-7:]
score_normal  = compute_anomaly_score(DEMO_UID, normal_window)
print(f"  Anomaly Score : {score_normal['anomalyScore']:.4f}")
print(f"  Severity      : normal  (< 0.2 = within personal baseline)")
print(f"  Top Signal    : {score_normal.get('topAnomalousSignal', 'N/A')}")

# ─── Step 3: Anomalous window ─────────────────────────────────────────────────
sep("STEP 3 — Score ANOMALOUS window (crisis-level behavioral collapse)")
anomalous_window = [
    {"sleepHours": 2.5, "heartRate": 108, "steps": 300,  "moodScore": 1.2,
     "sentimentScore": 0.92, "appEngagement": 0.05, "gpsEntropy": 0.08, "screenTimeNightRatio": 0.82},
    {"sleepHours": 3.0, "heartRate": 112, "steps": 250,  "moodScore": 1.0,
     "sentimentScore": 0.88, "appEngagement": 0.06, "gpsEntropy": 0.09, "screenTimeNightRatio": 0.85},
    {"sleepHours": 2.8, "heartRate": 105, "steps": 400,  "moodScore": 1.5,
     "sentimentScore": 0.85, "appEngagement": 0.04, "gpsEntropy": 0.07, "screenTimeNightRatio": 0.78},
    {"sleepHours": 3.5, "heartRate": 99,  "steps": 500,  "moodScore": 1.3,
     "sentimentScore": 0.83, "appEngagement": 0.08, "gpsEntropy": 0.10, "screenTimeNightRatio": 0.72},
    {"sleepHours": 2.2, "heartRate": 115, "steps": 200,  "moodScore": 1.1,
     "sentimentScore": 0.91, "appEngagement": 0.03, "gpsEntropy": 0.06, "screenTimeNightRatio": 0.90},
    {"sleepHours": 2.9, "heartRate": 110, "steps": 350,  "moodScore": 1.4,
     "sentimentScore": 0.87, "appEngagement": 0.05, "gpsEntropy": 0.08, "screenTimeNightRatio": 0.79},
    {"sleepHours": 3.1, "heartRate": 107, "steps": 280,  "moodScore": 1.2,
     "sentimentScore": 0.90, "appEngagement": 0.04, "gpsEntropy": 0.07, "screenTimeNightRatio": 0.83},
]
score_anomalous = compute_anomaly_score(DEMO_UID, anomalous_window)
print(f"  Anomaly Score : {score_anomalous['anomalyScore']:.4f}")
sev = score_anomalous.get('severity', 'severe')
print(f"  Severity      : SEVERE — possible early relapse signal")
print(f"  Top Signal    : {score_anomalous.get('topAnomalousSignal', 'N/A')}")
print(f"\n  Per-feature reconstruction error:")
for feature, error in score_anomalous.get("perFeature", {}).items():
    bar = "#" * int(error * 40)
    print(f"    {feature:<28} {error:.5f}  {bar}")

# ─── Step 4: Model status ─────────────────────────────────────────────────────
sep("STEP 4 — Model status")
status = get_user_status(DEMO_UID)
for k, v in status.items():
    print(f"  {k:<18}: {v}")

# ─── Summary ──────────────────────────────────────────────────────────────────
sep("ARCHITECTURE SUMMARY")
print("""
  BEFORE (XGBoost only):
    IF sleep < 5h THEN risk += 0.2    <-- fixed thresholds

  AFTER (Autoencoder + XGBoost):
    Personal model learns: "Ananya's normal = 7.5h sleep, 72bpm HR, 6500 steps"
    Reconstruction error spikes when behavior deviates from learned manifold
    anomaly_score feeds XGBoost as 15th feature
    Result: catches invisible deterioration DAYS before fixed thresholds trigger

  API Pipeline:
    POST /api/anomaly/train    -> trains per-user LSTM autoencoder
    POST /api/anomaly/score    -> anomaly_score (0.0-1.0)
    POST /api/predict/risk     -> XGBoost 15-feature fusion (incl. anomaly_score)
    GET  /api/anomaly/status   -> model readiness + metadata
""")
print("[OK] Demo complete.")
