# routers/sentiment.py — multilingual sentiment (Ta / Tanglish / En)
#
# HISTORY — READ BEFORE CHANGING THE MODEL:
# This ran on `ai4bharat/indic-bert` with `num_labels=3`. indic-bert is a base
# ALBERT language model with NO sequence-classification head, so transformers
# silently minted a randomly initialised `classifier` layer (the startup log said
# `classifier.weight | MISSING` and nobody read it). Measured output was a
# constant ~0.338 for every input: "I am so happy today, everything is wonderful"
# scored 0.3386 and "I want to die, nothing matters anymore" scored 0.3379 —
# and both were labelled `negative`.
#
# That is the same failure that made the old crisis classifier decorative, and
# it was worse here, because moodRoutes derives mood-sentiment DIVERGENCE from
# this score. With a constant sentiment, divergence collapsed to a pure function
# of the mood slider and carried no information from the journal at all — while
# still being presented to clinicians as the product's signature insight.
#
# Two rules now enforced below:
#   1. The model must ship a real label map. A config whose labels are still
#      LABEL_0/1/2 means the head is untrained — we refuse to start rather than
#      serve confident noise.
#   2. Label positions are read from the model config, never hardcoded. The
#      previous code assumed [negative, neutral, positive] ordering; a model swap
#      that reorders them would have silently inverted the clinical signal.

from fastapi import APIRouter
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import torch.nn.functional as F
from utils.language_detector import detect_language
import os

router = APIRouter()

# XLM-R with a trained 3-class head. Multilingual, so Tamil script does not need
# the Sarvam translation hop that crisis.py performs for its English-only model.
# Deliberately does NOT honour the old INDICBERT_MODEL variable. ai-service/.env
# still sets it to ai4bharat/indic-bert, and reading it here would quietly restore
# the headless model this file exists to get rid of. Override with SENTIMENT_MODEL.
MODEL_NAME = os.getenv("SENTIMENT_MODEL", "cardiffnlp/twitter-xlm-roberta-base-sentiment")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model     = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
model.eval()
if torch.cuda.is_available():
    model = model.cuda()

# ── Head sanity check. This is the guard that was missing.
_id2label = {int(k): str(v).strip().lower() for k, v in model.config.id2label.items()}

if all(lab.startswith("label_") for lab in _id2label.values()):
    raise RuntimeError(
        f"{MODEL_NAME} has no trained classification head "
        f"(config labels are {list(_id2label.values())}). Its predictions would be "
        f"random noise held constant across inputs. Pick a model fine-tuned for "
        f"sentiment classification, not a base LM."
    )


def _index_of(*aliases):
    for idx, lab in _id2label.items():
        if lab in aliases:
            return idx
    raise RuntimeError(
        f"{MODEL_NAME} label map {_id2label} has no entry for {aliases}. "
        f"Sentiment positions must be resolved from the config, never assumed."
    )


NEG_IDX = _index_of("negative", "neg")
NEU_IDX = _index_of("neutral", "neu")
POS_IDX = _index_of("positive", "pos")
_LABEL_BY_IDX = {NEG_IDX: "negative", NEU_IDX: "neutral", POS_IDX: "positive"}

print(f"[sentiment] {MODEL_NAME} ready — labels {_id2label}")


class SentimentRequest(BaseModel):
    text: str


class SentimentResponse(BaseModel):
    score:      float   # P(negative): 0 = positive, 1 = negative — the XGBoost feature
    label:      str     # negative | neutral | positive
    confidence: float
    language:   str


@router.post("/analyze", response_model=SentimentResponse)
async def analyze_sentiment(request: SentimentRequest):
    language = detect_language(request.text)
    text_for_model = request.text

    # NO translation hop here, unlike crisis.py — and that is a measured decision,
    # not an oversight.
    #
    # XLM-R was pretrained on Tamil SCRIPT, so Tamil script classifies well
    # (happy 0.07 positive / distress 0.86 negative) and goes straight through.
    # Romanised Tanglish is weaker: "innaiku nalla iruken, sandhosama iruken"
    # ("today I'm good, I'm happy") scores mildly negative. The obvious fix is the
    # Sarvam hop crisis.py uses — but measured, Sarvam INVERTS Tanglish distress:
    #   "enakku romba kastama iruku"  ("I'm in great distress")
    #        -> "I am very comfortable."          -> sentiment POSITIVE 0.03
    #   "...ellame mudinjiduchu"      ("everything is over")
    #        -> "I don't know what to cook."      -> sentiment neutral
    # Raw XLM-R on Tanglish errs toward negative; translated Tanglish errs toward
    # positive. In triage an over-negative sentiment costs a needless check-in,
    # while an over-positive one hides a deteriorating patient — so the raw path
    # is the safer failure mode and we keep it. Revisit only with a transliteration
    # -aware model, and re-probe both directions before trusting any change.

    inputs = tokenizer(
        text_for_model,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=True,
    )
    if torch.cuda.is_available():
        inputs = {k: v.cuda() for k, v in inputs.items()}

    with torch.no_grad():
        probs = F.softmax(model(**inputs).logits, dim=-1)[0].cpu()

    top = int(probs.argmax().item())

    return SentimentResponse(
        # Contract unchanged: `score` stays P(negative) so the XGBoost feature and
        # the divergence calculation in moodRoutes keep the same meaning.
        score      = round(float(probs[NEG_IDX].item()), 4),
        label      = _LABEL_BY_IDX.get(top, "neutral"),
        confidence = round(float(probs[top].item()), 4),
        language   = language,
    )
