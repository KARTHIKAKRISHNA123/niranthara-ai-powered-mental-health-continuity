# routers/jitai.py — Personalized XGBoost JITAI per Build Guide §21

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import xgboost as xgb
import numpy as np
import pickle
import os

router = APIRouter()


def load_user_jitai_model(uid: str):
    path = f"models/user_jitai/{uid}.pkl"
    if os.path.exists(path):
        with open(path, "rb") as f:
            return pickle.load(f)
    return None


def train_user_jitai_model(uid: str, history: List[dict]):
    """
    Trains personalized JITAI model from user's response history.
    Label: 1 if user responded 'feel_better', 0 otherwise.
    Requires ≥5 data points.
    """
    if len(history) < 5:
        return None

    X = [[
        h.get("hour_of_day", 12) / 24,
        h.get("day_of_week", 0) / 7,
        h.get("riskScoreAtTrigger", 0.5),
        h.get("cycleVulnerability", 0),
        h.get("stepsDeviationScore", 0.3),
    ] for h in history]
    y = [1 if h.get("responseType") == "feel_better" else 0 for h in history]

    model = xgb.XGBClassifier(
        n_estimators=50, max_depth=3,
        eval_metric="logloss"
    )
    model.fit(np.array(X), np.array(y))

    os.makedirs("models/user_jitai", exist_ok=True)
    with open(f"models/user_jitai/{uid}.pkl", "wb") as f:
        pickle.dump(model, f)
    return model


class JITAIRequest(BaseModel):
    uid:                 str
    riskScore:           float = 0.3
    cycleVulnerability:  float = 0.0
    stepsDeviationScore: float = 0.3
    crisisProbability:   float = 0.0
    isInChat:            bool  = False
    hour_of_day:         int   = 12
    day_of_week:         int   = 0


class TrainRequest(BaseModel):
    uid:     str
    history: List[dict]


@router.post("/receptivity")
async def evaluate_jitai(request: JITAIRequest):
    # Crisis always fires — no receptivity gate
    if request.crisisProbability > 0.85:
        return {
            "shouldIntervene":  True,
            "interventionType": "crisis_check",
            "priority":         "urgent",
            "receptivityScore": 1.0,
            "reasoning":        "Crisis NLP probability above 0.85",
            "triggerReasons":   ["Crisis language detected (NLP classifier)"]
        }

    # Don't interrupt active chat sessions
    if request.isInChat:
        return {"shouldIntervene": False, "interventionType": "none", "receptivityScore": 0.0, "reasoning": "User in active chat"}

    # Don't intervene if risk is low
    if request.riskScore < 0.3:
        return {"shouldIntervene": False, "interventionType": "none", "receptivityScore": 0.0, "reasoning": "Risk score below threshold"}

    # Load personalized model if available
    user_model = load_user_jitai_model(request.uid)
    features   = np.array([[
        request.hour_of_day / 24,
        request.day_of_week / 7,
        request.riskScore,
        request.cycleVulnerability,
        request.stepsDeviationScore
    ]])

    if user_model is not None:
        receptivity = float(user_model.predict_proba(features)[0][1])
        model_type  = "personalized"
    else:
        # Population fallback — higher receptivity in evenings (17–21h)
        h = request.hour_of_day
        time_r     = 0.8 if 17 <= h <= 21 else 0.5 if 9 <= h <= 17 else 0.2
        receptivity = min(request.riskScore * time_r * 1.5, 1.0)
        model_type  = "population_fallback"

    if receptivity < 0.4:
        return {
            "shouldIntervene":  False,
            "interventionType": "none",
            "receptivityScore": round(receptivity, 3),
            "reasoning":        f"Low receptivity ({model_type})"
        }

    # Select intervention type based on signal combination
    if request.crisisProbability > 0.6:
        itype = "crisis_check"
    elif request.cycleVulnerability > 0.7 and request.riskScore > 0.6:
        itype = "cbt_reframe"
    elif request.stepsDeviationScore > 0.5:
        itype = "breathing"
    elif request.cycleVulnerability > 0.5:
        itype = "cycle_aware"
    else:
        itype = "gentle_nudge"

    return {
        "shouldIntervene":  True,
        "interventionType": itype,
        "priority":         "high" if request.riskScore > 0.7 else "medium",
        "receptivityScore": round(receptivity, 3),
        "modelType":        model_type,
        "triggerReasons":   [
            f"Risk score: {request.riskScore:.2f}",
            f"Receptivity: {receptivity:.2f} ({model_type})"
        ]
    }


@router.post("/train")
async def train_jitai(request: TrainRequest):
    model = train_user_jitai_model(request.uid, request.history)
    if model is None:
        return {"status": "insufficient_data", "message": f"Need ≥5 responses, have {len(request.history)}"}
    return {"status": "trained", "dataPoints": len(request.history)}
