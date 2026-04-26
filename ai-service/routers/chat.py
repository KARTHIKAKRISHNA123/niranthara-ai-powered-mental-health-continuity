# routers/chat.py — Full NLP pipeline + Gemma 4B context-aware response

import time
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from utils.gemma_client import generate_response
from utils.sarvam_client import transcribe_audio, is_mocked
from utils.language_detector import detect_language
from transformers import pipeline
import torch

router = APIRouter()

# Load crisis classifier for chat (shared with crisis router — lazy load here)
_crisis_pipe = None

def get_crisis_pipe():
    global _crisis_pipe
    if _crisis_pipe is None:
        _crisis_pipe = pipeline("text-classification", model="mental/mental-roberta-base",
                                 device=0 if torch.cuda.is_available() else -1)
    return _crisis_pipe


class ChatRequest(BaseModel):
    message:             str
    language:            Optional[str] = "en"
    uid:                 Optional[str] = ""
    cycle_vulnerability: Optional[float] = 0.0
    mood_score:          Optional[float] = 3.0
    risk_level:          Optional[str]   = "low"
    emotion_detected:    Optional[str]   = "neutral"
    sentiment_score:     Optional[float] = 0.5


class TranscribeRequest(BaseModel):
    audioBase64: str
    language:    Optional[str] = "ta"


@router.post("")
async def chat(request: ChatRequest):
    start_ms = int(time.time() * 1000)

    # Quick crisis check on chat message
    try:
        pipe   = get_crisis_pipe()
        result = pipe(request.message)[0]
        is_crisis_label = result["label"].lower() == "crisis"
        raw_score       = result["score"]
        crisis_prob     = raw_score if is_crisis_label else (1 - raw_score)
    except Exception:
        crisis_prob = 0.0

    # Detect language for response style
    detected_lang = detect_language(request.message)
    lang = detected_lang if detected_lang != "en" else (request.language or "en")

    # Generate Gemma response with full context
    ai_result = await generate_response(
        message             = request.message,
        language            = lang,
        cycle_vulnerability = request.cycle_vulnerability or 0.0,
        mood_score          = request.mood_score          or 3.0,
        risk_level          = request.risk_level          or "low",
        emotion_detected    = request.emotion_detected    or "neutral",
        sentiment_score     = request.sentiment_score     or 0.5
    )

    suggestions = []
    if crisis_prob > 0.85:
        suggestions = ["Talk to a professional", "NIMHANS helpline: 080-46110007", "iCall: 9152987821"]
    elif crisis_prob > 0.6:
        suggestions = ["Consider talking to a counsellor"]
    elif request.risk_level in ["high", "crisis"]:
        suggestions = ["Breathing exercise available", "Try the grounding technique"]

    return {
        "reply":             ai_result["reply"],
        "modelUsed":         ai_result["modelUsed"],
        "isCrisis":          crisis_prob > 0.85,
        "crisisProbability": round(crisis_prob, 4),
        "emotionDetected":   request.emotion_detected,
        "sentimentScore":    request.sentiment_score,
        "suggestions":       suggestions,
        "language":          lang,
        "responseTimeMs":    int(time.time() * 1000) - start_ms,
        "sarvamMocked":      is_mocked()
    }


@router.post("/transcribe")
async def transcribe(request: TranscribeRequest):
    result = await transcribe_audio(request.audioBase64, request.language)
    return result
