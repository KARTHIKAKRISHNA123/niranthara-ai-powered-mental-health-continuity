# routers/emotion.py — distilroberta 7-class emotion per Build Guide §18

from fastapi import APIRouter
from pydantic import BaseModel
from transformers import pipeline
import torch
from utils.sarvam_client import translate_to_english
from utils.language_detector import detect_language
import os

router = APIRouter()

MODEL_NAME = os.getenv("EMOTION_MODEL", "j-hartmann/emotion-english-distilroberta-base")
emotion_pipeline = pipeline(
    "text-classification",
    model=MODEL_NAME,
    top_k=None,
    device=0 if torch.cuda.is_available() else -1
)

DISTRESS_EMOTIONS = {"sadness", "fear", "anger", "disgust"}


class EmotionRequest(BaseModel):
    text: str


class EmotionResponse(BaseModel):
    emotion:     str
    confidence:  float
    isDistress:  bool
    allEmotions: dict


@router.post("/detect", response_model=EmotionResponse)
async def detect_emotion(request: EmotionRequest):
    text     = request.text
    language = detect_language(text)

    # Translate Tamil/Tanglish — distilroberta is English-only
    if language in ["ta", "tanglish"]:
        text = await translate_to_english(text)

    results     = emotion_pipeline(text)[0]
    scores      = {r["label"]: round(r["score"], 4) for r in results}
    top_emotion = max(scores, key=scores.get)

    return EmotionResponse(
        emotion     = top_emotion,
        confidence  = scores[top_emotion],
        isDistress  = top_emotion in DISTRESS_EMOTIONS and scores[top_emotion] > 0.5,
        allEmotions = scores
    )
