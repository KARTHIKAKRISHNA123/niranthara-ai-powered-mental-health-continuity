# ai-service/main.py — FastAPI ML Service per Build Guide §15

# ── CPU Threading Optimization for i5-13450HX (6P + 4E hybrid) ──────────
# Must be set BEFORE importing numpy, torch, sklearn, or xgboost.
# Pins ML workloads to the 6 Performance-cores, leaving E-cores free
# for Node.js backend, dashboard, and OS tasks.
import os
os.environ["OMP_NUM_THREADS"]     = "6"
os.environ["MKL_NUM_THREADS"]     = "6"
os.environ["OPENBLAS_NUM_THREADS"] = "6"
os.environ["VECLIB_MAXIMUM_THREADS"] = "6"
os.environ["NUMEXPR_NUM_THREADS"] = "6"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat, crisis, sentiment, emotion, predict, dropout, cycle, jitai

app = FastAPI(
    title="Niranthara AI Service",
    description="ML-first NLP pipeline — zero hardcoding, zero keyword matching",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(chat.router,      prefix="/api/chat",      tags=["Chat"])
app.include_router(crisis.router,    prefix="/api/crisis",    tags=["Crisis"])
app.include_router(sentiment.router, prefix="/api/sentiment", tags=["Sentiment"])
app.include_router(emotion.router,   prefix="/api/emotion",   tags=["Emotion"])
app.include_router(predict.router,   prefix="/api/predict",   tags=["Risk"])
app.include_router(dropout.router,    prefix="/api/dropout",   tags=["Dropout"])
app.include_router(cycle.router,     prefix="/api/cycle",     tags=["Cycle"])
app.include_router(jitai.router,     prefix="/api/jitai",     tags=["JITAI"])


@app.get("/")
def root():
    return {
        "app": "Niranthara AI Service v2.0",
        "architecture": "ML-first — zero hardcoding — zero keyword matching",
        "models": {
            "crisis":    "mental/mental-roberta-base",
            "sentiment": "ai4bharat/indic-bert",
            "emotion":   "j-hartmann/emotion-english-distilroberta-base",
            "chat":      "gemma:4b via Ollama CUDA RTX 3050",
            "risk":      "XGBoost 14-feature fusion + SHAP",
            "dropout":   "XGBoost disengagement classifier",
            "cycle":     "Personalized LSTM per user",
            "jitai":     "Personalized XGBoost per user"
        }
    }


@app.get("/api/health")
async def health():
    import torch, os
    return {
        "status": "OK",
        "cuda_available":   torch.cuda.is_available(),
        "cuda_device":      torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
        "risk_model_ready": os.path.exists("models/risk_model.pkl"),
        "service":          "ai-service"
    }
