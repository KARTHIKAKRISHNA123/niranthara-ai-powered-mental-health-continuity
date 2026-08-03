# download_models.py — One-time download of all NLP models
# Run once after setting up the virtual environment:
#   python download_models.py

from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
import os

print("=" * 50)
print("Niranthara — Model Download Script")
print("=" * 50)

# sentinet/suicidality is an ELECTRA classifier fine-tuned for suicidality.
# Do NOT revert to mental/mental-roberta-base: it has no classification head,
# so transformers initialises one at random and every input scores ~0.53.
CRISIS_MODEL = os.getenv("CRISIS_MODEL", "sentinet/suicidality")
print(f"\n[1/3] Downloading crisis detector ({CRISIS_MODEL})...")
pipeline("text-classification", model=CRISIS_MODEL)
print("✓ Crisis model ready")

print("\n[2/3] Downloading emotion detector (j-hartmann/emotion-english-distilroberta-base)...")
pipeline("text-classification", model="j-hartmann/emotion-english-distilroberta-base", top_k=None)
print("✓ Emotion model ready")

# Do NOT revert to ai4bharat/indic-bert. Same trap as the crisis model above: it
# is a base ALBERT LM with no classification head, so `num_labels=3` mints a
# random one and every input scores a constant ~0.338 — which silently destroyed
# the mood-sentiment divergence signal that moodRoutes derives from it.
SENTIMENT_MODEL = os.getenv("SENTIMENT_MODEL", "cardiffnlp/twitter-xlm-roberta-base-sentiment")
print(f"\n[3/4] Downloading multilingual sentiment ({SENTIMENT_MODEL})...")
AutoTokenizer.from_pretrained(SENTIMENT_MODEL)
_sent = AutoModelForSequenceClassification.from_pretrained(SENTIMENT_MODEL)
assert not all(str(v).lower().startswith("label_") for v in _sent.config.id2label.values()), (
    f"{SENTIMENT_MODEL} has no trained head — its labels are {_sent.config.id2label}"
)
print(f"✓ Sentiment model ready — labels {_sent.config.id2label}")

print("\n[4/4] Training XGBoost risk model (generates synthetic dataset)...")
from models.model_trainer import train
train()
print("✓ XGBoost risk model ready")

print("\n" + "=" * 50)
print("All models ready. Start the service:")
print("  uvicorn main:app --reload --port 8000")
print("  Then visit: http://localhost:8000/docs")
print("=" * 50)
