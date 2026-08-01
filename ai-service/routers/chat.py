# routers/chat.py — Full NLP pipeline + NVIDIA model chain, context-aware response

import time
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from utils.nvidia_client import generate_response, generate_clinical_summary
from utils.sarvam_client import transcribe_audio, is_mocked
from utils.language_detector import detect_language
from utils.crisis_classifier import crisis_probability

router = APIRouter()


class ChatTurn(BaseModel):
    role:    str
    content: str


class ChatRequest(BaseModel):
    message:             str
    language:            Optional[str] = "en"
    uid:                 Optional[str] = ""
    cycle_vulnerability: Optional[float] = 0.0
    mood_score:          Optional[float] = 3.0
    risk_level:          Optional[str]   = "low"
    emotion_detected:    Optional[str]   = "neutral"
    sentiment_score:     Optional[float] = 0.5
    history:             Optional[list[ChatTurn]] = None


class TranscribeRequest(BaseModel):
    audioBase64: str
    language:    Optional[str] = "ta"


@router.post("")
async def chat(request: ChatRequest):
    start_ms = int(time.time() * 1000)

    # Crisis check on the chat message — same classifier as /api/crisis/detect
    crisis_prob = crisis_probability(request.message)

    # Detect language for response style
    detected_lang = detect_language(request.message)
    lang = detected_lang if detected_lang != "en" else (request.language or "en")
    # No Tamil font is shipped in the apps — Tamil-script input still gets an
    # understanding reply, but written in Tanglish (Latin script renders
    # correctly on every device). English-only product decision, July 2026.
    if lang == "ta":
        lang = "tanglish"

    # Generate response with full context + prior turns for multi-turn memory
    history = [t.model_dump() for t in request.history] if request.history else None
    ai_result = await generate_response(
        message             = request.message,
        language            = lang,
        cycle_vulnerability = request.cycle_vulnerability or 0.0,
        mood_score          = request.mood_score          or 3.0,
        risk_level          = request.risk_level          or "low",
        emotion_detected    = request.emotion_detected    or "neutral",
        sentiment_score     = request.sentiment_score     or 0.5,
        crisis_probability  = crisis_prob,
        history             = history
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


class SummaryRequest(BaseModel):
    # Structured 30-day aggregates only — the backend never sends raw journal
    # or chat text here (privacy boundary).
    patientName:        Optional[str]   = None
    logCount:           Optional[int]   = 0
    avgMood:            Optional[float] = None
    moodTrend:          Optional[str]   = None
    riskLevel:          Optional[str]   = None
    riskScore:          Optional[float] = None
    avgDivergence:      Optional[float] = None
    crisisEvents:       Optional[int]   = 0
    openAlerts:         Optional[int]   = 0
    topFactors:         Optional[list[str]] = None
    lastPhq9:           Optional[str]   = None
    lastGad7:           Optional[str]   = None
    avgSleep:           Optional[float] = None
    cycleVulnerability: Optional[float] = None


@router.post("/summary")
async def clinical_summary(request: SummaryRequest):
    """Clinician-facing 30-day narrative from structured signals (no raw text)."""
    return await generate_clinical_summary(request.model_dump())


@router.post("/transcribe")
async def transcribe(request: TranscribeRequest):
    result = await transcribe_audio(request.audioBase64, request.language)
    return result
