# utils/gemma_client.py — Gemma 4B via Ollama CUDA, per Build Guide §22

import httpx
import os
import psutil

OLLAMA_URL  = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
GEMMA_MODEL = os.getenv("GEMMA_MODEL", "gemma:4b")

SYSTEM_PROMPT = """You are Niranthara, a compassionate AI mental health companion for Indian women. You deeply understand Tamil, Tanglish (code-mixed Tamil-English as spoken in Tamil Nadu), and English.

Core principles:
- Respond in the exact language and style the user writes in
- If they write Tanglish, respond in Tanglish — not formal Tamil or English
- Be warm, gentle, non-judgmental
- Use CBT and grounding techniques naturally — not formulaically
- NEVER diagnose or prescribe medication
- NEVER give specific medical advice
- ALWAYS recommend professionals for serious concerns
- Understand Indian cultural context: family pressure, stigma, suppression
- Create space for honest expression — women may minimize their distress"""

FALLBACK_RESPONSES = {
    "en": "I'm here with you. What you're feeling is valid. Would you like to tell me more about what's on your mind today?",
    "ta": "நான் உங்களுடன் இருக்கிறேன். நீங்கள் உணர்வது முக்கியம். இன்று என்ன நடக்கிறது என்று சொல்ல விரும்புகிறீர்களா?",
    "tanglish": "Naan ungaludan irukkiraen. Neengal feel panradhellam valid. Indha nerathil enna nadakuthu nu solluveengala?"
}


def _build_context(cycle_vuln: float, mood: float, risk: str,
                   emotion: str, sentiment: float) -> str:
    notes = []
    if cycle_vuln > 0.7:
        notes.append("High hormonal vulnerability window. Be extra gentle and validating.")
    if emotion in {"sadness", "fear", "anger"}:
        notes.append(f"Primary emotion: {emotion}. Validate before suggesting anything.")
    if mood <= 2:
        notes.append("Very low mood. Focus on empathy only — no advice or suggestions yet.")
    if risk in ["high", "crisis"]:
        notes.append("Elevated risk. Gently mention professional support and NIMHANS: 080-46110007")
    if sentiment > 0.7 and mood >= 3:
        notes.append("User expresses more distress in words than stated mood. Create space for honesty.")
    return " | ".join(notes) or "User seems okay. Be warm and engaging."


async def generate_response(
    message: str,
    language: str = "en",
    cycle_vulnerability: float = 0.0,
    mood_score: float = 3.0,
    risk_level: str = "low",
    emotion_detected: str = "neutral",
    sentiment_score: float = 0.5
) -> dict:
    """
    Generate context-aware response via Gemma 4B.
    Falls back to static culturally-appropriate response if:
    - Ollama is unreachable
    - Available RAM < 3GB
    """
    # Low-RAM check
    available_gb = psutil.virtual_memory().available / (1024 ** 3)
    if available_gb < 3.0:
        return {"reply": FALLBACK_RESPONSES.get(language, FALLBACK_RESPONSES["en"]), "modelUsed": "fallback_low_ram"}

    context = _build_context(cycle_vulnerability, mood_score, risk_level, emotion_detected, sentiment_score)
    prompt  = f"[Internal context — do not mention explicitly]\n{context}\n\nUser: {message}\n\nNiranthara:"

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            result = await client.post(f"{OLLAMA_URL}/api/generate", json={
                "model":   GEMMA_MODEL,
                "prompt":  prompt,
                "system":  SYSTEM_PROMPT,
                "stream":  False,
                "options": {"num_gpu": 1, "temperature": 0.75, "top_p": 0.9, "num_predict": 250}
            })
        reply = result.json().get("response", "").strip()
        if not reply:
            raise ValueError("Empty response from Ollama")
        return {"reply": reply, "modelUsed": "gemma4b"}
    except Exception as e:
        # Graceful fallback — warm static response, NOT keyword-matched
        return {
            "reply":      FALLBACK_RESPONSES.get(language, FALLBACK_RESPONSES["en"]),
            "modelUsed":  "fallback",
            "fallbackReason": str(e)
        }
