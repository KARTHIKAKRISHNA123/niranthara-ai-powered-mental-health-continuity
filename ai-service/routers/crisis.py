# routers/crisis.py — mental-roberta crisis NLP classifier per Build Guide §16

from fastapi import APIRouter
from pydantic import BaseModel
from transformers import pipeline
import torch
from utils.sarvam_client import translate_to_english
from utils.language_detector import detect_language

router = APIRouter()

# Load model once at startup (GPU if available)
crisis_classifier = pipeline(
    "text-classification",
    model="mental/mental-roberta-base",
    device=0 if torch.cuda.is_available() else -1
)


class CrisisRequest(BaseModel):
    text: str
    uid:  str = ""


class CrisisResponse(BaseModel):
    crisisProbability:        float
    requiresImmediateAction:  bool   # > 0.75
    requiresGentleEscalation: bool   # > 0.35
    detectedLanguage:         str


@router.post("/detect", response_model=CrisisResponse)
async def detect_crisis(request: CrisisRequest):
    language       = detect_language(request.text)
    text_for_model = request.text

    # Translate Tamil/Tanglish for crisis model (mental-roberta is English-only)
    if language in ["ta", "tanglish"]:
        text_for_model = await translate_to_english(request.text)

    result        = crisis_classifier(text_for_model)[0]
    is_crisis     = result["label"].lower() == "crisis"
    raw_score     = result["score"]
    crisis_prob   = raw_score if is_crisis else (1 - raw_score)

    return CrisisResponse(
        crisisProbability        = round(crisis_prob, 4),
        requiresImmediateAction  = crisis_prob > 0.75,
        requiresGentleEscalation = crisis_prob > 0.35,
        detectedLanguage         = language
    )
