# routers/sentiment.py — IndicBERT Tamil/EN sentiment per Build Guide §17

from fastapi import APIRouter
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import torch.nn.functional as F
from utils.language_detector import detect_language
import os

router = APIRouter()

MODEL_NAME = os.getenv("INDICBERT_MODEL", "ai4bharat/indic-bert")
tokenizer  = AutoTokenizer.from_pretrained(MODEL_NAME)
model      = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME, num_labels=3)
model.eval()
if torch.cuda.is_available():
    model = model.cuda()


class SentimentRequest(BaseModel):
    text: str


class SentimentResponse(BaseModel):
    score:      float   # negative probability (0=positive, 1=negative) — XGBoost feature
    label:      str     # negative | neutral | positive
    confidence: float
    language:   str


@router.post("/analyze", response_model=SentimentResponse)
async def analyze_sentiment(request: SentimentRequest):
    language = detect_language(request.text)

    inputs = tokenizer(
        request.text,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=True
    )
    if torch.cuda.is_available():
        inputs = {k: v.cuda() for k, v in inputs.items()}

    with torch.no_grad():
        probs = F.softmax(model(**inputs).logits, dim=-1)[0].cpu()

    # Labels: [negative=0, neutral=1, positive=2]
    labels    = ["negative", "neutral", "positive"]
    label_idx = int(probs.argmax().item())

    return SentimentResponse(
        score      = round(float(probs[0].item()), 4),  # negative probability for XGBoost feature
        label      = labels[label_idx],
        confidence = round(float(probs[label_idx].item()), 4),
        language   = language
    )
