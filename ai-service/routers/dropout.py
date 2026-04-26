# routers/dropout.py — predicts disengagement / dropout within 7 days

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import pickle
import shap
import os

router = APIRouter()

FEATURE_ORDER = [
    "days_since_last_checkin",
    "notification_open_rate_trend",
    "session_length_trend",
    "jitai_response_rate",
    "app_open_frequency_7d_trend",
]
FEATURE_DESCRIPTIONS = {
    "days_since_last_checkin": "Days since the last check-in",
    "notification_open_rate_trend": "Notification open rate trend is declining",
    "session_length_trend": "Session duration trend is shortening",
    "jitai_response_rate": "User is ignoring JITAI interventions",
    "app_open_frequency_7d_trend": "App open frequency trend is declining",
}

dropout_model = None
explainer = None


def _load_model():
    global dropout_model, explainer
    path = "models/dropout_model.pkl"
    if os.path.exists(path):
        with open(path, "rb") as f:
            dropout_model = pickle.load(f)
        explainer = shap.TreeExplainer(dropout_model)
        return True
    return False


_load_model()


class DropoutRequest(BaseModel):
    uid: str = ""
    daysSinceLastCheckin: Optional[float] = None
    notificationOpenRateTrend: Optional[float] = None
    sessionLengthTrend: Optional[float] = None
    jitaiResponseRate: Optional[float] = None
    appOpenFrequency7dTrend: Optional[float] = None
    passiveLogs: Optional[List[dict]] = []
    moodLogs: Optional[List[dict]] = []
    jitaiLogs: Optional[List[dict]] = []


def _trend(series: List[float]) -> float:
    if len(series) < 2:
        return 0.5
    first = np.mean(series[: max(1, len(series) // 2)])
    last = np.mean(series[max(0, len(series) // 2):])
    return float(np.clip((last / max(first, 0.01)), 0, 1))


def _build_features(req: DropoutRequest) -> np.ndarray:
    mood_logs = req.moodLogs or []
    passive_logs = req.passiveLogs or []
    jitai_logs = req.jitaiLogs or []

    if req.daysSinceLastCheckin is not None:
        days_since_last_checkin = float(req.daysSinceLastCheckin)
    elif mood_logs:
        last_mood = mood_logs[0]
        created_at = last_mood.get("createdAt") or last_mood.get("date")
        if created_at:
            from datetime import datetime
            try:
                days_since_last_checkin = (datetime.utcnow() - datetime.fromisoformat(created_at.replace("Z", "+00:00"))).days
            except Exception:
                days_since_last_checkin = 3.0
        else:
            days_since_last_checkin = 3.0
    else:
        days_since_last_checkin = 3.0

    notification_open_rate_trend = req.notificationOpenRateTrend
    if notification_open_rate_trend is None:
        notif_opens = [1.0 if item.get("openedByUser") else 0.0 for item in jitai_logs if item.get("notificationSent")]
        notification_open_rate_trend = _trend(notif_opens) if notif_opens else 0.5

    session_length_trend = req.sessionLengthTrend
    if session_length_trend is None:
        session_lengths = [float(item.get("sessionDurationMinutes", 10)) for item in passive_logs]
        session_length_trend = _trend(session_lengths) if session_lengths else 0.5

    jitai_response_rate = req.jitaiResponseRate
    if jitai_response_rate is None:
        sent = sum(1 for item in jitai_logs if item.get("notificationSent"))
        opened = sum(1 for item in jitai_logs if item.get("openedByUser"))
        jitai_response_rate = opened / sent if sent else 0.5

    app_open_frequency_7d_trend = req.appOpenFrequency7dTrend
    if app_open_frequency_7d_trend is None:
        app_opens = [1.0 for _ in mood_logs] + [0.5 for _ in passive_logs]
        app_open_frequency_7d_trend = _trend(app_opens) if app_opens else 0.5

    return np.array([[
        days_since_last_checkin / 21.0,
        np.clip(notification_open_rate_trend, 0, 1),
        np.clip(session_length_trend, 0, 1),
        np.clip(jitai_response_rate, 0, 1),
        np.clip(app_open_frequency_7d_trend, 0, 1),
    ]])


@router.post("/predict")
async def predict_dropout(request: DropoutRequest):
    if dropout_model is None and not _load_model():
        features = _build_features(request)[0]
        score = min(
            0.35 * features[0]
            + 0.15 * (1 - features[1])
            + 0.15 * (1 - features[2])
            + 0.20 * (1 - features[3])
            + 0.15 * (1 - features[4]),
            1.0,
        )
        return {
            "dropoutProbability": round(score, 4),
            "willDropOutIn7d": score > 0.7,
            "recommendedAction": "simplified_checkin" if score > 0.7 else "monitor",
            "topFactors": ["Model training pending — run dropout_trainer.py"],
            "modelVersion": "pending",
        }

    features = _build_features(request)
    proba = dropout_model.predict_proba(features)[0]
    dropout_probability = float(proba[1]) if len(proba) > 1 else float(proba.max())

    shap_values = explainer.shap_values(features)
    if isinstance(shap_values, list):
        class_shap = shap_values[1][0]
    else:
        class_shap = shap_values[0]

    top_indices = np.argsort(np.abs(class_shap))[-3:][::-1]
    top_factors = [FEATURE_DESCRIPTIONS[FEATURE_ORDER[i]] for i in top_indices]

    return {
        "dropoutProbability": round(dropout_probability, 4),
        "willDropOutIn7d": dropout_probability > 0.7,
        "recommendedAction": "simplified_checkin" if dropout_probability > 0.7 else "monitor",
        "topFactors": top_factors,
        "allProbs": {"stay": round(float(proba[0]), 4), "dropout": round(float(proba[1]), 4)} if len(proba) > 1 else {"stay": round(float(1 - dropout_probability), 4), "dropout": round(dropout_probability, 4)},
        "confidence": round(dropout_probability, 4),
        "modelVersion": "xgboost_dropout_v1",
    }


@router.post("/explain")
async def explain_dropout(request: DropoutRequest):
    if dropout_model is None or explainer is None:
        return {"error": "Model not loaded. Run dropout_trainer.py first."}

    features = _build_features(request)
    shap_values = explainer.shap_values(features)
    if isinstance(shap_values, list):
        class_shap = shap_values[1][0]
    else:
        class_shap = shap_values[0]

    explanation = {FEATURE_ORDER[i]: round(float(class_shap[i]), 4) for i in range(len(FEATURE_ORDER))}
    return {"shapValues": explanation, "featureDescriptions": FEATURE_DESCRIPTIONS}