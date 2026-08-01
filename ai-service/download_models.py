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

print("\n[3/3] Downloading IndicBERT Tamil/English sentiment (ai4bharat/indic-bert)...")
AutoTokenizer.from_pretrained("ai4bharat/indic-bert")
AutoModelForSequenceClassification.from_pretrained("ai4bharat/indic-bert", num_labels=3)
print("✓ IndicBERT ready")

print("\n[4/4] Training XGBoost risk model (generates synthetic dataset)...")
from models.model_trainer import train
train()
print("✓ XGBoost risk model ready")

print("\n" + "=" * 50)
print("All models ready. Start the service:")
print("  uvicorn main:app --reload --port 8000")
print("  Then visit: http://localhost:8000/docs")
print("=" * 50)
