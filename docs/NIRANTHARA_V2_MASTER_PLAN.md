# NIRANTHARA V2 — Master Plan

**AI-Powered Mental Health Continuity Platform: Review, Extension, and Roadmap**

This document is grounded in the actual codebase (verified July 2026), not the README or aspirational specs. Where the code and prose disagree, the code wins. It builds on the existing platform; it does not replace it.

---

## 0. TL;DR — The Five Decisions That Matter

1. **Do not rewrite the backend to FastAPI/PostgreSQL for the hackathon.** The Express + Firestore backend works, is demo-ready, and the dashboard's real-time updates depend on Firestore `onSnapshot`. Migrate the *data layer* to PostgreSQL post-hackathon (V2), keep FastAPI where it already is (the AI service).
2. **Wearable strategy: Health Connect is the hub on Android, HealthKit on iOS, cloud APIs (Fitbit Web API, Garmin Health) as server-side adapters.** The adapter pattern already half-exists in `mobile-app/src/services/HealthConnectService.js` — formalize it, don't reinvent it.
3. **The differentiator is continuity, not the chatbot.** Every competitor has a chatbot. Nobody closes the loop: passive signal → risk model → just-in-time intervention → clinician escalation → follow-up recapture. NIRANTHARA already has all five stages wired. The pitch is the loop.
4. **Hackathon MVP = polish + 4 additions**, not new subsystems: PHQ-9/GAD-7 in-app, medication reminders, an AI patient summary on the dashboard, and the demo script. Everything else is roadmap.
5. **AI augments clinicians, never decides.** Every model output on the dashboard shows its inputs (SHAP already exists in the risk model — surface it). Crisis paths always route to a human.

---

## 1. Product Vision & Problem Analysis

### 1.1 The problem, quantified

Depression treatment fails at the *gaps*, not the sessions:

- **Incomplete symptom alleviation:** ~50–70% of patients on first-line antidepressants do not achieve remission (STAR*D). Residual symptoms are the strongest predictor of relapse.
- **Attrition:** ~20–60% of outpatients drop out of therapy; most attrition happens between sessions, invisibly, before anyone notices.
- **Loss of follow-up:** the median clinician sees a patient 1 hour out of every ~730 hours in a month. The other 729 hours are unobserved.
- **Relapse:** 50% relapse after one episode, 80%+ after two. Prodromal signals (sleep disruption, withdrawal, reduced activity) appear days-to-weeks before subjective awareness — exactly the signals wearables and phones capture passively.

### 1.2 Vision statement

> NIRANTHARA ("continuous" in Sanskrit) turns the 729 unobserved hours into clinically actionable signal — passive monitoring detects deterioration before the patient reports it, just-in-time adaptive interventions act in the moment, and clinicians receive triaged, explainable risk intelligence instead of raw data.

The product is **a continuity-of-care layer between visits**, not a therapist replacement and not "a mental health chatbot."

### 1.3 What "solving" each problem looks like

| Problem | NIRANTHARA mechanism | Status |
|---|---|---|
| Incomplete alleviation | Continuous PHQ-9 trajectory + residual-symptom tracking between visits | Partial (mood logs exist; PHQ-9 to add) |
| Attrition | Dropout/disengagement XGBoost model + escalation cron for loss-of-follow-up | **EXISTS** (`ai-service/routers/dropout.py`, `backend/services/escalationCron.js`) |
| Missed follow-ups | Escalation cron (15-min sweep) + clinician alert queue | **EXISTS** |
| Medication non-adherence | Reminders + adherence-informed risk features | To build (MVP) |
| Poor engagement | JITAI receptivity model — intervene when the user will actually respond | **EXISTS** (`backend/services/jitaiScheduler.js`, per-user XGBoost) |
| No continuous monitoring | Biometrics + passive sensing + LSTM autoencoder anomaly detection | **EXISTS** (`ai-service/routers/anomaly.py`, `backend/routes/passiveRoutes.js`) |
| Relapse | Cycle LSTM (per-user vulnerability forecasting) + anomaly score in 15-feature risk fusion | **EXISTS** |
| Suicide risk | mental-roberta crisis classifier on every journal + chat message; crisis alerts to clinicians | **EXISTS** |
| Continuity of care | Firestore as shared state between patient app and clinician dashboard, live via `onSnapshot` | **EXISTS** |

This table is the core of the pitch: the hard ML problems are already built. What remains is clinical instrumentation (validated scales), completeness (medication), and presentation.

---

## 2. Competitive Analysis

| Platform | What they do | What they lack (NIRANTHARA's edge) |
|---|---|---|
| **Wysa / Woebot** | CBT chatbots, large user bases, some clinical evidence | No clinician loop, no passive sensing, no risk prediction. Conversation is the product; here it's one sensor among many. |
| **Headspace / Calm** | Content libraries, meditation | Wellness, not care. No monitoring, no clinician, no crisis pathway. |
| **Mindstrong (shut down)** | Digital phenotyping from keyboard dynamics | Proved the science, failed on go-to-market (direct-to-consumer for serious mental illness). Lesson: sell to *clinics*, monitor *their* patients. |
| **Ginger/Headspace Health** | Text-based coaching + escalation to therapists | Human-labor-heavy; costs scale linearly with users. NIRANTHARA's ML triage scales sub-linearly. |
| **Ellipsis Health** | Voice biomarkers for depression severity | Single-modality. NIRANTHARA fuses text + biometrics + behavior + cycle. |
| **NeuroFlow / Valera Health** | Closest analogs: remote monitoring + clinician dashboards, US-market | US-only, EHR-centric, minimal JITAI. NIRANTHARA's per-user JITAI receptivity models and India-first multilingual NLP (indic-bert already integrated) are differentiators. |

**Positioning sentence:** "Wysa is a chatbot. NeuroFlow is a dashboard. NIRANTHARA is the closed loop between them — and it speaks Indian languages."

---

## 3. User Personas & Journeys

### Personas

1. **Priya, 24, engineering student, moderate depression (PHQ-9: 14).** On sertraline, sees a psychiatrist every 6 weeks. Owns a Fitbit. Risk: silent deterioration between visits; stops medication when she feels better. Needs: low-friction check-ins, a chat companion at 2 AM, cycle-aware insights (her mood dips are premenstrual — the cycle LSTM already models this).
2. **Dr. Rao, 45, psychiatrist, 300+ active patients.** Sees each patient 15 minutes/month. Needs: a triaged worklist (who is deteriorating *now*), not 300 data streams; explainable alerts he can trust; medico-legal defensibility.
3. **Anand, 58, Priya's father / caregiver.** Needs: to be an emergency contact, to know when to worry without violating his adult daughter's privacy (consent-gated).
4. **Meera, hospital administrator.** Needs: outcomes data (remission rates, attrition reduction) to justify the subscription; compliance assurances.

### Patient journey (current + planned)

```
Onboarding (EXISTS: Onboarding.js) → baseline PHQ-9/GAD-7 (ADD)
  → daily: mood check-in + journal (EXISTS) · passive biometric sync (EXISTS)
  → continuous: risk fusion on every log (EXISTS) · anomaly detection (EXISTS)
  → when receptive: JITAI nudge (EXISTS) · medication reminder (ADD)
  → weekly: insights + trends (EXISTS: Insights.js)
  → on deterioration: clinician alert (EXISTS) → outreach → recapture
  → on crisis: immediate alert + in-app crisis resources (EXISTS, harden)
  → recovery: relapse-prevention monitoring continues at lower intensity (V1)
```

The journey's weak points today: no validated-scale baseline at onboarding, no medication loop, and no "graduation"/maintenance mode. All three are cheap to add.

---

## 4. Existing Architecture Review

### 4.1 What exists (verified in code)

**Five services:**

| Service | Stack | Role |
|---|---|---|
| `ai-service/` (:8000) | Python 3.11, FastAPI, PyTorch, XGBoost, HF | 9 routers: chat, crisis, sentiment, emotion, predict (15-feature XGBoost + SHAP), dropout, cycle (per-user LSTM), jitai (per-user XGBoost), anomaly (per-user LSTM autoencoder) |
| `backend/` (:5000) | Node 20, Express, Firebase Admin | Orchestration: auth, AES-256-GCM encryption, Firestore writes, JITAI scheduler (hourly), escalation cron (15 min) |
| `dashboard/` (:5173) | React 18, Vite, Firebase Web SDK | Clinician UI: Dashboard, PatientDetail, Alerts — live via `onSnapshot` |
| `mobile-app/` | React Native, Expo SDK 50 | Patient UI: Home, Chat, Journal, Cycle, Insights, Onboarding, auth |
| `smartwatch/` | Node, Express | Biometric simulation/bridge |

**Pipelines that already span the stack:**
1. **Mood → risk:** `POST /api/mood/log` encrypts the journal, fans out to sentiment + emotion + crisis in parallel, computes mood/sentiment divergence, pulls cycle vulnerability, assembles 15 XGBoost features, writes `moodLogs` + `users.riskLevel`, and creates `clinicianAlerts` on crisis.
2. **Chat:** mobile → backend (context enrichment from live Firestore state: cycle, mood, risk, emotion) → ai-service (crisis classifier, language detection) → NVIDIA Minimax M2.7 via OpenAI-compatible API, with warm static fallback. Multi-turn memory threads `history` client → backend → ai-service.
3. **Passive loop:** biometric sync → baseline service → anomaly autoencoder → risk features → JITAI receptivity check → notification.

### 4.2 Strengths (keep and showcase)

1. **The closed loop is real.** Detection → prediction → intervention → escalation all exist and talk to each other. This is the thing competitors lack.
2. **ML-first discipline.** "Zero hardcoding" is enforced: clinical decisions come from trained models; rule branches exist only as labeled fallbacks. Judges and clinicians both respect this.
3. **Per-user personalization.** Per-user LSTM cycle models, per-user JITAI models, per-user autoencoders — this is genuinely ahead of most commercial products, which use population models.
4. **Explainability already wired.** SHAP values in the risk model. Surface them in the UI (cheap, high-impact).
5. **Security posture above hackathon norm.** Field-level AES-256-GCM before Firestore, Firebase `verifyIdToken` on every protected route, new `authorize.js` middleware closing IDOR across 7 route files, encrypted fields stripped from history responses.
6. **India-relevant NLP.** `ai4bharat/indic-bert` for sentiment + language detection in chat — multilingual is architectural, not aspirational.
7. **Offline-first mobile** (AsyncStorage) — right call for the target market.

### 4.3 Weaknesses (honest list — this doubles as the judge-proofing checklist)

| # | Weakness | Severity | Fix | When |
|---|---|---|---|---|
| W1 | **No validated clinical instruments.** Mood sliders and NLP are not PHQ-9/GAD-7. Clinicians and judges will ask "where's the validated measure?" first. | High | Add PHQ-9/GAD-7 flows + score history; feed scores into the risk model as features | MVP |
| W2 | **Models trained on synthetic/small data.** XGBoost risk + dropout pkls have no real clinical labels. | High (honesty) | Say it plainly; present the *retraining strategy* (§12) as the answer. Never claim clinical validation you don't have. | Pitch |
| W3 | **No test suite anywhere.** Backend `npm test` is a stub. | Med | Post-hackathon: pytest for ai-service routers, supertest for backend routes. Manual verification checklist until then. | V1 |
| W4 | **Firestore composite-index workarounds** — dashboard now fetches-all-and-filters client-side, unbounded reads. | Med | Fine at demo scale; create the composite indexes (URLs printed in backend logs) and restore server-side queries before any real pilot. | V1 |
| W5 | **Single-clinician assumption**; no roles/teams/care-team model. | Med | Roles collection + `authorize.js` extension | V1 |
| W6 | **Crisis pathway is alert-only.** No in-app safety plan, no helpline handoff (Tele-MANAS 14416 / iCall), no acknowledgment SLA on alerts. | High (clinical) | In-app crisis screen + alert acknowledgment tracking | MVP |
| W7 | **No consent/audit layer.** Encryption exists; consent records and access audit logs do not. | Med | `consents` + `auditLogs` collections; log every clinician read of patient data | V1 |
| W8 | **Wearable path is Health-Connect-only + simulation.** Adapter pattern implicit, not formalized; no iOS path. | Med | §9 architecture | V1–V2 |
| W9 | **Secrets/config fragility:** committed venv pinned to a machine-specific Python; hardcoded LAN IP in `api.js`; gitignored files required to run. | Low | `.env`-driven BASE_URL; remove venv from git; document (§20) | V1 |
| W10 | **LLM safety is single-layer.** Crisis classifier gates the chat, but there's no output-side guardrail (e.g., model advises on medication dosage). | High (clinical) | System-prompt hardening + output classifier pass + "I can't advise on medication" policy | MVP |

### 4.4 Keep / Improve / Replace decisions

| Component | Verdict | Why |
|---|---|---|
| Express backend | **Keep** (hackathon → V1) | Works, demo-ready. Rewriting to FastAPI buys nothing the judges can see and risks everything. The prompt's FastAPI preference is already satisfied where it matters — the ML service. |
| Firestore | **Keep now, migrate V2** | `onSnapshot` real-time dashboard is a demo superpower. At scale, analytical queries + ML feature engineering need PostgreSQL (+ Timescale for time series). Migration plan in §10. |
| NVIDIA Minimax chat | **Keep, add fallback tier** | Cloud LLM with warm static fallback is right. V1: add a second provider behind the same `nvidia_client.py` interface (it's already an OpenAI-compatible client — swapping base_url is trivial). |
| Firebase Auth | **Keep indefinitely** | OAuth2/JWT requirement from the prompt is *satisfied by* Firebase Auth (it issues JWTs, supports OAuth providers). Rolling your own gains nothing. |
| Per-user pkl model files | **Keep now, registry V2** | Files-on-disk fine for hundreds of users; MLflow model registry when models need versioning/rollback (§15). |
| Simulated smartwatch service | **Keep as demo mode** | Already toggleable in `HealthConnectService.js`. Demo reliability > live-data bravado on stage. |
| README's "Gemma via Ollama" prose | **Replace (docs only)** | Stale; the code uses NVIDIA Minimax. Fix before judges read it. |

---

## 5. Improved Architecture (Target)

### 5.1 Production architecture (V2+ target; MVP = current five services)

```
                        ┌─────────────────────────────────────────────┐
   Patient App          │              API GATEWAY                    │
   (React Native)  ───▶ │  (routing · rate limit · JWT verify · WAF)  │
   Clinician Web   ───▶ │                                             │
   (React)              └───────┬─────────────────┬───────────────────┘
                                │                 │
                    ┌───────────▼──────┐   ┌──────▼───────────┐
                    │  Core API        │   │  AI Service       │
                    │  (Node/Express,  │──▶│  (FastAPI)        │
                    │   later split)   │   │  9 ML routers     │
                    └───┬────┬────┬────┘   └──────┬────────────┘
                        │    │    │               │
          ┌─────────────▼┐ ┌─▼────▼───┐   ┌──────▼────────────┐
          │ PostgreSQL + │ │ Redis    │   │ Model store       │
          │ Timescale    │ │ (cache,  │   │ (MLflow registry, │
          │ (V2; today:  │ │  queues, │   │  today: pkl files)│
          │  Firestore)  │ │  Celery/ │   └───────────────────┘
          └──────────────┘ │  BullMQ) │
                           └──────────┘
   Wearable Integration Layer (§9) ──▶ ingestion queue ──▶ feature store
   FCM push · webhook receivers (Fitbit/Garmin) · object storage (S3/GCS: exports, model artifacts)
   Observability: OpenTelemetry → Grafana/Loki/Tempo · Sentry (clients)
```

**Trade-offs, stated:**
- **Monolith-first, split later.** The Express backend stays one deployable until a specific scaling pain (likely: ingestion volume) forces a split. Microservices at hackathon scale is résumé-driven design. (Ousterhout: deep modules, small interfaces — the backend/ai-service boundary is already the one interface that matters.)
- **Queue before microservices.** The first real scaling fix is making biometric ingestion + risk-scoring async (BullMQ on Redis) — not splitting services.
- **Firestore → PostgreSQL is a V2 migration, not a rewrite:** dual-write behind a data-access module, backfill, cut reads over, keep Firestore only for the real-time alert channel (or replace with WebSockets/SSE).

---

## 6. Feature Brainstorm (100+)

Legend — **User:** P = patient, C = clinician, F = family/caregiver, A = admin/org, R = researcher. **Cx:** complexity L/M/H. **Tier:** MVP / V1 / V2 / V3 / LTV (long-term vision). **[E]** = already exists in the codebase. For each feature the "Benefit" column states the clinical and/or business purpose; AI/ML column states what model or AI capability it needs (— = none).

### A. Conversational AI (8)

| # | Feature | User | Benefit | AI/ML | Cx | Tier |
|---|---|---|---|---|---|---|
| 1 | Context-aware LLM companion [E] | P | 2 AM support; engagement anchor; passive symptom signal | LLM + context injection (exists) | M | MVP |
| 2 | Crisis-gated chat [E] | P | Every message screened by mental-roberta before LLM reply | Crisis classifier (exists) | M | MVP |
| 3 | Multilingual chat [E: detection] | P | India: Hindi/Tamil/Telugu etc.; access + equity | indic-bert lang detect + multilingual LLM | M | V1 |
| 4 | Output-side safety guardrail | P | Blocks medication dosing advice, harmful content from LLM replies | Output classifier pass | M | MVP |
| 5 | CBT/behavioral-activation guided flows | P | Evidence-based micro-interventions, not just empathy | LLM + structured protocol state | M | V1 |
| 6 | Voice conversations (STT/TTS) | P | Accessibility, elderly, low-literacy users | Whisper-class STT, TTS (Sarvam keys already provisioned) | H | V2 |
| 7 | Session summaries for clinician | C | "What did the patient discuss this month" without reading transcripts (consent-gated) | LLM summarization | M | V1 |
| 8 | Therapy-homework companion | P,C | Clinician assigns homework; chatbot coaches completion | LLM + task state | M | V2 |

### B. Assessment & Measurement (8)

| # | Feature | User | Benefit | AI/ML | Cx | Tier |
|---|---|---|---|---|---|---|
| 9 | PHQ-9 in-app with score history | P,C | The validated depression measure; anchors all ML labels | — (scores become ML labels) | L | **MVP** |
| 10 | GAD-7 in-app | P,C | Anxiety measure; comorbidity coverage | — | L | **MVP** |
| 11 | Adaptive assessment scheduling | P | Ask PHQ-9 more often when risk rises, less when stable — reduces burden | Risk-model-driven cadence | M | V1 |
| 12 | C-SSRS-lite triggered screening | P,C | Structured suicide-risk follow-up when crisis classifier fires | Trigger = crisis model (exists) | M | V1 |
| 13 | Mood check-ins + journaling [E] | P | Daily signal; NLP substrate | Sentiment/emotion (exists) | L | MVP |
| 14 | Ecological momentary assessment (EMA) micro-prompts | P,R | 10-second in-the-moment ratings; gold-standard research data | JITAI timing (exists) | M | V2 |
| 15 | Sleep diary auto-filled from wearable | P | Removes friction; validated against actigraphy | Sleep-stage normalization | M | V2 |
| 16 | WHODAS functioning assessment | C | Measures function, not just symptoms — what payers care about | — | L | V3 |

### C. Passive Sensing & Wearables (10)

| # | Feature | User | Benefit | AI/ML | Cx | Tier |
|---|---|---|---|---|---|---|
| 17 | Health Connect biometric sync [E] | P | HR, sleep, steps, stress without user effort | Baseline service (exists) | M | MVP |
| 18 | Device-agnostic adapter layer (§9) | P,A | Any watch vendor without app-logic change | — (architecture) | M | V1 |
| 19 | Fitbit Web API cloud adapter | P | Charge 6 full data (HRV, SpO2) server-side | — | M | V1 |
| 20 | Apple HealthKit adapter | P | iOS market | — | M | V2 |
| 21 | Garmin/Samsung cloud adapters | P | Vendor coverage | — | M | V2 |
| 22 | Behavioral anomaly detection [E] | P,C | Per-user LSTM autoencoder flags deviation from personal baseline | Autoencoder (exists) | H | MVP |
| 23 | Phone-only passive sensing (screen time, app usage, typing cadence) | P | Works with zero wearable — critical for low-income users | New feature extractors | H | V2 |
| 24 | GPS mobility features (radius of gyration, home-stay %) | P | Strongest published digital biomarker for depression | Feature engineering; consent-heavy | H | V2 |
| 25 | Circadian rhythm disruption index | P,C | Sleep-timing variance predicts mood episodes | Time-series features → risk model | M | V2 |
| 26 | Voice biomarkers from check-ins (prosody, pause rate) | P,C | Passive severity signal from optional voice notes | Audio model | H | V3 |

### D. Predictive ML (10)

| # | Feature | User | Benefit | AI/ML | Cx | Tier |
|---|---|---|---|---|---|---|
| 27 | 15-feature risk fusion + SHAP [E] | C | One triage score, explainable | XGBoost (exists) | H | MVP |
| 28 | Dropout/attrition prediction [E] | C | The problem statement, answered directly | XGBoost (exists) | M | MVP |
| 29 | Cycle-linked vulnerability LSTM [E] | P,C | Menstrual-cycle mood forecasting — rare, defensible feature | Per-user LSTM (exists) | H | MVP |
| 30 | Mood forecasting (7-day) | P,C | "Your risk window is Thursday–Saturday" | Temporal model on mood+biometrics | H | V2 |
| 31 | Relapse early-warning (post-remission mode) | P,C | The 50–80% relapse problem; monitoring continues after "recovery" | Survival analysis / anomaly (partial exists) | H | V1 |
| 32 | Medication-adherence prediction | C | Flags likely non-adherence before it shows in symptoms | Classifier on reminder-response + refill data | M | V2 |
| 33 | Treatment-response prediction | C | "Similar patients responded to X in 4 weeks" — decision support | Requires large real dataset | H | LTV |
| 34 | Mood/sentiment divergence signal [E] | C | Patient says "fine," language says otherwise — masked depression flag | Divergence computation (exists) | M | MVP |
| 35 | Population risk stratification | A | Org-level heatmap: which cohort is deteriorating | Aggregation over risk scores | M | V2 |
| 36 | Model drift monitoring + auto-retrain triggers | A | ML safety at scale (§15) | MLflow + evidently-style checks | M | V2 |

### E. JITAI & Interventions (8)

| # | Feature | User | Benefit | AI/ML | Cx | Tier |
|---|---|---|---|---|---|---|
| 37 | Receptivity-timed nudges [E] | P | Intervene when the user will engage — hourly per-user XGBoost sweep | JITAI model (exists) | H | MVP |
| 38 | Intervention content library (breathing, grounding, BA tasks) | P | The nudge needs a payload; evidence-based micro-content | Recommender (V2) | L | MVP |
| 39 | Intervention-response learning (bandit) | P | Learn which intervention works for this user; JITAI closes its own loop | Contextual bandit on `jitaiLogs` | H | V2 |
| 40 | Personalized safety plan (Stanley-Brown) | P,C | Standard-of-care crisis tool, co-created with clinician, offline-available | — | L | **MVP** |
| 41 | Behavioral activation scheduler | P | Activity scheduling is first-line for depression | Recommender + calendar | M | V1 |
| 42 | Medication reminders + adherence log | P,C | Non-adherence problem, directly | Adherence features → risk model | L | **MVP** |
| 43 | Appointment reminders + no-show prediction | P,C | Loss-of-follow-up, directly | Dropout model features (exists) | L | V1 |
| 44 | Post-discharge intensive monitoring mode | P,C | Highest-risk window (post-hospitalization) gets highest cadence | Config over existing pipeline | M | V2 |

### F. Clinician Tools (10)

| # | Feature | User | Benefit | AI/ML | Cx | Tier |
|---|---|---|---|---|---|---|
| 45 | Live triaged patient list [E] | C | 300 patients sorted by who needs attention now | Risk model (exists) | M | MVP |
| 46 | Patient detail: mood/biometric trends [E] | C | Between-visit trajectory at a glance | — | M | MVP |
| 47 | Alert queue with crisis flags [E] | C | Escalations in one place | Crisis+escalation (exists) | M | MVP |
| 48 | AI patient summary ("last 30 days in 5 sentences") | C | The single highest-value dashboard addition; saves the 15-minute visit | LLM over structured logs (not raw transcripts) | M | **MVP** |
| 49 | Alert acknowledgment + SLA tracking | C,A | Medico-legal: prove alerts were seen and acted on | — | L | V1 |
| 50 | SHAP explanation panel per risk score | C | "Why is this patient high-risk" — trust + defensibility | SHAP (exists, surface it) | L | **MVP** |
| 51 | Clinician notes + care plans | C | Longitudinal record alongside AI signal | — | L | V1 |
| 52 | Caseload analytics (outcomes, remission rates) | C,A | The report that renews the contract | Aggregations | M | V2 |
| 53 | Visit-prep brief (auto-generated pre-appointment) | C | Agenda: what changed, what to ask | LLM | M | V1 |
| 54 | Care-team model (psychiatrist + therapist + case manager) | C,A | Real clinics are teams | Roles/authz extension | M | V2 |

### G. Crisis & Safety (6)

| # | Feature | User | Benefit | AI/ML | Cx | Tier |
|---|---|---|---|---|---|---|
| 55 | Crisis detection on journal+chat [E] | P,C | Every text scanned by mental-roberta | Classifier (exists) | H | MVP |
| 56 | In-app crisis screen (helplines: Tele-MANAS 14416, iCall; safety plan; emergency contact) | P | Detection without response is a liability, not a feature | — | L | **MVP** |
| 57 | Emergency contact notification (consent-gated) | F | Family loop for severe events | — | L | V1 |
| 58 | Escalation cron: crisis + loss-of-follow-up [E] | C | 15-min sweep for unacknowledged deterioration | Exists | M | MVP |
| 59 | Location-aware emergency resources | P | Nearest ER / crisis center | — | M | V2 |
| 60 | Human-review queue for borderline crisis classifications | C,A | Classifier uncertainty band goes to humans, not silence | Confidence thresholds | M | V1 |

### H. Engagement & Behavioral Science (7)

| # | Feature | User | Benefit | AI/ML | Cx | Tier |
|---|---|---|---|---|---|---|
| 61 | Streaks + gentle gamification (no dark patterns) | P | Retention without exploiting the vulnerable; calm design | — | L | V1 |
| 62 | Weekly insight stories ("your sleep improved 12%") [partial E: Insights.js] | P | Self-knowledge is intrinsically motivating | Trend analysis | M | MVP |
| 63 | Habit formation loops (implementation intentions) | P | BJ Fogg-style tiny habits for BA tasks | — | M | V2 |
| 64 | Adaptive notification budget | P | Never more than N nudges/day; fatigue kills JITAI | Receptivity model (exists) | M | V1 |
| 65 | Progress milestones tied to PHQ-9 deltas | P | Celebrate measured improvement, not app usage | — | L | V1 |
| 66 | Personalized content feed (psychoeducation) | P | Right article at the right time | Recommender | M | V2 |
| 67 | Re-engagement campaigns for churning users | P,A | Dropout model output → outreach sequence | Dropout model (exists) | M | V1 |

### I. Community, Family & Caregivers (6)

| # | Feature | User | Benefit | AI/ML | Cx | Tier |
|---|---|---|---|---|---|---|
| 68 | Caregiver companion view (consent-scoped) | F | "How can I help today" without exposing journals | — | M | V2 |
| 69 | Moderated peer-support circles | P | Loneliness is a core driver; peers retain users | LLM-assisted moderation + human mods | H | V3 |
| 70 | Caregiver psychoeducation modules | F | Family behavior changes outcomes | — | L | V2 |
| 71 | Shared safety plan with trusted contacts | P,F | Crisis plan the family can act on | — | L | V1 |
| 72 | Caregiver burnout screening | F | Caregivers are patients-in-waiting | PHQ-9 reuse | L | V3 |
| 73 | Anonymous community Q&A with clinician-verified answers | P | Trustworthy alternative to Reddit at 3 AM | LLM triage of questions | M | V3 |

### J. Accessibility, Localization & Inclusion (6)

| # | Feature | User | Benefit | AI/ML | Cx | Tier |
|---|---|---|---|---|---|---|
| 74 | Offline-first mobile [E: AsyncStorage] | P | Rural/low-connectivity | — | M | MVP |
| 75 | Full Indic-language UI + chat | P | Access; indic-bert already in stack | Multilingual LLM + i18n | H | V2 |
| 76 | Voice-first mode (low literacy) | P | Rural + elderly reach | STT/TTS (Sarvam) | H | V3 |
| 77 | SMS/IVR fallback for feature phones | P | Government/rural deployments | — | H | LTV |
| 78 | Screen-reader compliance (WCAG 2.2 AA) | P,C | Legal + ethical baseline | — | M | V1 |
| 79 | Low-bandwidth mode (no images, batched sync) | P | Data-cost sensitivity | — | L | V2 |

### K. Population Programs (8)

| # | Feature | User | Benefit | AI/ML | Cx | Tier |
|---|---|---|---|---|---|---|
| 80 | Women's mental health: cycle-aware care [E: cycle LSTM] | P | PMDD/perinatal — underserved, differentiated | LSTM (exists) | H | MVP |
| 81 | Perinatal mode (EPDS screening) | P,C | Postpartum depression: high stakes, clear protocol | EPDS + risk model | M | V2 |
| 82 | Student mode (campus counseling integration, exam-period sensitivity) | P,A | Universities are the beachhead GTM segment | Calendar-aware features | M | V1 |
| 83 | Workplace/EAP mode (aggregate-only employer reporting) | A | B2B revenue; individual data never exposed to employer | Differential aggregation | M | V2 |
| 84 | Elderly mode (large type, simplified flows, caregiver link) | P,F | Fastest-growing demographic; fall detection synergy | — | M | V3 |
| 85 | Adolescent mode (guardian consent, age-appropriate LLM persona) | P,F | Huge need; heavy compliance | Persona + guardrails | H | LTV |
| 86 | Government/district deployments (ASHA-worker referral loop) | A | India public-health integration; Tele-MANAS synergy | — | H | LTV |
| 87 | Chronic-illness comorbidity mode (diabetes+depression) | P,C | Comorbid depression doubles cost; payers care | Shared biometric pipeline | M | LTV |

### L. Telemedicine & Health-System Integration (7)

| # | Feature | User | Benefit | AI/ML | Cx | Tier |
|---|---|---|---|---|---|---|
| 88 | In-app teleconsult booking | P,C | Close the loop from alert → appointment | — | M | V2 |
| 89 | Video visits (embedded SDK) | P,C | Continuity for remote patients | — | M | V2 |
| 90 | FHIR API (Patient, Observation, QuestionnaireResponse, RiskAssessment) | A | Hospital/EHR integration; ABDM alignment in India | — | H | V2 |
| 91 | e-Prescription integration | C | Adherence loop gets refill ground truth | — | H | V3 |
| 92 | Referral network routing | C | Stepped-care: route to the right intensity | — | M | V3 |
| 93 | Insurance/payer outcome reports | A | Value-based-care evidence pack | Outcome aggregation | M | V3 |
| 94 | Hospital ward handoff (admission/discharge triggers) | C,A | Post-discharge is the highest-risk window | ADT event ingestion | H | LTV |

### M. Research Platform (5)

| # | Feature | User | Benefit | AI/ML | Cx | Tier |
|---|---|---|---|---|---|---|
| 95 | Consented research data export (de-identified) | R | Revenue + publications + model improvement | De-identification pipeline | M | V2 |
| 96 | EMA study builder for researchers | R | Universities pay for this | JITAI infra reuse | H | V3 |
| 97 | Federated learning across deployments | R,A | Train on data that never leaves the hospital | FL infrastructure | H | LTV |
| 98 | Open benchmark contributions (de-identified) | R | Credibility flywheel in academic community | — | M | LTV |
| 99 | A/B intervention trials framework | R | Which JITAI content works — publishable | Experiment assignment + stats | M | V3 |

### N. Privacy, Trust & Compliance (6)

| # | Feature | User | Benefit | AI/ML | Cx | Tier |
|---|---|---|---|---|---|---|
| 100 | Field-level encryption [E: AES-256-GCM] | P | Journals unreadable even with DB access | — | M | MVP |
| 101 | Granular consent management (per-data-type, revocable) | P | DPDP Act/GDPR requirement; trust differentiator | — | M | V1 |
| 102 | Access audit log (every clinician read recorded) | P,A | Accountability; compliance evidence | — | L | V1 |
| 103 | Data export + right-to-deletion self-service | P | DPDP/GDPR data-subject rights | — | M | V2 |
| 104 | Transparency panel ("what the AI sees about me") | P | Radical transparency as brand; shows SHAP to the patient | SHAP reuse | M | V2 |
| 105 | Data retention policies + auto-purge | A | Minimize breach blast radius | — | L | V2 |

### O. Platform & Ops (6)

| # | Feature | User | Benefit | AI/ML | Cx | Tier |
|---|---|---|---|---|---|---|
| 106 | Push notifications via FCM [partial E] | P | Delivery channel for JITAI + reminders | — | L | MVP |
| 107 | Admin console (org onboarding, clinician management) | A | B2B operability | — | M | V2 |
| 108 | Observability stack (OTel, dashboards, alerting) | A | You cannot run a crisis-detection service blind | — | M | V1 |
| 109 | MLflow model registry + versioned deployments | A | Which model version scored this patient — auditability | — | M | V2 |
| 110 | Multi-tenancy with org-level isolation | A | Hospitals demand it | — | H | V2 |
| 111 | Status page + incident process | A | A downed crisis pipeline is a clinical incident | — | L | V1 |

**Count: 111 features**, of which ~20 already exist in code.

---

## 7. Feature Prioritization — Rationale

### Hackathon MVP (demo in days)
**Already built:** the closed loop (mood→risk→alert), chat with crisis gating, JITAI, anomaly detection, cycle LSTM, dashboard, encryption.
**Add now (each ≤ a day):**
- **#9/#10 PHQ-9 + GAD-7** — answers the inevitable "where's the validated measure" question; trivially a React Native form + score history + one risk feature.
- **#42 Medication reminders** — directly named in the problem statement; a scheduled notification + adherence log.
- **#48 AI patient summary** — one LLM call over existing structured logs; the single most impressive dashboard demo moment.
- **#50 SHAP panel** — data already computed; just render it.
- **#56 Crisis screen + #40 safety plan** — turns crisis *detection* into crisis *response*; ethically mandatory before demoing crisis features to judges.
- **#4 LLM output guardrail** — cheap insurance against the judge who types "what dose of sertraline should I take."

**Why these:** every one is either a judge-question pre-emption or a problem-statement checkbox, and none requires new ML.

### V1 (0–3 months): trust & clinical hardening
Consent + audit (#101/#102), alert SLA (#49), relapse mode (#31), adaptive assessments (#11), CBT flows (#5), device-adapter formalization + Fitbit Web API (#18/#19), accessibility (#78), observability (#108), test suite (W3), composite indexes (W4). Theme: *make it safe to pilot with real patients.*

### V2 (3–9 months): scale & breadth
PostgreSQL migration, HealthKit + Garmin/Samsung, phone-only sensing (#23), GPS mobility (#24), mood forecasting (#30), bandit JITAI (#39), FHIR (#90), workplace mode (#83), MLflow (#109), multi-tenancy (#110). Theme: *make it deployable by organizations.*

### V3 (9–18 months): ecosystem
Peer community, voice biomarkers, teleconsult marketplace, insurance reporting, research platform, EMA builder. Theme: *make it a platform others build on.*

### Long-Term Vision
Federated learning, government/ASHA integration, SMS/IVR reach, treatment-response prediction (needs the dataset only years of operation produce), adolescent programs. Theme: *population-scale mental-health infrastructure.*

---

## 8. Product Design — Mobile App & Clinician Dashboard

Design intent: **calm, clinical, elegant. No emojis anywhere in the product UI.** The visual language should say "medical instrument," not "wellness toy." (When implementing UI changes, apply the `/frontend-design` and `/web-design-guidelines` skills per screen.)

### 8.1 Design system (both surfaces)

- **Color:** deep neutral base (near-black ink on warm off-white; dark mode inverse), one desaturated therapeutic accent (sage or slate-teal), and a strict semantic scale for risk: muted amber → deep red, never traffic-light green/red pairs (colorblind-safe, less alarming). Existing `mobile-app/src/theme/theme.js` is the single source of truth — extend it, don't fork it.
- **Type:** one serif for reflective moments (journal prompts, insights headlines), one humanist sans for UI. Generous line-height. Numbers in tabular figures on the dashboard.
- **Motion:** slow, small, purposeful (150–250 ms ease-out); no bouncing, no confetti. A depressed user's app should never be louder than they are.
- **Language:** warm, direct, never clinical-cold nor toy-cute. "Your sleep shifted this week" not "Uh-oh! Sleepy time trouble!"

### 8.2 Mobile app (patient) — screen map

```
Tab bar: Today · Chat · Journal · Insights   (Cycle & Settings from Today)
├─ Today (Home.js, exists): one primary check-in action, medication card (ADD),
│    next appointment, gentle JITAI card when receptive — max ONE nudge visible
├─ Chat (exists): full-screen conversation, typing indicator, crisis screen
│    interception (ADD #56) — helplines + safety plan surface above the fold
├─ Journal (exists): freeform + prompted; encryption badge ("Only you and your
│    clinician can read this") as a trust cue
├─ Insights (exists): weekly narrative + trend sparklines; PHQ-9 trajectory (ADD)
├─ Cycle (exists): vulnerability forecast, phase-aware copy
└─ Assessments (ADD): PHQ-9/GAD-7 as conversational one-question-per-screen
     flow, not a 9-row form — completion rates double
```

### 8.3 Clinician dashboard — screen map

```
├─ Caseload (Dashboard.jsx, exists): triage-sorted patient table — risk badge,
│    trend arrow (7-day delta), last-contact, dropout-risk chip; unacknowledged
│    alerts pinned to top
├─ Patient Detail (PatientDetail.jsx, exists): timeline view — mood, biometrics,
│    assessments on one time axis; ADD: AI summary card (top), SHAP "why this
│    score" panel, notes
├─ Alerts (Alerts.jsx, exists): queue with acknowledge/resolve actions (ADD SLA
│    timestamps #49); crisis alerts visually dominant, everything else quiet
└─ Analytics (V2): caseload outcomes, remission trends
```

**The dashboard design principle:** a clinician with 300 patients gets *ranked attention*, not data. Every screen answers "who, why, what next" in that order. Raw journal text is never shown — only model-derived signals and (consent-gated) AI summaries; this is both a privacy stance and a screen-time economy.

---

## 9. Wearable Integration — Device-Agnostic Architecture

### 9.1 Recommendation (direct answer)

Use **all four, in three places, behind one interface**:

| Adapter | Where it runs | Covers | Priority |
|---|---|---|---|
| **Google Health Connect** | On-device (Android) — already integrated in `HealthConnectService.js` | Fitbit (syncs to HC since 2023), Pixel Watch, Samsung (Health app), Wear OS, Xiaomi/Amazfit/Huawei (via their Android apps) | **Primary, exists** |
| **Apple HealthKit** | On-device (iOS) | Apple Watch + anything syncing to Apple Health | V2 (with iOS app) |
| **Fitbit Web API** | Server-side (OAuth + webhooks) | Charge 6 full-fidelity data (intraday HRV, SpO2, stress) that HC doesn't fully expose | V1 |
| **Garmin Health / Samsung Health SDK** | Server-side | Vendor completeness for org deployments | V2 |

**Skip Google Fit** — deprecated in favor of Health Connect; building on it is building on a scheduled demolition.

**Why Health Connect as the hub:** it inverts the N-vendor problem. Every major vendor already writes into Health Connect on Android; one on-device adapter covers ~80% of the Indian Android-dominant market. The prototype Fitbit Charge 6 works through it today, and the Fitbit Web API adapter later upgrades data *fidelity* without changing any application logic — which is exactly the test of a good abstraction.

### 9.2 The adapter architecture

```
Patient Mobile App
      │
Wearable Integration Layer  ← one interface: fetchBiometrics(userId, range)
      │                        → returns UnifiedHealthSample[]
┌─────┴──────────────────────────────────────────────┐
│ HealthConnectAdapter (on-device, Android)  [EXISTS] │
│ HealthKitAdapter     (on-device, iOS)      [V2]     │
│ FitbitCloudAdapter   (server, OAuth+webhook) [V1]   │
│ GarminCloudAdapter   (server, webhook)     [V2]     │
│ SimulatedAdapter     (demo/dev mode)       [EXISTS] │
└─────┬──────────────────────────────────────────────┘
      │
Unified Health Data Model (§9.4) → backend ingestion → feature engineering → ML
```

Each adapter is a **deep module** (Ousterhout): the interface is two functions (`getCapabilities()`, `fetchSamples(types, range)`); everything vendor-specific — OAuth dances, rate limits, unit quirks, pagination — is buried inside. Adding Huawei later = one new file, zero changes elsewhere.

### 9.3 Why this beats direct Fitbit integration

1. **Vendor lock-in is a product risk, not just a code smell.** Fitbit's API access policies have tightened repeatedly post-Google-acquisition; a Fitbit-coupled data model would make every schema decision hostage to one vendor's roadmap.
2. **The ML pipeline must be vendor-blind.** Models train on `hrv_rmssd_ms`, not `fitbit.hrv.dailyRmssd`. Direct integration leaks vendor schemas into feature engineering, and every new vendor then means retraining/re-mapping.
3. **Org sales require device pluralism.** A hospital pilot cannot mandate a watch brand. "Bring any device" is a sales feature enabled purely by architecture.
4. **Graceful capability degradation.** `getCapabilities()` lets the risk model mask missing features (e.g., no HRV from a budget band) instead of failing — the 15-feature XGBoost already handles missing features.

### 9.4 Unified Health Data Model

One canonical sample shape (Open-mHealth-inspired, FHIR-Observation-mappable for §V2 interop):

```
UnifiedHealthSample {
  userId, source { vendor, device, adapter }, type,        // enum below
  value (number) | series (sleep stages etc.),
  unit,                      // canonical per type, converted in the adapter
  startTime, endTime (ISO),  // instant samples: start == end
  confidence (0–1, optional), ingestedAt, rawRef (optional pointer, debugging)
}
```

Canonical types and units: `heart_rate` bpm · `resting_heart_rate` bpm · `hrv_rmssd` ms · `spo2` % · `ecg` series · `respiratory_rate` br/min · `sleep_session` min + stage series (`awake|light|deep|rem` — vendors' 4-stage models map cleanly; anything finer downsamples) · `steps` count · `active_calories` kcal · `stress_score` 0–100 normalized (vendor scales min-max mapped; store `rawRef` since vendor stress algorithms differ — treat cross-vendor stress as ordinal, not cardinal) · `skin_temperature_delta` °C · `body_temperature` °C · `mobility_radius` m (from GPS, V2) · `sedentary_minutes` min · `fall_event` event.

**Normalization rules live in adapters, never downstream:** unit conversion, timezone-to-UTC (store user TZ separately — circadian features need local time), dedup by `(userId, type, startTime, source)` idempotency key, and outlier gating (physiologic range checks) at ingestion.

---

## 10. Database Design

### 10.1 Now (Firestore — keep for MVP/V1)

Existing collections (verified): `users` (riskLevel, cycle data, baselines), `moodLogs` (encrypted journal + NLP scores + risk features), `cycleLogs`, `chatLogs` (encrypted), `clinicianAlerts` (resolved flag, type), `jitaiLogs`, biometric documents.
V1 additions: `assessments` (PHQ-9/GAD-7 scores + item answers), `medications` + `medicationEvents` (scheduled/taken/skipped), `appointments`, `consents`, `auditLogs`, `safetyPlans`, `notifications`.
V1 hygiene: create the composite indexes (URLs printed in backend logs), restore server-side filtered queries with `limit()`, add `orgId` to every document now (multi-tenancy is a migration nightmare retrofitted later).

### 10.2 Production (PostgreSQL + TimescaleDB, V2)

```sql
-- Identity & care structure
orgs(id, name, type, settings jsonb)
users(id uuid PK, org_id FK, role enum(patient,clinician,admin,caregiver),
      email, auth_provider_id, profile jsonb, created_at)
care_relationships(patient_id FK, clinician_id FK, relationship enum,
      started_at, ended_at, PRIMARY KEY(patient_id, clinician_id, relationship))
emergency_contacts(id, patient_id FK, name, phone, relationship, consent_scope jsonb)

-- Clinical record
assessments(id, patient_id FK, type enum(phq9,gad7,cssrs,epds), score int,
      item_answers jsonb, administered enum(self,clinician,adaptive), taken_at)
      -- INDEX (patient_id, type, taken_at DESC)
mood_logs(id, patient_id FK, mood_score int, journal_ciphertext bytea,
      sentiment float, emotion jsonb, crisis_prob float, divergence float, logged_at)
journal_entries → folded into mood_logs (matches current model)
chat_messages(id, patient_id FK, role enum(user,assistant), ciphertext bytea,
      crisis_prob float, lang varchar(8), created_at)
medications(id, patient_id FK, name, dose, schedule jsonb, prescriber_id FK, active bool)
medication_events(id, medication_id FK, due_at, status enum(taken,skipped,missed), responded_at)
appointments(id, patient_id FK, clinician_id FK, scheduled_at, status
      enum(scheduled,completed,no_show,cancelled), notes_ciphertext bytea)
safety_plans(id, patient_id FK, content_ciphertext bytea, updated_by FK, updated_at)

-- Time series (Timescale hypertables)
health_samples(time timestamptz, patient_id, type, value float, series jsonb,
      unit, vendor, confidence)          -- hypertable, partition by time,
                                         -- segment by patient_id; continuous
                                         -- aggregates for daily features
-- ML
risk_scores(id, patient_id FK, score float, level enum, features jsonb,
      shap jsonb, model_version, scored_at)   -- append-only: auditability
predictions(id, patient_id FK, kind enum(dropout,relapse,mood_forecast,jitai),
      payload jsonb, model_version, created_at)
alerts(id, patient_id FK, kind enum(crisis,deterioration,dropout,follow_up_loss),
      severity, source_ref, acknowledged_by FK NULL, acknowledged_at, resolved_at)
jitai_events(id, patient_id FK, intervention_id, receptivity float,
      delivered_at, engaged bool NULL)   -- the bandit's training data

-- Trust
consents(id, patient_id FK, scope enum(biometrics,journal_nlp,ai_summary,
      caregiver_share,research), granted bool, granted_at, revoked_at)
audit_logs(id, actor_id FK, action, resource_type, resource_id,
      patient_id FK, at)                 -- append-only, no UPDATE grant
notifications(id, user_id FK, channel enum(push,sms), payload jsonb,
      sent_at, opened_at)
```

Every patient-data query path is indexed on `(patient_id, time DESC)`; org-scoped dashboards on `(org_id, ...)` via join through users. Ciphertext columns keep the existing AES-256-GCM field-level model — the database never holds plaintext journals, chats, notes, or safety plans.

---

## 11. REST API Design

Conventions: `/api/v1/*`, JWT bearer (Firebase now, standard OIDC-compatible later), patient-scoped routes enforce self-or-assigned-clinician via `authorize.js` (exists), cursor pagination (`?after=`), errors as `{error: {code, message}}`. Current unversioned routes stay until mobile clients migrate.

```
Auth        POST /auth/register · POST /auth/session (token exchange)
            GET  /auth/me · DELETE /auth/session
Mood        POST /mood/log [E] · GET /mood/history/:uid [E] · GET /mood/weekly/:uid [E]
Assessments POST /assessments {type, answers} → scored server-side
            GET  /assessments/:uid?type=phq9 · GET /assessments/:uid/latest
Chat        POST /chat/message [E] · GET /chat/thread/:uid [E, self-only]
Wearables   POST /biometrics/sync [E] · GET /biometrics/:uid/daily?from=&to=
            POST /wearables/connect {vendor} (cloud-adapter OAuth start)
            POST /webhooks/fitbit · /webhooks/garmin (signed, no JWT)
            GET  /wearables/capabilities/:uid
Medication  POST /medications · GET /medications/:uid
            POST /medications/:id/events {status} · GET /medications/:uid/adherence
AI (internal, backend→ai-service only — never exposed to clients)
            POST /api/sentiment · /api/emotion · /api/crisis · /api/predict/risk
            /api/dropout · /api/cycle/predict · /api/jitai/receptivity
            /api/anomaly/score · /api/chat  [all E]
Clinician   GET  /clinician/patients [E] · GET /clinician/patients/:uid/summary (LLM, ADD)
            GET  /clinician/alerts?status=open · POST /clinician/alerts/:id/ack
            POST /clinician/alerts/:id/resolve · POST /clinician/patients/:uid/notes
Notifications GET /notifications · POST /devices {fcmToken} · PATCH /notifications/prefs
Emergency   GET  /emergency/resources?lat=&lng= · POST /emergency/contacts
            POST /emergency/escalate (patient-initiated SOS)
Consent     GET/PUT /consents · GET /me/export · DELETE /me (data-subject rights)
```

Design notes: the AI service stays a **private** internal API (network-isolated in production) — clients never call ML endpoints directly, so models can change shape without mobile releases. Webhooks authenticate by signature verification, are idempotent (dedup key §9.4), and enqueue rather than process inline.

---

## 12. AI & ML Architecture

### 12.1 The pipeline (every stage, concretely)

```
Smartwatch → vendor app → Health Connect / cloud API      (raw vendor samples)
  → Adapter layer                                          (UnifiedHealthSample; units, TZ, dedup)
  → Mobile app / webhook → Backend API                     (auth, consent check, encrypt PII)
  → Database (Firestore now; Timescale V2)                 (raw samples + daily aggregates)
  → Feature engineering                                    (baselineService.js: personal baselines,
                                                            deltas, rolling stats, circadian features,
                                                            divergence, adherence, engagement recency)
  → Models (below)                                         (score on event + scheduled sweeps)
  → Risk fusion (XGBoost 15-feature + SHAP)                (one score, explained)
  → Clinician dashboard (triage, alerts)  +  JITAI check   (receptivity-gated patient nudge)
  → Outcomes recorded (alert acks, engagement, next PHQ-9) (labels for retraining)
  → Continuous feedback loop                                (drift monitoring → retrain → registry → redeploy)
```

The last two lines are the part most teams never build: **the system generates its own training labels** (did risk rise before the PHQ-9 worsened? did the user engage with the nudge? did the patient drop out?). That is the data moat.

### 12.2 Model portfolio

| Model | Status | Inputs → Output | Labels / dataset | Metrics | Deploy · Monitor · Retrain |
|---|---|---|---|---|---|
| Crisis detection | **E** (`mental/mental-roberta-base`) | journal/chat text → crisis prob | Public (e.g., r/SuicideWatch-derived corpora) + curated; fine-tune on flagged+adjudicated in-house data | **Recall first** (≥0.95), then precision; calibration; borderline band → human queue (#60) | Local HF on ai-service · log score dist + human-review overturn rate · fine-tune quarterly, threshold-tune monthly |
| Sentiment | **E** (indic-bert) | text → polarity | Public Indic sentiment sets | Macro-F1 per language | Local HF · per-language drift · semi-annual |
| Emotion | **E** (distilroberta) | text → 7-emotion dist | GoEmotions-class public | Top-2 accuracy | Local HF · dist drift · annual |
| Risk fusion | **E** (XGBoost, 15 feats + SHAP) | mood, sentiment, divergence, cycle vulnerability, anomaly score, biometric deltas, engagement recency… → risk 0–1 + level | **Today: synthetic. Path:** label = PHQ-9 ≥ threshold or clinician-confirmed deterioration within 14 days of score | AUROC, AUPRC, **calibration (Brier)**, sensitivity at fixed alert budget (alerts/clinician/day is the real constraint) | pkl now → MLflow registry · feature drift + alert precision (ack-and-action rate as weak label) · monthly once real labels flow |
| Dropout/attrition | **E** (XGBoost) | engagement recency/frequency/trends → dropout prob | Label = 21 days no engagement (observable, cheap, abundant — the easiest model to make real fast) | AUROC; precision@top-decile (outreach capacity is limited) | Same as risk · monthly |
| Cycle vulnerability | **E** (per-user LSTM) | cycle day + mood history → vulnerability curve | Self-supervised on user's own mood series | Per-user MAE vs naive seasonal baseline (report the comparison honestly) | Per-user pkl/pt · min-history gate before trusting output · rolling refit |
| Anomaly | **E** (per-user LSTM autoencoder) | behavioral/biometric sequences → reconstruction error | Self-supervised (personal baseline manifold) | Alert yield: % anomalies preceding confirmed deterioration | Per-user .pt · false-alarm rate per user · rolling window refit |
| JITAI receptivity | **E** (per-user XGBoost) | time, recent activity, context → engage prob | Label = engaged with nudge (auto-generated in `jitaiLogs`) | Engagement lift vs random-time sends (A/B built-in) | Per-user pkl · lift dashboard · weekly per-user refit |
| LLM chat | **E** (Minimax M2.7 @ NVIDIA) | messages + live context → reply | n/a (prompted, not trained) | Human eval rubric (empathy, safety, grounding); guardrail-block rate | Cloud API + fallback · log lang/latency/refusals, **never raw content** · prompt iteration under version control |
| Mood forecast (V2) | new | 30-day mood+biometric+adherence series → 7-day risk curve | Future mood logs (self-labeling) | MAE + directional accuracy vs persistence baseline | Batch nightly · per-cohort accuracy · monthly |
| RAG psychoeducation (V2) | new | query + curated clinical corpus → grounded answer | Curated content only (no open web — hallucinated clinical advice is disqualifying) | Groundedness + clinician spot-audit | ai-service + pgvector · audit sampling · corpus review quarterly |

**Portfolio principles:** (1) self-labeling models (dropout, JITAI, cycle, anomaly, forecast) mature first because their labels are free; (2) clinically-labeled models (risk, crisis) are honest about synthetic origins until pilot data arrives; (3) every model has a *naive baseline it must beat publicly* (persistence, random-timing, seasonal) — this is what separates research-grade claims from demo-grade claims.

### 12.3 Sequence diagrams (the two that matter)

**Mood check-in → clinician alert** (all existing code paths):
```
Patient app          Backend (moodRoutes)        AI service              Firestore            Dashboard
    │ POST /mood/log      │                           │                      │                    │
    ├────────────────────▶│ encrypt journal (AES-GCM) │                      │                    │
    │                     ├── sentiment+emotion+crisis (parallel) ──────────▶│                    │
    │                     │◀── scores ────────────────┤                      │                    │
    │                     ├── cycle vulnerability ───▶│ (per-user LSTM)      │                    │
    │                     ├── 15-feature risk ───────▶│ (XGBoost + SHAP)     │                    │
    │                     ├── write moodLogs + users.riskLevel ─────────────▶│                    │
    │                     ├── if crisis: write clinicianAlerts ─────────────▶│── onSnapshot ─────▶│ alert renders
    │◀── ack + insights ──┤                           │                      │                    │  in <1s (demo gold)
```

**JITAI loop** (existing): hourly `jitaiScheduler` sweep → per-user receptivity model → if receptive AND notification budget allows → FCM nudge → engagement recorded in `jitaiLogs` → next week's model refit. Escalation: `escalationCron` every 15 min sweeps for unresolved crisis alerts + loss-of-follow-up patterns.

---

## 13. Security & Compliance Architecture

**Threat model first:** the assets are (1) journal/chat plaintext, (2) risk scores (stigmatizing if leaked), (3) the crisis pipeline's availability. Adversaries: DB leak, insider clinician overreach, stolen phone, prompt injection into the LLM, and plain bugs.

| Layer | Now (exists) | V1 hardening | Production |
|---|---|---|---|
| AuthN | Firebase `verifyIdToken` everywhere; JWT via Axios interceptor | Token refresh handling, session revocation on logout | OIDC-compatible; MFA for clinicians (they see 300 patients' data) |
| AuthZ | `authorize.js`: self-or-assigned-clinician across 7 route files | Role model (care teams, admins); org scoping | Policy middleware per route + per-field (caregiver sees status, never journals) |
| Encryption | AES-256-GCM field-level before Firestore; TLS | Key rotation procedure; encrypt safety plans + notes | KMS-managed keys, envelope encryption, per-org keys |
| LLM safety | Crisis classifier gates input | Output guardrail (#4); system-prompt hardening; treat retrieved context as data, not instructions | Red-team suite in CI; jailbreak regression tests |
| Consent | Implicit at signup | `consents` collection, per-scope, revocable, checked at read/compute time (a revoked biometrics consent stops feature computation, not just display) | Consent receipts; research consent separate and optional |
| Audit | — | `auditLogs`: every clinician read of patient data, append-only | Tamper-evident (hash-chained); patient-visible access history (#104) |
| Retention | — | Policy doc | Auto-purge schedules; crypto-shredding for right-to-deletion (delete the key, not 40 collections) |
| Compliance frame | — | India DPDP Act 2023 (consent, purpose limitation, breach notification) + ABDM alignment; GDPR principles for portability | HIPAA-equivalent controls for any US expansion; SOC 2 when selling to hospitals |
| Ops security | Secrets in gitignored files | Secret scanning in CI; dependency audit; remove committed venv | Network-isolated ai-service; WAF at gateway; incident runbook — **a downed crisis pipeline is a clinical incident, page like one** |

Two non-negotiable product rules: **never log raw user content containing PII** (log lengths, scores, latencies), and **the employer/org never sees individual data** in workplace deployments — aggregates with minimum-cohort thresholds only.

---

## 14. Technology Stack (final recommendation)

| Layer | Hackathon (keep) | Production evolution | Why |
|---|---|---|---|
| Mobile | React Native + Expo SDK 50 | Same; EAS builds (`eas.json` exists) | Works; JS-only rule satisfied |
| Web | React 18 + Vite | Same + shadcn/ui-style discipline for new surfaces | Elegance is design tokens + restraint, not a framework swap |
| Backend | Node 20 + Express | Same, behind an API gateway; BullMQ workers on Redis | Rewriting to FastAPI buys nothing here — FastAPI already owns the layer it's best at (ML serving) |
| AI service | FastAPI + PyTorch + XGBoost + HF | Same + pgvector for RAG; LangChain only if agentic flows appear (not before — direct API calls are simpler and debuggable) | Prompt's FastAPI requirement: already satisfied |
| LLM | Minimax M2.7 via NVIDIA (OpenAI-compatible) | Multi-provider behind `nvidia_client.py` interface; prompt caching; streaming; explicit max_tokens | Provider-agnostic by construction |
| Data | Firestore | PostgreSQL + TimescaleDB + Redis; S3/GCS objects | §10 migration plan |
| MLOps | pkl files + manual | MLflow (registry + experiments); scheduled retrains; drift checks | §12 |
| Notifications | FCM | FCM + SMS gateway (crisis paths need a non-push channel) | Reach |
| Deploy | Local (dev machine) | Docker Compose (pilot) → Kubernetes (scale); GitHub Actions CI/CD | Right-sized per stage |
| Observability | Console logs | OpenTelemetry → Grafana/Loki/Tempo; Sentry on clients | §13 ops |

---

## 15. Deployment, MLOps & Scalability

### Scaling stages

| Stage | Users | Architecture | The bottleneck you'll actually hit |
|---|---|---|---|
| Pilot | 1K | Docker Compose on one VM (all 5 services); Firestore | Nothing technical — clinician onboarding is the bottleneck |
| Growth | 100K | Managed Postgres+Timescale; Redis; 2–3 backend replicas; ai-service replicas behind LB; queue for ingestion | Biometric ingestion writes + NLP inference latency → batch + queue |
| Scale | 1M | Kubernetes; NLP models on GPU nodes with dynamic batching; feature store (precomputed daily aggregates); read replicas | Per-user model files → move personalization to feature-conditioned shared models (one LSTM conditioned on user embedding, not 1M .pt files) — **this is the biggest architectural change scale forces** |
| Population | 10M | Multi-region; per-org data residency; federated learning for cross-org model improvement; SMS/IVR edge | Regulatory + organizational, not technical |

### MLOps pipeline (V2)

```
data snapshot → feature build → train → eval vs baseline + current champion
→ fairness slice checks (gender, language, device-type — a model that only
   works for English-speaking Fitbit owners is a clinical equity failure)
→ MLflow registry (staged) → shadow deploy (score, don't act) → promote
→ monitor: feature drift, score drift, alert precision, per-slice performance
→ trigger retrain on drift threshold or calendar
```

Model governance: every risk score stored with `model_version` (schema §10.2 provides this) — "which model said this patient was low-risk" must always be answerable.

---

## 16. Startup Thinking

**Why patients stay:** the app gives before it asks — insights from passive data arrive without effort; the chat is available at 2 AM in their language; nudges come when receptive (JITAI), not on a marketer's schedule. Retention design is *calm utility*, not streak-anxiety.

**Why clinicians adopt:** it gives them time back (AI summary + triage = the 15-minute visit prepped in 30 seconds), catches deterioration they'd be blamed for missing, and shows its reasoning (SHAP). Sell it as a stethoscope for the 729 unobserved hours, not an AI colleague.

**Why hospitals:** attrition and readmission are revenue and accreditation problems; a continuity layer with outcome dashboards is a measurable fix. **Why universities:** student mental-health demand exceeds counseling capacity 10:1; triage stretches the same counselors further (and campuses are the fastest pilot to close). **Why insurers:** untreated/relapsing depression is expensive (comorbidity multiplier ~2x); pay-for-outcomes fits value-based care. **Why government:** Tele-MANAS created national crisis infrastructure with no continuity layer; NIRANTHARA is the missing follow-up limb, multilingual by design.

**UVP (one sentence):** *The only platform that closes the loop — passive detection, just-in-time intervention, clinician escalation, and follow-up recapture — personalized per patient, explainable per decision, in Indian languages.*

**Moats, in order of real defensibility:** (1) the outcome-labeled longitudinal dataset the feedback loop generates (§12.1 — nobody can shortcut time), (2) per-user personalization infrastructure, (3) clinician workflow lock-in, (4) multilingual clinical NLP.

**Monetization:** B2B2C per-patient-per-month licensing to clinics/hospitals (primary); campus licenses (beachhead); EAP/workplace (aggregate-only); payer outcome contracts (later); consented research partnerships (later). **Do not** charge patients directly — Mindstrong's grave is marked "D2C for serious mental illness."

**GTM sequence:** 2–3 psychiatry clinics (design-partner pilots, free, outcome-instrumented) → publish attrition/engagement deltas → university counseling centers (volume + press) → hospital systems (credibility from #1–2) → government pilot (one district, ASHA-linked). Network effects are data-side (every patient improves the models every future patient gets) and workflow-side (clinician referral graphs), not social.

---

## 17. Hackathon Judge Review (adversarial pass)

**Hard questions judges will ask, with the honest answers:**

1. *"Your risk model is trained on what?"* — Synthetic data today. The defensible answer: the architecture is built to self-label (§12.1), the self-labeling models (dropout, JITAI) become real within weeks of a pilot, and we publicly benchmark against naive baselines. Never bluff this — one probing question destroys credibility.
2. *"What happens when crisis detection fires at 3 AM and no clinician is awake?"* — Today: alert sits in queue. Required answer before demo: in-app crisis screen (#56) fires *instantly* client-side with helplines + safety plan; the human alert is escalation, not the only response. Build this before the demo.
3. *"False positives will make clinicians ignore alerts."* — Correct, and it's why the metric is precision-at-fixed-alert-budget, alerts carry SHAP context, and there's an acknowledgment loop feeding threshold tuning. Say "alert fatigue" before they do.
4. *"Is the chatbot giving therapy? Who's liable?"* — It's a support companion with guardrails, not a treatment device. Clinical decisions stay with clinicians; the LLM never advises on medication (#4). If it ever makes treatment claims it enters medical-device territory (India CDSCO / FDA SaMD) — the roadmap words matter legally.
5. *"Privacy: you're mining depressed people's journals."* — Field-level AES-256-GCM (exists), NLP-derived scores not raw text on the dashboard, consent scopes, audit logs, and a patient-facing transparency panel on the roadmap. Strong answer, already mostly true.
6. *"Wearables lie — HRV from a wrist is noisy."* — Yes: per-user baselines (not population cutoffs), confidence-weighted features, missing-data-tolerant fusion. Wearables are one of 15 features, not the verdict.
7. *"Ethical risk: algorithmic triage could deprioritize someone who then dies."* — The system only *adds* attention, never gates care; low risk score ≠ no care, it means standard cadence. Escalation cron guarantees no patient silently exits the system — that's the loss-to-follow-up sweep's real purpose.
8. *"Bias?"* — Fairness slices per gender/language/device in the eval pipeline (§15); indic-bert reduces English-first bias; cycle model makes women's health a first-class signal instead of a confounder.

**Weaknesses to fix before demo day (priority order):** crisis screen (#56) · LLM output guardrail (#4) · PHQ-9 (#9) · AI summary (#48) · SHAP panel (#50) · README model prose (stale "Gemma/Ollama" — judges read READMEs) · rehearsed answer to question 1.

### Presentation strategy

Demo arc (7 min): open with the 729-hours problem (30s) → patient logs a low mood with a concerning journal line on the phone → **the clinician dashboard, projected side-by-side, updates live within a second** (onSnapshot is your showstopper — rehearse it) → walk the SHAP panel ("the AI shows its work") → show the JITAI nudge and cycle forecast ("intervention, not just detection") → AI patient summary ("15-minute visit, prepped in 30 seconds") → close on the loop diagram + the data-moat sentence. Use simulated-data demo mode (exists) — never depend on live Bluetooth on stage. Investor addendum: market (India: ~200M with mental disorders, <1 psychiatrist per 100K), the loop as moat, B2B2C model, design-partner pipeline, and the honest data-maturity slide — sophistication about your own limitations is what separates fundable teams.

---

## 18. Roadmap & Research Opportunities

**Roadmap:** MVP (demo week): §7 MVP list. V1 (0–3 mo): pilot-safety hardening + first clinic design partner. V2 (3–9 mo): Postgres, iOS/HealthKit, forecasting, FHIR, multi-tenancy, MLflow. V3 (9–18 mo): community, voice, teleconsult, research platform. LTV (18 mo+): federated learning, government scale, SMS/IVR, treatment-response prediction.

**Publishable research this platform enables:** JITAI receptivity-timing efficacy (per-user RCT framework #99), digital-phenotype → PHQ-9 trajectory prediction in Indian populations (an unstudied cohort — most literature is US/EU), cycle-mood coupling at scale, dropout-prediction-triggered outreach as an attrition intervention (directly tests the problem statement), and multilingual crisis-classifier calibration. Each is a paper *and* a credibility asset; university partnerships supply both data and distribution.

---

## 19. How to Run (verified against this repo)

Prereqs per service — all five run independently; required gitignored files must exist first: `backend/serviceAccountKey.json`, `backend/.env` (PORT, AI_SERVICE_URL, encryption key), `ai-service/.env` (NVIDIA_API_KEY, Sarvam keys), `dashboard/.env`, `mobile-app/src/utils/firebase.js`. `.env.example` files exist for backend and smartwatch.

```powershell
# 1. AI service (Python 3.11; do NOT use the committed venv — it's machine-pinned)
cd ai-service ; python -m venv .venv ; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt ; uvicorn main:app --reload --port 8000

# 2. Backend (Node 20) — starts JITAI scheduler + escalation cron on listen
cd backend ; npm install ; node index.js        # :5000

# 3. Clinician dashboard
cd dashboard ; npm install ; npm run dev        # :5173

# 4. Mobile app (Expo) — for a physical device, first set BASE_URL in
#    src/utils/api.js to your machine's WiFi IPv4; Android emulator: 10.0.2.2
cd mobile-app ; npm install ; npm start

# 5. Optional smartwatch simulator
cd smartwatch ; npm install ; npm run dev

# Seed a demo user:  cd backend ; node scripts/seedTestUser.js
```

Verification (no test suite exists — verify by running): ai-service `GET :8000/api/health` shows model readiness · backend logs show both crons started · log a mood in the mobile app and watch the dashboard update live · long-press demo triggers exist in Home.js for crisis/data-source toggling (demo scaffolding — remove after the hackathon). First dashboard queries may print Firestore composite-index creation URLs in backend logs — click them once per project.


