# utils/sarvam_client.py
# Sarvam AI STT + translation client
# CURRENTLY MOCKED — add SARVAM_API_KEY to .env when available
# To enable real API: uncomment the httpx sections and set SARVAM_API_KEY

import os
import httpx
from utils.language_detector import detect_language

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
MOCK_MODE      = not SARVAM_API_KEY or SARVAM_API_KEY == "REPLACE_WITH_SARVAM_KEY"

# ── Mock translations for common Tamil/Tanglish mental health phrases ─────
MOCK_TRANSLATIONS = {
    "romba sad ah irukken": "I am feeling very sad",
    "romba kashtama iruku": "Life is very difficult",
    "life kashtama iruku": "Life is difficult right now",
    "ennaku tiredness iruku": "I am feeling tired",
    "thala suthudhu": "I am feeling dizzy and overwhelmed",
    "nothing pannanum pola illai": "I don't feel like doing anything",
    "cry pannanum pola iruku": "I feel like crying",
    "enakku help vennum": "I need help",
}


async def translate_to_english(text: str) -> str:
    """
    Translate Tamil or Tanglish text to English.
    MOCK MODE: Returns mock translation or signals for NLP models.
    REAL MODE: Uses Sarvam AI mayura:v1 translation model.
    """
    if MOCK_MODE:
        # Check for mock match (partial)
        text_lower = text.lower().strip()
        for phrase, translation in MOCK_TRANSLATIONS.items():
            if phrase in text_lower:
                return translation
        # Fallback: return text as-is (IndicBERT handles Tanglish natively)
        return text

    # Real Sarvam API call
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            "https://api.sarvam.ai/translate",
            headers={"api-subscription-key": SARVAM_API_KEY},
            json={
                "input":                text,
                "source_language_code": "ta-IN",
                "target_language_code": "en-IN",
                "model":                "mayura:v1"
            }
        )
        return r.json().get("translated_text", text)


async def transcribe_audio(audio_base64: str, language: str = "ta") -> dict:
    """
    Transcribe audio to text using Sarvam STT (saarika:v1).
    MOCK MODE: Returns a placeholder transcription message.
    REAL MODE: Uses Sarvam AI saarika:v1 speech-to-text model.
    """
    if MOCK_MODE:
        return {
            "transcript":       "[Voice input — Sarvam API key not configured]",
            "detectedLanguage": language,
            "mock":             True
        }

    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(
            "https://api.sarvam.ai/speech-to-text",
            headers={"api-subscription-key": SARVAM_API_KEY},
            json={
                "model":         "saarika:v1",
                "language_code": "ta-IN",
                "audio":         audio_base64
            }
        )
        data = r.json()
        return {
            "transcript":       data.get("transcript", ""),
            "detectedLanguage": detect_language(data.get("transcript", "")),
            "mock":             False
        }


def is_mocked() -> bool:
    return MOCK_MODE
