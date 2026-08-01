# routers/cycle.py — Personalized LSTM cycle prediction per Build Guide §19

from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List, Optional
import torch
import torch.nn as nn
import numpy as np
import pickle
import os
from datetime import datetime, timedelta

router = APIRouter()


class PersonalizedCycleModel(nn.Module):
    def __init__(self, input_size=1, hidden_size=32, num_layers=2):
        super().__init__()
        self.lstm   = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.linear = nn.Linear(hidden_size, 1)

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.linear(out[:, -1, :])


def _phase_from_progress(p: float) -> str:
    if p < 0.18: return "menstrual"
    if p < 0.50: return "follicular"
    if p < 0.60: return "ovulation"
    if p < 0.75: return "luteal"
    return "late_luteal"


def train_user_cycle_model(uid: str, period_history: List[str]):
    """Retrain personalized LSTM on user's period history. Requires ≥3 cycles."""
    if len(period_history) < 3:
        return None

    cycle_lengths = []
    sorted_history = sorted(period_history)
    for i in range(1, len(sorted_history)):
        d1 = datetime.fromisoformat(sorted_history[i - 1])
        d2 = datetime.fromisoformat(sorted_history[i])
        length = (d2 - d1).days
        if 15 <= length <= 90:
            cycle_lengths.append(float(length))

    if len(cycle_lengths) < 2:
        return None

    mean_len = float(np.mean(cycle_lengths))
    std_len  = float(max(np.std(cycle_lengths), 1.0))
    norm     = [(l - mean_len) / std_len for l in cycle_lengths]

    seq = torch.tensor([[v] for v in norm[:-1]], dtype=torch.float32).unsqueeze(0)
    tgt = torch.tensor([norm[-1]], dtype=torch.float32)

    model     = PersonalizedCycleModel()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    criterion = nn.MSELoss()

    for _ in range(300):
        optimizer.zero_grad()
        loss = criterion(model(seq)[0][0], tgt[0])
        loss.backward()
        optimizer.step()

    model.eval()
    state = {"model": model, "mean": mean_len, "std": std_len, "history": cycle_lengths}
    os.makedirs("models/user_cycles", exist_ok=True)
    with open(f"models/user_cycles/{uid}.pkl", "wb") as f:
        pickle.dump(state, f)
    return state


def predict_vulnerability(uid: str, last_period_date: str, period_history: List[str] = None, avg_cycle: float = 28.0):
    state      = None
    model_type = "population_fallback"

    model_path = f"models/user_cycles/{uid}.pkl"
    if os.path.exists(model_path):
        with open(model_path, "rb") as f:
            state = pickle.load(f)
        model_type = "personalized"

    if state is not None:
        history = state["history"]
        norm    = [(l - state["mean"]) / state["std"] for l in history[-5:]]
        seq     = torch.tensor([[v] for v in norm], dtype=torch.float32).unsqueeze(0)
        with torch.no_grad():
            pred = state["model"](seq)[0]
        predicted_len = float(pred[0].item() * state["std"] + state["mean"])
        predicted_len = max(20.0, min(60.0, predicted_len))
        vuln_start, vuln_end = 0.72, 0.92
    else:
        predicted_len = avg_cycle or 28.0
        vuln_start, vuln_end = 0.75, 0.95

    last_period = datetime.fromisoformat(last_period_date.replace("Z", ""))
    days_since  = (datetime.now() - last_period).days + 1

    # A period that is late must not spin the ring past its own length. Report
    # the true elapsed days separately and cap the displayed day at the cycle
    # length so "Day 41 of 28" can never render.
    cycle_len   = int(round(predicted_len))
    is_overdue  = days_since > cycle_len
    current_day = min(days_since, cycle_len)
    progress    = min(days_since / predicted_len, 1.1)

    # Smooth vulnerability curve
    if progress < 0.5:
        vuln_score = progress * 0.2
    elif progress < vuln_start:
        vuln_score = 0.1 + (progress - 0.5) / (vuln_start - 0.5) * 0.3
    elif progress < vuln_end:
        t          = (progress - vuln_start) / (vuln_end - vuln_start)
        vuln_score = 0.4 + t * 0.55
    else:
        vuln_score = 0.3

    return {
        "currentDay":            current_day,
        "daysSinceLastPeriod":   days_since,
        "isOverdue":             is_overdue,
        "predictedCycleLength":  cycle_len,
        "vulnerabilityScore":    round(vuln_score, 3),
        "isHighRisk":            vuln_score > 0.65,
        "currentPhase":          _phase_from_progress(progress),
        "modelType":             model_type,
        "predictedNextPeriod":   (last_period + timedelta(days=cycle_len)).isoformat()
    }


class TrainRequest(BaseModel):
    periodHistory: List[str]


@router.post("/train/{uid}")
async def train_cycle(uid: str, request: TrainRequest):
    result = train_user_cycle_model(uid, request.periodHistory)
    if result is None:
        return {"status": "insufficient_data", "message": "Need at least 3 complete cycles to train personalized model. Using population fallback."}
    return {"status": "trained", "modelType": "personalized", "cyclesUsed": len(result["history"])}


@router.get("/predict/{uid}")
async def predict_cycle(
    uid:         str,
    last_period: Optional[str] = Query(None),
    avg_cycle:   Optional[float] = Query(28.0)
):
    # Without a real last-period date there is no cycle day to compute. The
    # previous branch invented "today minus 14 days" whenever a trained model
    # existed, which pinned such users to day 14 forever and disagreed with the
    # value stored in Firestore. Absent data is reported as absent.
    if not last_period:
        return {
            "currentDay": 0,
            "vulnerabilityScore": 0.0,
            "currentPhase": "unknown",
            "modelType": "no_data",
            "message": "No period start date supplied — cannot compute cycle day",
        }

    return predict_vulnerability(uid, last_period, avg_cycle=avg_cycle or 28.0)
