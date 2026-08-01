# utils/crisis_classifier.py
# Single source of truth for crisis probability.
#
# WHY THIS MODULE EXISTS
# ---------------------
# crisis.py and chat.py each built their own pipeline against
# "mental/mental-roberta-base". That checkpoint is a *pretrained language
# model*, not a fine-tuned classifier: it ships no classification head, so
# transformers silently initialises `classifier.out_proj` at random
# ("MISSING | newly initialized"). The result was a constant, text-independent
# score. Measured on the old model:
#
#     "I want to end my life tonight"              -> 0.5362  (LABEL_1)
#     "I am so happy today, everything is wonderful"-> 0.5269  (LABEL_1)
#     "the sky is blue and I ate rice"              -> 0.5262  (LABEL_1)
#
# Every input produced crisisProbability ~0.465. Nothing ever crossed the 0.50
# alert gate or the 0.85 chat-crisis gate, so crisis detection had never fired.
#
# sentinet/suicidality is an ELECTRA classifier actually fine-tuned for
# suicidality detection (CC0). Measured on the same inputs:
#
#     "I want to end my life tonight"                -> 0.9945 (LABEL_1)
#     "I keep telling everyone I'm fine but ..."     -> 0.9892 (LABEL_1)
#     "I have been feeling low and cannot sleep"     -> 0.0023 (LABEL_0)
#     "the sky is blue and I ate rice"               -> 0.0009 (LABEL_0)
#
# LABEL_1 = suicidality present, LABEL_0 = absent.
#
# If you swap CRISIS_MODEL, verify the new checkpoint actually discriminates
# before trusting it — a flat score across those four probes means the head is
# untrained and the model is decorative.

import os
import logging
import torch
from transformers import pipeline

CRISIS_MODEL = os.getenv("CRISIS_MODEL", "sentinet/suicidality")

# Checkpoints whose "positive" class is index 1 under a LABEL_n naming scheme.
# Anything exposing a readable label (e.g. "suicidal", "crisis") is matched by
# name instead, so a future model with proper id2label needs no change here.
_POSITIVE_NAMES = {"label_1", "suicidal", "suicide", "crisis", "risk", "positive"}

_pipe = None


def get_pipe():
    """Lazily build the classifier. Safe to call from multiple routers."""
    global _pipe
    if _pipe is None:
        _pipe = pipeline(
            "text-classification",
            model=CRISIS_MODEL,
            device=0 if torch.cuda.is_available() else -1,
        )
        logging.info(f"[crisis] classifier ready: {CRISIS_MODEL}")
    return _pipe


def crisis_probability(text: str) -> float:
    """
    P(suicidality present) in [0, 1].

    Returns 0.0 if the model is unavailable — a failed classifier must not
    manufacture risk, and the XGBoost path still carries the risk signal.
    """
    if not text or not text.strip():
        return 0.0
    try:
        result = get_pipe()(text, truncation=True, max_length=512)[0]
        label = str(result["label"]).strip().lower()
        score = float(result["score"])
        return round(score if label in _POSITIVE_NAMES else 1.0 - score, 4)
    except Exception as e:
        logging.warning(f"[crisis] classification failed: {e}")
        return 0.0


def warm_up():
    """Pay the model-load cost at startup, not on the user's first message."""
    try:
        crisis_probability("warm up")
        logging.info("[crisis] warm-up complete")
    except Exception as e:
        logging.warning(f"[crisis] warm-up failed: {e}")
