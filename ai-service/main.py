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

# Load .env BEFORE importing routers — nvidia_client reads NVIDIA_API_KEY at
# import time. Without this the chat LLM silently ran on static fallbacks.
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat, crisis, sentiment, emotion, predict, dropout, cycle, jitai, anomaly

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
app.include_router(anomaly.router,   prefix="/api/anomaly",   tags=["Anomaly"])


@app.on_event("startup")
async def warm_models():
    """Load the lazy crisis classifier in the background at boot — the first
    chat message otherwise pays a ~40s model-load penalty (measured on CPU)."""
    import asyncio

    def _warm():
        try:
            from utils.crisis_classifier import warm_up, CRISIS_MODEL
            warm_up()
            print(f"[startup] crisis classifier warmed: {CRISIS_MODEL}")
        except Exception as e:
            print(f"[startup] warm-up failed (non-fatal): {e}")

    asyncio.get_event_loop().run_in_executor(None, _warm)


@app.get("/")
def root():
    return {
        "app": "Niranthara AI Service v2.0",
        "architecture": "ML-first — zero hardcoding — zero keyword matching",
        "models": {
            "crisis":    os.getenv("CRISIS_MODEL", "sentinet/suicidality"),
            "sentiment": "ai4bharat/indic-bert",
            "emotion":   "j-hartmann/emotion-english-distilroberta-base",
            "chat":      "NVIDIA Minimax cloud API",
            "risk":      "XGBoost 15-feature fusion + SHAP (incl. autoencoder anomaly score)",
            "dropout":   "XGBoost disengagement classifier",
            "cycle":     "Personalized LSTM per user",
            "jitai":     "Personalized XGBoost per user",
            "anomaly":   "Personalized LSTM Autoencoder — behavioral manifold anomaly detection",
        }
    }


@app.get("/api/health")
async def health():
    import torch, os
    return {
        "status": "OK",
        "cuda_available":     torch.cuda.is_available(),
        "cuda_device":        torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
        "risk_model_ready":   os.path.exists("models/risk_model.pkl"),
        "dropout_model_ready":os.path.exists("models/dropout_model.pkl"),
        "anomaly_models":     len([f for f in os.listdir("models/user_autoencoders") if f.endswith(".pt")]) if os.path.exists("models/user_autoencoders") else 0,
        "service":            "ai-service"
    }
