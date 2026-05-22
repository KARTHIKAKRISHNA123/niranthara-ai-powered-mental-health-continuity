# routers/predict.py — XGBoost 15-feature risk + SHAP per Build Guide §20 & §28
# 15th feature: anomaly_behavioral_deviation from Personalized LSTM Autoencoder

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import xgboost as xgb
import numpy as np
import shap
import pickle
import os

router = APIRouter()

RISK_LEVELS   = ["low", "moderate", "high", "crisis"]
FEATURE_ORDER = [
    "mood_score_avg_7d", "sleep_hours_avg_7d", "steps_deviation_score",
    "anxiety_level_avg_7d", "cycle_vulnerability_score", "gps_entropy_deviation_score",
    "journal_sentiment_score", "emotion_distress_score", "crisis_probability",
    "app_engagement_score", "missed_checkins_count", "mood_sentiment_divergence",
    "screen_time_night_ratio", "social_connectivity_score",
    "anomaly_behavioral_deviation",   # 15th — LSTM Autoencoder reconstruction error
]
FEATURE_DESCRIPTIONS = {
    "mood_score_avg_7d":           "Average mood score this week",
    "sleep_hours_avg_7d":          "Average sleep hours this week",
    "steps_deviation_score":       "Physical activity below personal baseline",
    "anxiety_level_avg_7d":        "Average anxiety level this week",
    "cycle_vulnerability_score":   "Hormonal vulnerability (personalized cycle model)",
    "gps_entropy_deviation_score": "Social activity below personal baseline",
    "journal_sentiment_score":     "Negative sentiment in journal (IndicBERT)",
    "emotion_distress_score":      "Distress emotion intensity detected",
    "crisis_probability":          "Crisis signal detected (NLP classifier)",
    "app_engagement_score":        "App engagement below personal baseline",
    "missed_checkins_count":       "Missed daily check-ins recently",
    "mood_sentiment_divergence":   "Gap between stated mood and expressed sentiment",
    "screen_time_night_ratio":         "Late-night phone usage pattern",
    "social_connectivity_score":       "Social communication patterns",
    "anomaly_behavioral_deviation":    "Behavioral anomaly detected (personalized autoencoder)",
}
DISTRESS_EMOTION_SCORES = {"sadness": 0.9, "fear": 0.8, "anger": 0.7, "disgust": 0.6}

# Load model at startup
risk_model = None
explainer  = None

def _load_model():
    global risk_model, explainer
    path = "models/risk_model.pkl"
    if os.path.exists(path):
        with open(path, "rb") as f:
            risk_model = pickle.load(f)
        explainer = shap.TreeExplainer(risk_model)
        return True
    return False

_load_model()


class RiskRequest(BaseModel):
    uid:                     str = ""
    moodScore:               float = 3.0
    sleepHours:              float = 7.0
    anxietyLevel:            float = 5.0
    sentimentScore:          float = 0.5
    emotionLabel:            str   = "neutral"
    crisisProbability:       float = 0.0
    cycleVulnerability:      float = 0.0
    moodSentimentDivergence: float = 0.0
    energyLevel:             Optional[float] = 5.0
    passiveLogs:             Optional[List[dict]] = []
    # 15th feature — from Personalized LSTM Autoencoder (0.0 = no anomaly, 1.0 = extreme)
    # Defaults to 0.0 for full backward compatibility when autoencoder not yet called
    anomalyScore:            Optional[float] = 0.0


def _build_features(req: RiskRequest) -> np.ndarray:
    passive = req.passiveLogs or []
    p_mean  = lambda key, default: np.mean([l.get(key, default) for l in passive]) if passive else default

    return np.array([[
        req.moodScore / 5,
        req.sleepHours / 10,
        p_mean("stepsDeviationScore", 0.3),
        req.anxietyLevel / 10,
        req.cycleVulnerability,
        p_mean("gpsDeviationScore", 0.3),
        req.sentimentScore,
        DISTRESS_EMOTION_SCORES.get(req.emotionLabel, 0.2),
        req.crisisProbability,
        min(p_mean("appOpenCount", 3) / 5, 1.0),
        min(sum(1 for l in passive if not l.get("checkinCompleted", True)) / 7, 1.0),
        req.moodSentimentDivergence,
        p_mean("nightScreenMinutes", 0) / max(p_mean("screenTimeMinutes", 1), 1),
        p_mean("socialConnectivityScore", 0.5),
        float(np.clip(req.anomalyScore or 0.0, 0.0, 1.0)),   # 15th — autoencoder anomaly score
    ]])


@router.post("/risk")
async def predict_risk(request: RiskRequest):
    if risk_model is None:
        if not _load_model():
            # Model not trained yet — return rule-based placeholder
            score = min(
                (1 - request.moodScore / 5) * 0.3
                + request.crisisProbability * 0.4
                + request.cycleVulnerability * 0.2
                + request.sentimentScore * 0.1,
                1.0
            )
            level = "crisis" if score > 0.85 else "high" if score > 0.6 else "moderate" if score > 0.35 else "low"
            return {"riskScore": round(score, 4), "riskLevel": level, "topFactors": ["Model training pending — run model_trainer.py"], "modelVersion": "pending"}

    features    = _build_features(request)
    risk_proba  = risk_model.predict_proba(features)[0]
    risk_class  = int(risk_proba.argmax())

    shap_values = explainer.shap_values(features)
    if isinstance(shap_values, list):
        class_shap = shap_values[risk_class][0]
    else:
        class_shap = shap_values[0]

    top_indices = np.argsort(np.abs(class_shap))[-3:][::-1]
    top_factors = [FEATURE_DESCRIPTIONS[FEATURE_ORDER[i]] for i in top_indices]

    return {
        "riskScore":    round(float(risk_proba.max()), 4),
        "riskLevel":    RISK_LEVELS[risk_class],
        "topFactors":   top_factors,
        "confidence":   round(float(risk_proba.max()), 4),
        "allProbs":     {RISK_LEVELS[i]: round(float(p), 4) for i, p in enumerate(risk_proba)},
        "modelVersion": "xgboost_v3_15features"
    }


@router.post("/explain")
async def explain_risk(request: RiskRequest):
    if risk_model is None or explainer is None:
        return {"error": "Model not loaded. Run model_trainer.py first."}

    features    = _build_features(request)
    shap_values = explainer.shap_values(features)
    if isinstance(shap_values, list):
        risk_proba = risk_model.predict_proba(features)[0]
        risk_class = int(risk_proba.argmax())
        class_shap = shap_values[risk_class][0]
    else:
        class_shap = shap_values[0]

    explanation = {FEATURE_ORDER[i]: round(float(class_shap[i]), 4) for i in range(len(FEATURE_ORDER))}
    return {"shapValues": explanation, "featureDescriptions": FEATURE_DESCRIPTIONS}
