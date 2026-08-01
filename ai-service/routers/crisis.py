# routers/crisis.py — crisis NLP classifier per Build Guide §16
#
# Classification lives in utils/crisis_classifier.py so this router and chat.py
# share one implementation. See that module for why the previous checkpoint
# (mental/mental-roberta-base) returned a constant score for every input.

from fastapi import APIRouter
from pydantic import BaseModel
from utils.crisis_classifier import crisis_probability, CRISIS_MODEL
from utils.sarvam_client import translate_to_english
from utils.language_detector import detect_language

router = APIRouter()


class CrisisRequest(BaseModel):
    text: str
    uid:  str = ""


class CrisisResponse(BaseModel):
    crisisProbability:        float
    requiresImmediateAction:  bool   # > 0.75
    requiresGentleEscalation: bool   # > 0.35
    detectedLanguage:         str
    modelUsed:                str


@router.post("/detect", response_model=CrisisResponse)
async def detect_crisis(request: CrisisRequest):
    language       = detect_language(request.text)
    text_for_model = request.text

    # The classifier is English-only — translate Tamil/Tanglish first.
    if language in ["ta", "tanglish"]:
        text_for_model = await translate_to_english(request.text)

    crisis_prob = crisis_probability(text_for_model)

    return CrisisResponse(
        crisisProbability        = crisis_prob,
        requiresImmediateAction  = crisis_prob > 0.75,
        requiresGentleEscalation = crisis_prob > 0.35,
        detectedLanguage         = language,
        modelUsed                = CRISIS_MODEL
    )
