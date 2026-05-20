# utils/gemma_client.py — Minimax-m2.7 via NVIDIA API (Swapped from local Gemma)
import os
from openai import AsyncOpenAI
import logging

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")

# If NVIDIA_API_KEY is not set, we'll fall back to the static responses
if NVIDIA_API_KEY:
    client = AsyncOpenAI(
        api_key=NVIDIA_API_KEY,
        base_url="https://integrate.api.nvidia.com/v1"
    )
else:
    client = None

MODEL_NAME = "minimaxai/minimax-m2.7"

SYSTEM_PROMPT = """You are Niranthara, a compassionate AI mental health companion. You deeply understand English and Tanglish (code-mixed English used in India).

Core principles:
- Respond in the exact language and style the user writes in
- If they write Tanglish, respond in Tanglish
- Be warm, gentle, non-judgmental
- Use CBT and grounding techniques naturally — not formulaically
- NEVER diagnose or prescribe medication
- NEVER give specific medical advice
- ALWAYS recommend professionals for serious concerns
- Understand Indian cultural context: family pressure, stigma, suppression
- Create space for honest expression — users may minimize their distress"""

FALLBACK_RESPONSES = {
    "en": "I'm here with you. What you're feeling is valid. Would you like to tell me more about what's on your mind today?",
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
    Generate context-aware response via NVIDIA API (Minimax-m2.7).
    Falls back to static culturally-appropriate response if API is unreachable or key is missing.
    """
    if not client:
        return {
            "reply": FALLBACK_RESPONSES.get(language, FALLBACK_RESPONSES["en"]),
            "modelUsed": "fallback_missing_nvidia_key"
        }

    context = _build_context(cycle_vulnerability, mood_score, risk_level, emotion_detected, sentiment_score)
    prompt  = f"[Internal context — do not mention explicitly]\n{context}\n\nUser: {message}\n\nNiranthara:"

    try:
        completion = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=1.0,
            top_p=0.95,
            max_tokens=250,
            stream=False
        )
        
        reply = completion.choices[0].message.content.strip()
        if not reply:
            raise ValueError("Empty response from NVIDIA API")
            
        return {"reply": reply, "modelUsed": "nvidia-minimax-m2.7"}
        
    except Exception as e:
        logging.error(f"NVIDIA API Error: {str(e)}")
        # Graceful fallback — warm static response, NOT keyword-matched
        return {
            "reply":      FALLBACK_RESPONSES.get(language, FALLBACK_RESPONSES["en"]),
            "modelUsed":  "fallback_api_error",
            "fallbackReason": str(e)
        }

