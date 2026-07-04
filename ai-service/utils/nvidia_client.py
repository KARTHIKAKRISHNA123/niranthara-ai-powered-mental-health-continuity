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
- Be warm, gentle, non-judgmental
- Use CBT and grounding techniques naturally — not formulaically
- Refer back to what the user told you earlier in the conversation; do not repeat the same opening or question
- NEVER diagnose or prescribe medication
- NEVER give specific medical advice
- ALWAYS recommend professionals for serious concerns
- Understand Indian cultural context: family pressure, stigma, suppression
- Create space for honest expression — users may minimize their distress"""

LANGUAGE_INSTRUCTION = {
    "ta": "Respond ONLY in Tamil (தமிழ்) script.",
    "tanglish": "Respond in Tanglish — Tamil words written in English letters, mixed naturally with English, matching the user's style.",
    "en": "Respond in clear, warm English.",
}

FALLBACK_RESPONSES = {
    "en": "I'm here with you. What you're feeling is valid. Would you like to tell me more about what's on your mind today?",
    "tanglish": "Naan ungaludan irukkiraen. Neengal feel panradhellam valid. Indha nerathil enna nadakuthu nu solluveengala?"
}

def _build_context(cycle_vuln: float, mood: float, risk: str,
                   emotion: str, sentiment: float, crisis_prob: float = 0.0) -> str:
    notes = []
    if crisis_prob > 0.75:
        notes.append("This message shows HIGH crisis risk. Be warm, direct, and gently ask if they are safe right now. Offer to connect them to a counsellor.")
    elif crisis_prob > 0.35:
        notes.append("This message shows moderate distress. Be gentle and check in on how they are really feeling.")
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
    sentiment_score: float = 0.5,
    crisis_probability: float = 0.0,
    history: list = None
) -> dict:
    """
    Generate context-aware, multi-turn response via NVIDIA API (Minimax-m2.7).
    `history` is a list of {"role": "user"|"assistant", "content": str} for prior turns.
    Falls back to static culturally-appropriate response if API is unreachable or key is missing.
    """
    if not client:
        return {
            "reply": FALLBACK_RESPONSES.get(language, FALLBACK_RESPONSES["en"]),
            "modelUsed": "fallback_missing_nvidia_key"
        }

    context = _build_context(cycle_vulnerability, mood_score, risk_level,
                             emotion_detected, sentiment_score, crisis_probability)
    lang_instruction = LANGUAGE_INSTRUCTION.get(language, LANGUAGE_INSTRUCTION["en"])
    system_content = f"{SYSTEM_PROMPT}\n\n{lang_instruction}"
    prompt  = f"[Internal context — do not mention explicitly]\n{context}\n\nUser: {message}\n\nNiranthara:"

    # Keep only the most recent turns so the prompt stays bounded
    prior = [t for t in (history or []) if t.get("role") in ("user", "assistant") and t.get("content")][-8:]

    try:
        completion = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_content},
                *prior,
                {"role": "user", "content": prompt}
            ],
            temperature=1.0,
            top_p=0.95,
            max_tokens=1024,  # minimax-m2.7 is a reasoning model: tokens are shared between
                              # hidden reasoning_content and the visible reply. 250 risked an
                              # empty reply (→ static fallback) once reasoning grew; 1024 gives headroom.
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

