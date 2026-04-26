<div align="center">

<img src="https://img.shields.io/badge/🏆_Niral_Thiruvizha_3.0-Top_500_Teams-FFD700?style=for-the-badge&labelColor=2C2826" />
<img src="https://img.shields.io/badge/Tamil_Nadu_Govt_Grant-₹15,000-C97B84?style=for-the-badge&labelColor=8B4A52" />
<img src="https://img.shields.io/badge/Anna_University-Tirunelveli-7BA68A?style=for-the-badge&labelColor=3D6B4A" />

<br/><br/>

# நிரந்தர · Nirantara
### *உங்கள் மனம், எங்கள் அக்கறை*
**Your mind, our care.**

*An AI-powered mental health continuity platform that silently monitors, understands Tamil, and intervenes before crisis hits.*

<br/>

[![React Native](https://img.shields.io/badge/React_Native-Expo_SDK_50-61DAFB?style=flat-square&logo=react&logoColor=61DAFB&labelColor=1a1a2e)](https://reactnative.dev)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?style=flat-square&logo=node.js&logoColor=white&labelColor=1a1a2e)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.11_FastAPI-3776AB?style=flat-square&logo=python&logoColor=white&labelColor=1a1a2e)](https://fastapi.tiangolo.com)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore_·_FCM-FFCA28?style=flat-square&logo=firebase&logoColor=white&labelColor=1a1a2e)](https://firebase.google.com)
[![PyTorch](https://img.shields.io/badge/PyTorch-LSTM_·_CUDA-EE4C2C?style=flat-square&logo=pytorch&logoColor=white&labelColor=1a1a2e)](https://pytorch.org)
[![XGBoost](https://img.shields.io/badge/XGBoost-14_Feature_Fusion-337AB7?style=flat-square&logo=xgboost&logoColor=white&labelColor=1a1a2e)](https://xgboost.readthedocs.io)
[![HuggingFace](https://img.shields.io/badge/HuggingFace-Transformers-FFD21E?style=flat-square&logo=huggingface&logoColor=black&labelColor=1a1a2e)](https://huggingface.co)
[![Gemma](https://img.shields.io/badge/Gemma_4B-Ollama_·_RTX_3050-C97B84?style=flat-square&logo=google&logoColor=white&labelColor=1a1a2e)](https://ollama.com)
[![GCP](https://img.shields.io/badge/Google_Cloud-asia--south1-4285F4?style=flat-square&logo=googlecloud&logoColor=white&labelColor=1a1a2e)](https://cloud.google.com)

</div>

---

## 🏆 Niral Thiruvizha 3.0

Nirantara is developed as part of **Niral Thiruvizha 3.0**, Tamil Nadu's premier student innovation challenge. Our team was **selected among the top 500 teams statewide** for addressing one of India's most urgent and underserved healthcare gaps — mental health continuity for women with hormonal conditions — using a fully ML-first, Tamil-native AI architecture built by two CS students from Tirunelveli.

---

## 🎯 Problem Statement

> **"How might we utilize AI chatbots and machine learning to address incomplete alleviation of depression symptoms, attrition, and loss of follow-up in mental health treatment?"**

### The Three Components We Solve

| Problem | Our Solution |
|---|---|
| **Incomplete symptom alleviation** | Gemma 4B AI companion available 24/7 in Tamil/Tanglish with CBT techniques |
| **Attrition** | `dropout_model.pkl` — XGBoost attrition predictor + personalized JITAI re-engagement |
| **Loss of follow-up** | Passive monitoring continues silently. Clinician dashboard alerts in real time. |

### Why This Problem Is Urgent

| Statistic | Source |
|---|---|
| **70–92%** of Indians with mental illness receive no treatment | WHO Mental Health Atlas 2021 |
| **50%** who begin therapy quit before recovering | Lancet Psychiatry India 2023 |
| **22%** of Indian mothers experience postpartum depression (vs 13% global avg) | NIMHANS 2022 |
| **#1** cause of death for Indian women aged 15–39 is suicide | NCRB 2023 |
| Tamil Nadu has **1 psychiatrist per 200,000** people | State Mental Health Authority |

### Root Causes

- No monitoring system exists between clinical appointments — relapses develop in silence
- Mental health care in India is episodic, not continuous — 45 minutes every two weeks with nothing in between
- No clinical tool accounts for a woman's hormonal cycle phase when assessing her mental state
- Severe psychiatrist shortage makes between-session follow-up impossible at scale
- Cultural stigma causes women to suppress distress and report it only after crisis
- Existing apps are Western, English-only, and hormonally blind

---

## 👤 Who We Built For

**Ananya · 25 · Tirunelveli, Tamil Nadu**

| Attribute | Detail |
|---|---|
| Condition | PMDD with irregular cycles (28–34 day variation) |
| Occupation | Data entry operator |
| Income | ₹15,000/month |
| Device | Android (Redmi Note) |
| Language | Tamil at home, Tanglish with friends |
| Behaviour | Left therapy after 3 sessions. Suppresses distress. Visits doctor only after crisis peaks. |

> *"She says she is fine. IndicBERT says otherwise. That gap between her stated mood and her expressed language is the signal no one was watching. Nirantara watches it."*

---

## 💡 Our Solution

Nirantara is the **first platform** to fuse three capabilities that exist separately in the world but nowhere together:

1. **Personalized hormonal cycle intelligence** — handles PCOS, postpartum, perimenopause
2. **Code-mixed Tamil-English (Tanglish) NLP** — understands how Tamil Nadu women actually speak
3. **Just-in-time adaptive intervention engine** — fires only when the user is ready to receive it

### Core Architecture Principle

```
ZERO hardcoding.  ZERO keyword matching.  ZERO fixed thresholds.
Every detection, prediction, and clinical decision is driven by trained ML or NLP.
```

---

## 🤖 ML/NLP Architecture

| Layer | Model | Output | Replaces |
|---|---|---|---|
| Crisis Detection | `mental/mental-roberta-base` | crisis_probability 0–1 | ~~keyword list~~ |
| Sentiment Analysis | `ai4bharat/indic-bert` | sentiment_score 0–1 | ~~keyword counting~~ |
| Emotion Detection | `j-hartmann/emotion-distilroberta` | 7-class emotion label | ~~not detected before~~ |
| Cycle Prediction | Personalized LSTM (PyTorch) per user | vulnerability_score 0–1 | ~~fixed Day 22-28 rule~~ |
| Risk Fusion | XGBoost 14-feature + SHAP | risk_level + top_3_factors | ~~arithmetic formula~~ |
| JITAI Timing | Personalized XGBoost per user | receptivity_score 0–1 | ~~same rules for everyone~~ |
| Attrition Prediction | `dropout_model.pkl` (XGBoost) | dropout_risk 0–1 | ~~no prediction existed~~ |
| Generative Chat | Gemma 4B via Ollama CUDA | Tamil/Tanglish/EN response | ~~template strings~~ |

### Why NLP Beats Keywords

| Input | Keyword approach | NLP approach |
|---|---|---|
| "I want to kill this exam" | ❌ FALSE POSITIVE | ✅ crisis_prob: 0.03 |
| "I don't see the point anymore" | ❌ MISSED | ✅ crisis_prob: 0.87 |
| "romba kashtama iruku life" | ❌ MISSED (Tamil) | ✅ crisis_prob: 0.71 |
| "tired of everything" | ❌ MISSED | ✅ crisis_prob: 0.64 |

---

## 📊 8 Depression Triggers — All ML-Detected

> The user does nothing. The app watches silently.

| # | Trigger | Method | Input |
|---|---|---|---|
| 01 | Hormonal Vulnerability | Personalized LSTM | Fully passive |
| 02 | Sleep Disruption | Personal 30-day baseline deviation | Phone-down proxy |
| 03 | Physical Inactivity | Personal baseline deviation | expo-sensors pedometer |
| 04 | Social Withdrawal | GPS Entropy + Engagement ML | Zone count (no coordinates) |
| 05 | Chronic Stress | IndicBERT semantic NLP | Optional journal text |
| 06 | Postpartum / Caregiving | Profile-weighted XGBoost | Condition flag from profile |
| **07** | **Emotional Suppression** | **Mood–Sentiment Divergence** | **★ Unique to Nirantara** |
| 08 | Life Events / Grief | IndicBERT event classification | Optional journal text |

### ★ The Unique Signal — Emotional Suppression

Indian women are culturally trained to say they are fine. Nirantara measures the gap between what they say and what their language reveals.

```
Stated mood score:    3  (neutral)
IndicBERT sentiment:  0.8 (strongly negative)
Divergence score:     |0.5 − 0.2| = 0.3 → suppression signal → elevated XGBoost weight
```

**No other mental health platform detects this.**

---

## 🔄 Complete ML Signal Flow

```
Phone sensors (passive, every 15 min)
        ↓
AsyncStorage (offline-first, never loses data)
        ↓
Node.js Backend (port 5000)
        ↓
┌──────────────────────────────────────────────────────┐
│              Python AI Service (port 8000)            │
│                                                      │
│  Sarvam STT → Tamil text                             │
│  Language detect → ta / en / tanglish                │
│  IndicBERT → sentiment_score                         │
│  mental-roberta → crisis_probability                 │
│  distilroberta → emotion_label (7 classes)           │
│  Personalized LSTM → cycle_vulnerability_score       │
│  UserBaseline → 8 deviation scores                   │
│                                                      │
│  XGBoost 14-feature fusion → risk_score 0–1          │
│  SHAP → top_3_factors (human-readable)               │
│  dropout_model → attrition_risk                      │
│  Personalized JITAI XGBoost → receptivity_score      │
│  Gemma 4B → context-aware Tamil/Tanglish response    │
└──────────────────────────────────────────────────────┘
        ↓
Firebase Cloud Messaging → push notification to user
        ↓ (if risk > 0.7)
Clinician Dashboard → real-time alert (Firestore onSnapshot)
```

---

## 🏗️ System Architecture

### Four Services

```
nirantara/
├── ai-service/              # Python FastAPI — all NLP/ML models
│   ├── routers/
│   │   ├── chat.py          # Gemma 4B generative response
│   │   ├── crisis.py        # mental-roberta classifier
│   │   ├── sentiment.py     # IndicBERT Tamil/EN sentiment
│   │   ├── emotion.py       # distilroberta 7-class emotion
│   │   ├── predict.py       # XGBoost 14-feature risk
│   │   ├── cycle.py         # Personalized LSTM per user
│   │   ├── jitai.py         # Personalized JITAI XGBoost
│   │   └── dropout.py       # Attrition prediction model
│   ├── models/
│   │   ├── risk_model.pkl         # Trained XGBoost
│   │   ├── dropout_model.pkl      # Trained attrition model
│   │   ├── user_cycles/           # Per-user LSTM models
│   │   └── user_jitai/            # Per-user JITAI models
│   └── utils/
│       ├── gemma_client.py        # Ollama CUDA interface
│       ├── sarvam_client.py       # Tamil STT + translation
│       └── language_detector.py   # ta / en / tanglish
│
├── backend/                 # Node.js Express API (port 5000)
│   ├── routes/              # auth, mood, cycle, chat, jitai, passive, risk, clinician
│   └── services/            # jitaiScheduler, escalationCron, baselineService
│
├── mobile-app/              # React Native Expo
│   └── src/screens/         # Home, Chat, Journal, Cycle, Login
│
└── dashboard/               # React.js clinician portal (port 3000)
    └── src/pages/           # Dashboard, PatientDetail, Alerts, Login
```

### Mobile App Screens

| Screen | Purpose |
|---|---|
| `Home.js` | Mood ring (XGBoost risk color), steps vs baseline, cycle badge, JITAI card |
| `Chat.js` | Gemma 4B Tamil/Tanglish/English, crisis card, NIMHANS helpline |
| `Journal.js` | Mood check-in → triggers full NLP pipeline automatically |
| `Cycle.js` | Personalized LSTM vulnerability wheel, predicted next period |
| `Login.js` / `Signup.js` | Firebase Auth — Phone OTP + Google |

### Clinician Dashboard Pages

| Page | Purpose |
|---|---|
| `Dashboard.jsx` | All patients sorted by XGBoost risk_score, crisis banner |
| `PatientDetail.jsx` | 30-day risk chart, SHAP factors, Gemma narrative summary |
| `Alerts.jsx` | Unresolved crisis alerts, real-time Firestore onSnapshot |
| `Login.jsx` | Clinician Firebase authentication |

---

## 🧬 Risk Intelligence

| Score | Level | Color | Action |
|---|---|---|---|
| 0.0 – 0.29 | 🟢 Low | Sage green | Standard passive monitoring |
| 0.30 – 0.59 | 🟡 Moderate | Amber | Increased JITAI frequency |
| 0.60 – 0.79 | 🔴 High | Alert red | Clinician alert triggered |
| 0.80 – 1.00 | ⚫ Crisis | Charcoal | Immediate escalation, zero cooldown, NIMHANS |

---

## 📡 Passive Monitoring Schedule

```
Every 15 minutes:   Accelerometer variance, step count delta,
                    AppState events, notification response timestamps

Every 1 hour:       GPS entropy computation (no coordinates stored),
                    sleep proxy, risk score update via XGBoost,
                    JITAI evaluation via personalized model

Every 24 hours:     Full 8-trigger XGBoost inference,
                    personalized cycle vulnerability update,
                    clinician alert if risk_score > 0.7,
                    baseline rolling window update
```

> **GPS Privacy:** Raw coordinates are never stored anywhere. Only an entropy score (integer 0–10 unique zones) is computed on-device and transmitted.

---

## 🔒 Privacy, Security & Compliance

### DPDP Act 2023
- ✅ Explicit consent toggles on sign-up
- ✅ GPS entropy only — raw coordinates never stored
- ✅ Right to delete all data — `DELETE /api/auth/delete-account`
- ✅ Right to export all data — `GET /api/auth/export-data`

### Encryption & Security
- ✅ AES-256-GCM on all journal text and chat messages
- ✅ Firebase JWT token verification on every API route
- ✅ Nginx SSL termination (Let's Encrypt via Certbot)
- ✅ Rate limiting at network layer via express-rate-limit
- ✅ `serviceAccountKey.json` gitignored — never committed

### Accessibility — WCAG 2.1 AA
- ✅ 44px minimum tap targets (72px for elderly mode)
- ✅ `accessibilityLabel` on every interactive element
- ✅ Risk always shown as color + icon + text — never color alone
- ✅ Tamil text declared with `accessibilityLanguage="ta"`
- ✅ Full offline operation — works on 2G

---

## 🌐 API Reference

### Backend Routes (port 5000)

```
POST   /api/auth/register
GET    /api/auth/me
DELETE /api/auth/delete-account        ← DPDP compliance
GET    /api/auth/export-data           ← DPDP compliance

POST   /api/mood/log                   ← triggers full NLP pipeline
GET    /api/mood/weekly/:uid

POST   /api/cycle/log-period           ← triggers LSTM retrain for this user
GET    /api/cycle/today/:uid

POST   /api/chat/message               ← NLP pipeline + Gemma response
POST   /api/chat/voice                 ← Sarvam STT + NLP + Gemma

POST   /api/jitai/evaluate/:uid        ← personalized JITAI model
POST   /api/jitai/log-response         ← user response = training signal

POST   /api/passive/log
POST   /api/passive/gps-entropy        ← entropy integer only, no coordinates
POST   /api/passive/sync-batch         ← offline queue sync

GET    /api/risk/score/:uid            ← XGBoost + SHAP factors
GET    /api/clinician/patients         ← sorted by risk_score
GET    /api/clinician/alerts
```

### AI Service Routes (port 8000)

```
POST   /api/crisis/detect              ← mental-roberta probability
POST   /api/sentiment/analyze          ← IndicBERT Tamil/EN
POST   /api/emotion/detect             ← distilroberta 7-class
POST   /api/predict/risk               ← XGBoost 14-feature fusion
POST   /api/cycle/train/:uid           ← LSTM retrain on new period data
GET    /api/cycle/predict/:uid         ← personalized vulnerability score
POST   /api/jitai/receptivity          ← personalized JITAI evaluation
POST   /api/dropout/predict            ← attrition risk score
POST   /api/chat                       ← Gemma 4B context-aware response
GET    /docs                           ← Swagger UI
```

---

## 🛠️ Tech Stack

### Mobile
![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)
![AsyncStorage](https://img.shields.io/badge/AsyncStorage-Offline_First-F0A830?style=for-the-badge)

### Backend
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)

### AI Service
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)
![HuggingFace](https://img.shields.io/badge/HuggingFace-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)
![XGBoost](https://img.shields.io/badge/XGBoost-337AB7?style=for-the-badge)
![Ollama](https://img.shields.io/badge/Ollama-Gemma_4B-C97B84?style=for-the-badge)

### Infrastructure
![GCP](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

---

## 🚀 Quick Start

### Prerequisites

```bash
node -v           # v18+
python --version  # 3.10+
nvidia-smi        # RTX 3050 visible
ollama --version  # installed
```

### Step 1 — Download NLP Models (~6.5 GB, run once)

```bash
cd ai-service
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python download_models.py    # Takes 15–20 minutes
```

### Step 2 — Train XGBoost Risk Model

```bash
python models/model_trainer.py
# Expected: Accuracy 0.85+ | Saved: models/risk_model.pkl
```

### Step 3 — Configure Environment

```bash
# backend/.env
PORT=5000
AI_SERVICE_URL=http://localhost:8000
ENCRYPTION_KEY=<node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
SARVAM_API_KEY=<your-key>

# ai-service/.env
PORT=8000
OLLAMA_BASE_URL=http://localhost:11434
GEMMA_MODEL=gemma:4b
SARVAM_API_KEY=<your-key>
```

### Step 4 — Start All Services (5 Terminals)

```bash
# Terminal 1 — Gemma 4B (RTX 3050 CUDA)
ollama serve

# Terminal 2 — AI Service
cd ai-service && venv\Scripts\activate
uvicorn main:app --reload --port 8000

# Terminal 3 — Backend
cd backend && node index.js

# Terminal 4 — Clinician Dashboard
cd dashboard && npm run dev -- --port 3000

# Terminal 5 — Mobile App
cd mobile-app && npx expo start

# Seed demo data (run once)
node scripts/seed_demo_data.js
```

### Step 5 — Validate NLP Models

```bash
# Crisis true positive (expect crisisProbability > 0.7)
curl -X POST http://localhost:8000/api/crisis/detect \
  -H "Content-Type: application/json" \
  -d '{"text":"I dont see the point of anything anymore"}'

# Crisis false positive prevention (expect crisisProbability < 0.2)
curl -X POST http://localhost:8000/api/crisis/detect \
  -H "Content-Type: application/json" \
  -d '{"text":"I want to kill this exam tomorrow"}'

# Tamil sentiment (expect label: negative)
curl -X POST http://localhost:8000/api/sentiment/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"romba sad ah irukken today"}'
```

---

## 💰 Infrastructure Budget — ₹15,000 Grant

| Component | Specification | Price |
|---|---|---|
| GCP Compute Engine e2-medium | 2 vCPU, 4GB RAM, Months 4–6* | ₹3,100 |
| GCP Cloud Storage | 50GB, asia-south1, Months 4–6* | ₹450 |
| GCP Static IP | asia-south1, Months 4–6* | ₹450 |
| GCP Egress Bandwidth | ~5GB/month, Months 4–6* | ₹200 |
| Domain — nirantara.in | 2-year registration | ₹1,500 |
| SSL Certificate | Let's Encrypt via Certbot | ₹0 |
| Nginx Reverse Proxy | Installed on GCP instance | ₹0 |
| Firebase Blaze Plan | Firestore + Auth + FCM, 6 months | ₹2,800 |
| Sarvam AI API | Tamil STT + translation, 6 months | ₹1,800 |
| EAS Android Build | Production APK for demo distribution | ₹700 |
| **Total** | | **₹11,000** |

> *Months 1–3 fully covered by GCP $300 free trial credit (~₹25,000 value). Grant spend begins only at Month 4.
> **Remaining ₹4,000 reserved for Sarvam API scaling and Firebase overrun buffer.**

---

## 👥 Team

Built by two CS students from **Anna University Regional Campus, Tirunelveli** — one focused on backend and AI, one on frontend and UI.

### Why We Built This

As women in tech from Tamil Nadu, this problem is personal. **One of our team members lost a grandmother to postpartum depression** — a death that could have been prevented with early detection and timely support. We have watched women in our own families suppress distress because of stigma, dismiss hormonal crashes as weakness, and receive help only after reaching crisis point.

As CS students skilled in AI and ML, we are in a rare position to build something that did not exist when our grandmother needed it — a system that watches silently, understands Tamil, respects the hormonal reality of women's mental health, and ensures no warning sign goes unnoticed between appointments.

---

## 📈 Market Opportunity

| Metric | Value |
|---|---|
| India mental health market by 2033 | ₹54,000 Cr |
| Indian women with PCOS | 5 Cr+ |
| Indians living with depression | 15 Cr |
| Existing apps with Tamil NLP + hormonal ML + passive monitoring | **0** |

---

<div align="center">

## நிரந்தர · Nirantara

*Built with ❤️ for Tamil women who were told they were fine when they were not.*

**Anna University Regional Campus, Tirunelveli**
**Niral Thiruvizha 3.0 — Top 500 Teams**
**Tamil Nadu Government Pre-Seed Grant — ₹15,000**

---

`mental-roberta` · `indic-bert` · `emotion-distilroberta` · `Gemma 4B` · `XGBoost` · `LSTM` · `Sarvam AI`

</div>