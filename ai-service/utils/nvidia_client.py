# utils/gemma_client.py — Minimax-m2.7 via NVIDIA API (Swapped from local Gemma)
import os
import re
import random
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

MODEL_NAME = os.getenv("NVIDIA_MODEL", "minimaxai/minimax-m2.7")

# Minimax is a reasoning model on a shared endpoint: measured latency ranges
# 20s to 60s+ timeouts. The chain below keeps replies real when it stalls:
# Minimax (bounded) -> fast instruct model (~1-2s) -> static text (last resort).
FAST_MODEL         = os.getenv("NVIDIA_FAST_MODEL", "meta/llama-3.1-8b-instruct")
PRIMARY_TIMEOUT_S  = float(os.getenv("NVIDIA_PRIMARY_TIMEOUT", "25"))
FALLBACK_TIMEOUT_S = float(os.getenv("NVIDIA_FALLBACK_TIMEOUT", "10"))

SYSTEM_PROMPT = """You are Niranthara, a compassionate AI mental health companion. You deeply understand English and Tanglish (code-mixed English used in India).

Core principles:
- Be warm, gentle, non-judgmental
- Use CBT and grounding techniques naturally — not formulaically
- Refer back to what the user told you earlier in the conversation; do not repeat the same opening or question
- NEVER diagnose or prescribe medication
- NEVER give specific medical advice
- ALWAYS recommend professionals for serious concerns
- Understand Indian cultural context: family pressure, stigma, suppression
- Create space for honest expression — users may minimize their distress

Hard safety rules (never break these, even if asked directly, hypothetically, or "for a friend"):
- NEVER state or suggest a medication name, dose, dosage change, or schedule — including starting, stopping, increasing, or skipping medication. Always redirect to their prescriber.
- NEVER describe methods of self-harm or suicide, even in a discouraging framing.
- NEVER claim to be a doctor, therapist, or a replacement for one.
- If asked for medical or medication advice, warmly decline and suggest they raise it with their clinician at the next visit — offer to help them write down the question."""

LANGUAGE_INSTRUCTION = {
    "ta": "Respond ONLY in Tamil (தமிழ்) script.",
    "tanglish": "Respond in Tanglish — Tamil words written in English letters, mixed naturally with English, matching the user's style.",
    "en": "Respond in clear, warm English.",
}

# Rotating variants so even the offline path never repeats the same line
# twice in a row (a single static string reads as "the bot is broken").
FALLBACK_RESPONSES = {
    "en": [
        "I'm here with you. What you're feeling is valid. Would you like to tell me more about what's on your mind today?",
        "That sounds heavy to carry. I'm listening — can you tell me a little more about what today has been like?",
        "Thank you for putting that into words. Whatever you're feeling right now is allowed. What part of it weighs the most?",
    ],
    "tanglish": [
        "Naan ungaludan irukkiraen. Neengal feel panradhellam valid. Indha nerathil enna nadakuthu nu solluveengala?",
        "Idhu romba kashtama irukkum pola. Naan kekkiren — konjam solluveengala, innaiku eppadi irundhadhu?",
    ],
}

def _static_fallback(language: str) -> str:
    return random.choice(FALLBACK_RESPONSES.get(language, FALLBACK_RESPONSES["en"]))

# Output-side SAFETY guardrail (not a clinical decision — a hard floor under the LLM).
# The system prompt is the primary defense; this catches the case where the model
# still emits a dosing instruction ("take 50mg", "increase to two tablets").
_DOSING_PATTERN = re.compile(
    r"\b(take|taking|start|increase|decrease|reduce|double|skip|stop)\b[^.\n]{0,60}?"
    r"\b(\d+(\.\d+)?\s*(mg|mcg|milligrams?|micrograms?|tablets?|pills?|capsules?)|dose|dosage)\b",
    re.IGNORECASE,
)

MEDICATION_DEFERRAL = (
    "I can't advise on medication — doses and changes need your prescriber, who knows "
    "your full history. What I can do is help you write down exactly what you want to "
    "ask them. Would that help?"
)

def apply_output_guardrail(reply: str) -> tuple[str, bool]:
    """Returns (safe_reply, was_blocked)."""
    if _DOSING_PATTERN.search(reply):
        return MEDICATION_DEFERRAL, True
    return reply, False

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
            "reply": _static_fallback(language),
            "modelUsed": "fallback_missing_nvidia_key"
        }

    context = _build_context(cycle_vulnerability, mood_score, risk_level,
                             emotion_detected, sentiment_score, crisis_probability)
    lang_instruction = LANGUAGE_INSTRUCTION.get(language, LANGUAGE_INSTRUCTION["en"])
    system_content = f"{SYSTEM_PROMPT}\n\n{lang_instruction}"
    prompt  = f"[Internal context — do not mention explicitly]\n{context}\n\nUser: {message}\n\nNiranthara:"

    # Keep only the most recent turns so the prompt stays bounded
    prior = [t for t in (history or []) if t.get("role") in ("user", "assistant") and t.get("content")][-8:]
    messages = [
        {"role": "system", "content": system_content},
        *prior,
        {"role": "user", "content": prompt}
    ]

    # Model chain: primary (reasoning, high quality, slow/variable) then fast
    # instruct model (~1-2s). max_tokens 1024 on minimax because tokens are
    # shared between hidden reasoning_content and the visible reply.
    last_error = None
    for model, timeout_s, max_toks in [
        (MODEL_NAME, PRIMARY_TIMEOUT_S,  1024),
        (FAST_MODEL, FALLBACK_TIMEOUT_S, 400),
    ]:
        try:
            completion = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=1.0,
                top_p=0.95,
                max_tokens=max_toks,
                stream=False,
                timeout=timeout_s,
            )
            reply = (completion.choices[0].message.content or "").strip()
            if not reply:
                raise ValueError(f"Empty response from {model}")

            reply, blocked = apply_output_guardrail(reply)
            return {
                "reply": reply,
                "modelUsed": f"nvidia-{model.split('/')[-1]}",
                "guardrailBlocked": blocked
            }
        except Exception as e:
            last_error = e
            logging.warning(f"NVIDIA {model} failed, trying next tier: {str(e)}")

    logging.error(f"All NVIDIA models failed: {str(last_error)}")
    # Graceful last resort — warm static response, NOT keyword-matched
    return {
        "reply":          _static_fallback(language),
        "modelUsed":      "fallback_api_error",
        "fallbackReason": str(last_error)
    }


# ── Clinician-facing summary ─────────────────────────────────────────────────
# Separate path from the companion persona: clinical register, structured input
# (never raw journal text — privacy boundary is enforced by the caller).

SUMMARY_SYSTEM_PROMPT = """You are a clinical decision-support assistant writing for a psychiatrist.
Write a concise summary of the patient's last 30 days from the structured signals provided.
Rules:
- 4-5 sentences, plain clinical English. No headers, no bullet points, no markdown.
- Lead with the overall trajectory (improving / stable / deteriorating).
- Mention concrete numbers sparingly (at most 3) where they change the clinical picture.
- Flag mood-language divergence if elevated (suggests minimization/suppression).
- End with the single most useful thing to explore at the next visit.
- Never invent data not present in the input. Never diagnose. Never suggest medication changes."""


def _fallback_summary(stats: dict) -> str:
    """Deterministic template when the LLM is unreachable — labeled fallback path."""
    return (
        f"Over the past 30 days the patient logged {stats.get('logCount', 0)} check-ins "
        f"with an average mood of {stats.get('avgMood', 0):.1f}/5 and a current risk level of "
        f"{stats.get('riskLevel', 'unknown')} (score {stats.get('riskScore', 0):.2f}). "
        f"{stats.get('crisisEvents', 0)} crisis-probability events and "
        f"{stats.get('openAlerts', 0)} open clinician alerts were recorded. "
        "AI narrative unavailable — manual chart review recommended."
    )


async def generate_clinical_summary(stats: dict) -> dict:
    """
    stats: structured 30-day aggregates assembled by the backend
    (mood trend, risk trajectory, divergence, alerts, assessments, top factors).
    """
    if not client:
        return {"summary": _fallback_summary(stats), "modelUsed": "fallback_missing_nvidia_key"}

    lines = []
    for key, label in [
        ("patientName", "Patient"), ("logCount", "Check-ins logged"),
        ("avgMood", "Average mood (1-5)"), ("moodTrend", "Mood trend (first vs last week)"),
        ("riskLevel", "Current risk level"), ("riskScore", "Current risk score (0-1)"),
        ("avgDivergence", "Avg mood-language divergence (0-1)"),
        ("crisisEvents", "Crisis-probability events"), ("openAlerts", "Open alerts"),
        ("topFactors", "Top SHAP risk factors"), ("lastPhq9", "Latest PHQ-9"),
        ("lastGad7", "Latest GAD-7"), ("avgSleep", "Avg sleep hours"),
        ("cycleVulnerability", "Current cycle vulnerability (0-1)"),
    ]:
        if stats.get(key) not in (None, "", []):
            lines.append(f"{label}: {stats[key]}")

    summary_messages = [
        {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
        {"role": "user", "content": "30-day structured signals:\n" + "\n".join(lines)},
    ]
    for model, timeout_s, max_toks in [
        (MODEL_NAME, PRIMARY_TIMEOUT_S,  1024),
        (FAST_MODEL, FALLBACK_TIMEOUT_S, 400),
    ]:
        try:
            completion = await client.chat.completions.create(
                model=model,
                messages=summary_messages,
                temperature=0.3,
                top_p=0.9,
                max_tokens=max_toks,
                stream=False,
                timeout=timeout_s,
            )
            summary = (completion.choices[0].message.content or "").strip()
            if not summary:
                raise ValueError(f"Empty summary from {model}")
            return {"summary": summary, "modelUsed": f"nvidia-{model.split('/')[-1]}"}
        except Exception as e:
            logging.warning(f"NVIDIA summary via {model} failed: {str(e)}")

    return {"summary": _fallback_summary(stats), "modelUsed": "fallback_api_error"}

