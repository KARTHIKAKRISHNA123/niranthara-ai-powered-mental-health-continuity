# NIRANTHARA — Master Knowledge Document
**Your technical bible, interview handbook, viva notes and judge-prep guide.**
Written 2 August 2026 against the frozen code. Every fact here was read out of the
repository or measured against the running services. Where the project genuinely
does not specify something, it says **"Not specified in the project."**

> **How to use this.** Read Ch. 1–3 for the story, Ch. 15 for the flows (that one
> chapter answers most judge questions), Ch. 25 the morning of. Chapters 19–21 are
> the ~80 questions that actually get asked — deliberately not padded to 300,
> because a padded list is a worse study tool and this document refuses to
> overclaim for the same reason the product does.

---

# CHAPTER 1 · Problem Statement Deep Dive

> *"How might we utilize AI chatbots and machine learning to address incomplete
> alleviation of depression symptoms, attrition, and loss of follow-up in mental
> health treatment?"*

## The three clauses, decoded

**"Incomplete alleviation of depression symptoms."** The patient is in treatment
and is *not getting better*, or is only partly better. Clinically this is
**partial response** (some improvement, not enough) and **residual symptoms**
(specific symptoms persisting after the total score improves). Residual symptoms
are the single strongest predictor of relapse. Crucially, they are **invisible to
a total score** — a PHQ-9 that falls 18 → 9 looks like success while insomnia and
anhedonia sit untouched at 2/3 each.

**"Attrition."** The patient stops engaging. Not a dramatic exit — a fade.
Check-ins get sparse, notifications go unopened, then nothing.

**"Loss of follow-up."** The system loses contact entirely and *nobody notices*.
This is the failure mode that kills people, because it is silent by definition.

## The hidden meaning judges are testing

The word doing the work is **"address."** Not detect. Not predict. **Address.**

Most submissions to this problem statement build a detector: risk score,
dashboard, alert. That answers *"who is deteriorating"* — which is a question the
clinician usually already has an intuition about. The problem statement is asking
about **the treatment failing**, and to speak to that you must measure what
happened *after* the intervention.

**The one-line test:** if your system can't answer *"you told me she was
deteriorating — what happened after you told me?"*, you built a detector, not a
solution.

## Why existing solutions fail

| Solution | What it does | Where it stops |
|---|---|---|
| Wysa, Woebot | CBT-style conversational agent | Measures *engagement*, not symptom change. No clinician in the loop |
| Standard EHR / portals | Records visits and scores | Only sees the patient at appointments — the 1 hour, not the 8,759 |
| PHQ-9 alone | Validated severity total | Total-score blind: cannot see residual symptoms |
| Wearable apps | Sleep, HR, steps | No clinical framing, no intervention, no outcome |

None of them close the loop. That gap is the entire reason this project exists.

## Stakeholders and what each gets

| Stakeholder | Receives |
|---|---|
| **Patient** | Continuous, low-friction support; a small daily plan; a visible answer to "am I getting better?" |
| **Clinician** | Between-visit visibility; a triage list ordered by who is *not responding*; a summary that saves chart time |
| **Health system** | Fewer silent dropouts; earlier escalation |
| **Regulator / ethicist** | Auditable decisions, deterministic safety floors, explicit uncertainty |

## Success metrics (the honest set)

- **Incomplete alleviation:** PHQ-9 trajectory slope; % reaching treatment
  response (≥50% reduction); count of patients flagged `plateau`
- **Attrition:** check-in adherence over 14/30 days; intervention engagement rate
- **Loss of follow-up:** `daysSinceContact`; count of loss-of-contact alerts and
  time-to-resolution

---

# CHAPTER 2 · Product Understanding

**Vision.** A continuity-of-care engine for depression treatment. The chatbot is
one component; the product is the measurement loop around it.

**Positioning line.** *"We measure whether mental-health interventions actually
worked — in English, Tamil and romanised Tamil — and we refuse to report an
effect we can't support."*

## Users and journeys

**Patient journey.** Sign up → onboarding (gender asked, **never inferred**;
cycle tracking opt-in) → daily check-in (mood 1–5 + optional journal) → passive
signals (wearable) → periodic PHQ-9/GAD-7 → receives JITAI nudges and a daily
recovery plan → sees a recovery score with its components.

**Clinician journey.** Login → caseload ordered by risk → live alerts via
Firestore `onSnapshot` → patient detail: risk + SHAP, assessment trajectory,
**Recovery panel** (score, components, residual symptoms, effectiveness table,
next intervention + rationale) → Generate AI summary → Flag / Resolve → PDF export.

**Admin journey.** *Not specified in the project.* There are two roles in
`users.role`: `user` and `clinician`.

## Competitive advantage (be honest about which is durable)

1. **The outcome loop** — differentiating today, but ~500 lines of arithmetic and
   copyable. It becomes a moat only as the outcome dataset accumulates.
2. **The regional-language safety pipeline** — measured Tanglish crisis detection
   (0.008 → 0.96 with Sarvam routing). Incumbents have not invested here. **This
   is the more defensible asset.**
3. **Honesty as product** — `confidence: insufficient` shipped to a clinician's
   screen. Hard for a competitor to copy because it requires giving up a number.

---

# CHAPTER 3 · End-to-End Workflow

```
 Patient (mobile, Expo)
   │  Firebase ID token on every request (axios interceptor, api.js)
   ▼
 Backend :5000  ── orchestration only; owns auth, encryption, Firestore writes
   │  utils/aiClient.js  ← the ONLY place AI-service URLs are constructed
   ▼
 AI service :8000 (FastAPI, 10 routers)
   │        ├── local HF models (crisis, sentiment, emotion)
   │        ├── XGBoost + SHAP, per-user LSTM / autoencoder
   │        └── NVIDIA cloud (chat + clinician summary)
   ▼
 Firestore  ── the integration bus (15 collections)
   ▲                        │ onSnapshot (live, no REST)
   │ cron: jitaiScheduler   ▼
   │       escalationCron   Dashboard :5173 → Clinician
   └────────────────────────┘
```

**Every arrow explained.**

1. **Patient → Backend.** Firebase JWT injected by the axios interceptor.
   `BASE_URL` is *derived* — it probes `localhost:5000` then the Expo packager LAN
   IP against `/api/health`. Never hardcode an IP (a one-digit typo once broke
   every request silently).
2. **Backend → AI service.** Only through `utils/aiClient.js`: one axios instance,
   15s default, LLM paths override to 45s.
3. **AI service → models.** Local inference for NLP/ML; NVIDIA cloud for the LLM.
4. **Backend → Firestore.** Backend owns all writes. Journals and chat are
   AES-256-GCM encrypted before storage.
5. **Firestore → Dashboard.** `onSnapshot` live reads (`usePatients.js`). There is
   **no** REST call from dashboard → backend for the patient list — deliberate, so
   alerts land without polling.
6. **Cron → everything.** `jitaiScheduler` hourly (receptivity sweep) + midnight
   (full re-score); `escalationCron` every 15 min (crisis + loss-of-follow-up).
7. **Outcome loop.** Every check-in triggers `computeOutcomes(uid)` (step 9,
   non-blocking), which feeds `effectivenessFor()` → `choose_intervention()`.

---

# CHAPTER 4 · Complete Architecture

| Component | Purpose | Fails how | Trade-off accepted |
|---|---|---|---|
| **mobile-app** (RN 0.81 / Expo 54) | Patient surface, offline-first | Queues writes on *transport* failure only | Expo Go returns simulated Health Connect data |
| **backend** (Node 20 / Express 5) | Auth, encryption, Firestore writes, orchestration, cron | Fails fast on missing `ENCRYPTION_KEY`/service account | Cron inside the API process — cannot scale horizontally without duplicating jobs |
| **ai-service** (FastAPI, Py 3.11) | All ML/NLP/LLM | Warms crisis classifier at boot (else ~40s first-call penalty) | Per-user models on **local disk** — lost on redeploy |
| **dashboard** (React 19 / Vite 8) | Clinician surface | Reports which hop failed (backend vs AI) | Sorts in memory — no composite indexes |
| **Firestore** | Integration bus | Single region | In-memory sort/filter is a deliberate demo-scale tradeoff |

**Deployment / CI-CD / monitoring:** *Not specified in the project.* There is
request logging (method, path, status, ms — never bodies) and no CI pipeline.

---

# CHAPTER 5 · Frontend Deep Dive

## Mobile screens

| Screen | Purpose | Talks to |
|---|---|---|
| `Login` / `Signup` | Firebase email auth | Firebase SDK |
| `Onboarding` | Profile; **gender asked, never inferred**; sets `personaType` | `/auth/update-profile` |
| `Home` | Risk ring, cycle ring (opt-in), JITAI cards, nav | `/risk/history/`, `/passive/summary/`, `/cycle/today/` |
| `Journal` | Mood 1–5 + journal → the heavy pipeline | `POST /mood/log` (45s timeout) |
| `Chat` | Conversational agent; permanent Support button | `/chat/thread/`, `/chat/message` (60s) |
| `Assessment` | PHQ-9 / GAD-7, one question per screen; scores locally if offline | `/assessments` |
| `Cycle` / `PeriodLogSheet` | Opt-in cycle tracking | `/cycle/today/`, `/cycle/log-day`, `/cycle/log-period` |
| `Insights` | Trends | `/mood/monthly/` |
| **`Recovery`** | Score + components + today's plan + goal ticking | `/recovery/:uid`, `POST /recovery/goal` |
| `CrisisSupport` | Full-screen helplines + grounding | — |
| `interventions/SomaticBreathing`, `CBTReframe` | The two deliverable interventions | `POST /jitai/log-response` |

**Two rules the mobile client must keep.** `postData()` queues offline **only on
genuine transport failure** — an HTTP 4xx/5xx returns `{success:false, status}`
(it used to report server rejections as "Saved Offline"). Heavy routes must pass a
per-request timeout from `TIMEOUTS`; the 8s global default is shorter than the
mood-log pipeline.

## Dashboard screens

`Login` → `Dashboard` (caseload, live) → `PatientDetail` (risk+SHAP, 30-day
trajectory, **RecoveryPanel**, assessments, NLP signals, AI summary, PDF export)
→ `Alerts`.

---

# CHAPTER 6 · Backend Deep Dive

**Routers (12).** `auth, mood, cycle, chat, jitai, clinician, passive, biometric,
risk, assessments, googleHealth, outcomes, recovery`.

**Services.** `outcomeService` (loop measurement), `recoveryService` (score, plan,
residual symptoms), `jitaiScheduler`, `escalationCron`, `baselineService`,
`notificationService`, `googleHealthClient`, `syncService`.

**Middleware.** `verifyToken` (Firebase `verifyIdToken` → `req.user.uid`);
`authorize.js` → `requireSelfOrAssignedClinician` (closes the IDOR hole where any
logged-in user could read another patient by uid) and `requireClinician`;
`rateLimiter` (`nlpLimiter`, `generalLimiter`).

**Business rules that must not be softened.**
1. Effectiveness is a **shrunk** mean `(n·user + 3·pop)/(n+3)`; `insufficient`
   below n=4.
2. Two hard floors: crisis > 0.75 → `grounding`; engagement < 25% → `checkin_nudge`.
3. Any non-zero PHQ-9 **item 9** creates a `clinicianAlerts` doc regardless of total.
4. Wearable stress alerts need **≥2 corroborating signals**; absent signals must be
   `null`, never 0.
5. Every `clinicianAlerts` doc **must** carry `clinicianUid` or it is invisible.

---

# CHAPTER 7 · Database Deep Dive

15 collections. Deterministic doc ids where idempotency matters.

| Collection | Doc id | Key fields | Breaks if removed |
|---|---|---|---|
| `users` | uid | role, gender, tracksCycle, assignedClinician, riskScore/Level, topFactors, dropoutProbability, last_phq9/gad7, fcmToken, medication{} | Everything |
| `moodLogs` | auto | moodScore, sleepHours, **journalText (AES)**, nlpResults{}, moodSentimentDivergence, riskScore, topFactors | Risk, outcomes, recovery |
| `assessments` | auto | type, score, severity, **answers[]** | Residual symptoms, trajectory |
| `jitaiLogs` | auto | interventionType, source, notificationSent, openedByUser, responseType, selectionMode, selectionRationale | The whole loop |
| `interventionOutcomes` | `{uid}_{jitaiLogId}` | engagement, engaged, moodDelta, phqDelta, status | Learning engine |
| `recoveryPlans` | `{uid}_{date}` | goals[], adaptiveSelection | Daily plan, goal ticking |
| `recoveryScores` | `{uid}_{date}` | score, confidence, components{} | Trend line |
| `clinicianAlerts` | auto | patientUid, **clinicianUid**, type, resolved | Clinician workflow |
| `cycleLogs` / `cycleDayLogs` | uid / `{uid}_{date}` | vulnerabilityScore / periodDay, flow | Cycle features (opt-in) |
| `chatLogs` | auto | encrypted message | Chat history |
| `passiveLogs` / `biometricLogs` | auto | deviation scores | Passive monitoring |
| `googleHealthTokens` | uid | AES-encrypted refresh token | Cloud wearable |
| `clinicians` | uid | clinician profile | Dashboard |

**Indexes.** No `firestore.indexes.json`. Queries fetch by uid and sort/filter in
memory — a deliberate demo-scale tradeoff (the indexed thread query 500'd in
rehearsal). **Security rules: not specified in the project** — authorization is
enforced in the backend middleware, which is a real gap for production because the
dashboard reads Firestore directly.

---

# CHAPTER 8 · API Handbook

All routes require `verifyToken` unless noted. Patient-scoped `/:uid` routes are
behind `requireSelfOrAssignedClinician`; cohort routes behind `requireClinician`.

**Backend (Express, `/api/...`)**

- **auth** — `/register`, `/me`, `/update-profile`, `/update-baseline`,
  `/delete-account`, `/export-data`
- **mood** — `POST /log` (the heavy pipeline), `/weekly/:uid`, `/monthly/:uid`, `/history/:uid`
- **assessments** — `POST /`, `GET /:uid`
- **chat** — `/message`, `/voice`, `/history/:uid`, `/thread/:uid`, `/clear/:uid`
- **jitai** — `/evaluate/:uid`, `/send-notification`, `/log-response`, `/history/:uid`, `/active/:uid`
- **outcomes** — `/:uid`, `/:uid/kpis`, `/cohort/all`
- **recovery** — `/:uid`, `/:uid/history`, `POST /goal`, `/cohort/all`
- **clinician** — `/patients`, `/patient/:uid`, `/summary/:uid`, `/flag/:uid`, `/alerts`, `/resolve-alert/:id`
- **risk** — `/score/:uid`, `/history/:uid`, `/explain/:uid`
- **cycle** — `/log-period`, `/log-day`, `/log-period-end`, `/day-logs/:uid`, `/today/:uid`, `/history/:uid`, `/predict/:uid`
- **passive / biometric** — `/log`, `/gps-entropy`, `/sync-batch`, `/summary/:uid`, `/today/:uid`, `/update-baseline/:uid`, `/biometric-sync`, `/biometrics/:uid`
- **google-health** — `/status`, `/connect`, `/callback` *(unauthenticated by necessity — protected by an HMAC-signed 10-min `state`)*, `/sync`, `/disconnect`

**AI service (FastAPI)** — `chat /summary /transcribe` · `crisis /detect` ·
`sentiment /analyze` · `emotion /detect` · `predict /risk /explain` ·
`dropout /predict /explain` · `cycle /train/{uid} /predict/{uid}` ·
`jitai /receptivity /train /log-response` · `anomaly /score /train /status /demo` ·
**`outcome /select /trajectory`**

**Idempotency.** `interventionOutcomes`, `recoveryPlans`, `recoveryScores` and
`cycleDayLogs` use deterministic ids, so recompute and double-taps are safe.

---

# CHAPTER 9 · Machine Learning Handbook

| Model | Purpose | Training data | Explainability | Fallback | Honest limitation |
|---|---|---|---|---|---|
| `sentinet/suicidality` (ELECTRA) | crisis probability | pretrained, external | probability + thresholds | — | non-explicit Tanglish after translation |
| `cardiffnlp/twitter-xlm-roberta-base-sentiment` | polarity | pretrained, external | 3-class softmax | **refuses to boot if head untrained** | romanised Tanglish weaker (errs *negative* — the safe direction) |
| `j-hartmann/emotion-distilroberta` | 7-emotion | pretrained | confidence | — | English-only |
| **XGBoost risk (15 feat) + SHAP** | deterioration risk | **600 SYNTHETIC rows** | SHAP `topFactors` | `fallback_*` labelled | **not clinically validated** |
| **XGBoost dropout** | attrition | synthetic | top factors | defaults 0.3 | same |
| Cycle LSTM | vulnerability | per-user history | — | `currentDay: 0` | needs ≥2 cycles |
| Anomaly autoencoder | behaviour | per-user, synthetic-augmented | reconstruction error | ≥2-signal gate | cold start |
| JITAI XGBoost | receptivity | user's own responses | — | `population_fallback` **labelled** | needs ≥5 responses |
| **Effectiveness + selection** | what works next | **real measured outcomes** | full rationale stored | population prior | confounded by self-selection |
| LLM chain | conversation | hosted | `modelUsed` returned | static fallbacks | vendor dependency |

## The two model traps this codebase has already hit — memorise these

**A pretrained LM is not a classifier.** Load one with
`AutoModelForSequenceClassification(..., num_labels=N)` and transformers silently
creates a **random** head. Output becomes near-constant.

- `mental/mental-roberta-base` → constant **~0.465** crisis for every input.
  Crisis detection had *never* fired since the project began.
- `ai4bharat/indic-bert` → constant **~0.338** sentiment. "I am so happy today"
  scored *negative*, identically to "I want to die."

**Probe test (run on any new model):** four contrasting inputs. A flat spread means
the head is untrained and the model is decorative. `sentiment.py` now refuses to
start if `id2label` is still `LABEL_0/1/…`.

---

# CHAPTER 10 · Wearable Integration

Two ingest paths, **one pipeline** — both call
`biometricRoutes.processBiometricSync(uid, payload)`, so deviation maths, the
≥2-signal gate and the XGBoost re-score exist once.

- **On-device:** `HealthConnectService.js` → `POST /api/passive/biometric-sync`.
  Native module — **simulated in Expo Go**, real only in a dev build.
- **Cloud:** `googleHealthClient.js` → Google Health API v4. Works in Expo Go and
  on iOS. Refresh token AES-encrypted in `googleHealthTokens`.
  **Status: code complete, credentials not set.** Roadmap, not demo.

**Do not build on the Fitbit Web API — Google decommissions it 30 Sept 2026.**

**The partial-data rule.** Weighted stress score (HR .30 / HRV .35 / steps .20 /
sleep .15) **renormalised over present signals**. Absent signals must be `null`,
never `0` — "0 steps" scores as maximum deviation and false-alerts, and Fitbit
never writes HRV to Health Connect.

---

# CHAPTER 11 · Recovery Engine

**Recovery score is NOT `100 − risk`.** `riskScore` is XGBoost P(deterioration) —
predictive, about the future, rises when things worsen. `recoveryScore` is
deterministic arithmetic over observed history against the patient's own baseline,
and is `null` (never 50) until history exists. **They are supposed to disagree.**
Live proof on the demo patient: **risk 88% / recovery 36**, because he is engaging
(57%) with mood improving (1.3 → 1.7) while his PHQ-9 worsens.

| Component | Weight | Source |
|---|---|---|
| Symptoms | 0.40 | PHQ-9 % reduction (50% reduction anchors to 100) |
| Adherence | 0.20 | check-ins in last 14 days |
| Engagement | 0.20 | % of interventions engaged |
| Mood | 0.20 | last 7 days vs prior 7 |

Weights **renormalise over present components only** — a missing signal is never
scored zero. Every component is rendered with its arithmetic; the UI never shows a
bare number.

**Residual symptoms.** PHQ-9 items scoring ≥2 ("more than half the days") while
the total is <10. Above 10 they are `active`, not residual. If `answers[]` is
empty the API returns `itemsAvailable: false` — **absence of data is never
rendered as a negative finding** (a total of 24 with "no items scoring 2+" is
arithmetically impossible and destroys trust in every other number).

**Plateau detection.** OLS slope on PHQ-9 vs days: `<5` remission · `≥50%`
reduction treatment response · `≤−0.5/wk` improving · `≥+0.5/wk` deteriorating ·
else **plateau**, which emits *"Incomplete symptom alleviation — engaged but not
improving; consider treatment review."* That is the problem statement's own
wording, produced from data.

**Daily plan.** ≤5 goals. Goal 1 is always the adaptive intervention. The daily
check-in is always present (it is the measurement the loop depends on). Medication
goals appear only if `users.medication.name` exists — a reminder, never dose
advice. Small on purpose: a depressed patient handed twelve tasks completes none.

**Adaptive selection.** Shrunk effect + Gaussian(0, 0.5/√(n+1)), behind the two
floors. **It does explore** and reports `selectionMode: "explore"` — but it is not
RL: no policy, no value function, no reward propagation, no unbounded search, and
never exploration on a patient in crisis or disengaging.

**Recovery Passport.** *Not built.* PDF export exists on `PatientDetail`. Roadmap.

---

# CHAPTER 12 · Security

**Auth.** Firebase `verifyIdToken` on every protected route → `req.user.uid`.
**Authorization.** `requireSelfOrAssignedClinician` / `requireClinician`.
**Encryption.** Journals and chat AES-256-GCM before Firestore; `/chat/history`
strips the encrypted field. Google refresh tokens encrypted at rest.
**Secrets.** `.env*` gitignored (a `.env.bak` holding live keys was caught and
removed on 1 Aug); `serviceAccountKey.json` gitignored; boot fails without them.
**Logging.** Method/path/status/ms only — never bodies.

## Threat model — the two real gaps, state them yourself

1. **PHI egress.** `nvidia_client.py` sends the patient's raw message plus 8 prior
   turns to NVIDIA's hosted API. Encryption protects Firestore *at rest*; the
   plaintext still leaves the trust boundary, with no BAA/DPA. The clinician
   summary is correctly built from **structured aggregates only** — the principle
   was applied there and not in chat. **Production blocker.**
2. **Firestore rules.** *Not specified in the project.* The dashboard reads
   Firestore directly, so backend middleware is not sufficient in production.

---

# CHAPTER 13 · System Design

**Today (demo scale).** Single backend instance with cron inside it, single
FastAPI instance with per-user models on local disk, Firestore single region.

**What breaks first, in order.**
1. **Two backend replicas → duplicated cron.** Every notification and alert fires
   twice. Needs a leader lock or a worker tier.
2. **Two AI replicas → per-user models on the wrong box.** Silent degradation to
   `population_fallback`. Needs object storage.
3. **`GET /outcomes/cohort/all`** recomputes per patient sequentially *and writes
   during a GET*; `populationMeanDelta()` is an unbounded collection scan.
   A 200-patient clinic = 600+ sequential round trips.
4. **In-memory sorting** becomes incorrect, not just slow, past one page.

**100 → 10k → 1M.** 100: as-is. 10k: worker tier + Redis leader lock, models to
GCS, composite indexes, cache `populationMean`. 1M: event queue between backend
and AI, precomputed outcome aggregates, regional sharding, model serving behind
its own autoscaler. **Deployment/CI: not specified in the project.**

---

# CHAPTER 14 · Design Decisions

| Decision | Options | Chosen | Why | Trade-off |
|---|---|---|---|---|
| Learning method | RL · bandit · shrunk means | **Shrunk means + bounded sampling** | RL explores without ceiling on people in distress; n is tens, not thousands | Slower learning |
| Report effect at low n | show it · hide it | **`insufficient` below n=4** | 3 lucky observations must not crown a winner | Demo shows "not reported" a lot |
| Recovery score | ML model · arithmetic | **Labelled arithmetic** | A clinician can reproduce it on paper; a model here would be theatre | Looks "less AI" |
| Tanglish sentiment | raw · Sarvam translate | **Raw XLM-R** | Measured: translation inverts distress ("great distress" → *"I am very comfortable"*). Raw errs negative = safer failure | Weaker on Tanglish positives |
| Tanglish crisis | raw · translate | **Translate** | Measured: 0.008 → 0.96 | Non-explicit hopelessness can be lost |
| Dosing safety | prompt · deterministic | **Deterministic, before the LLM** | Probed raw: both models gave a sertraline dose | Some false deferrals |
| Integration | REST · Firestore bus | **Firestore + onSnapshot** | Alerts land live without polling | Two write paths to reason about |
| Indexes | deploy · in-memory | **In-memory** | Indexed thread query 500'd in rehearsal | Breaks past demo scale |
| Gender/cycle | infer · ask | **Ask, opt-in** | Never infer a clinical attribute | Extra onboarding step |

---

# CHAPTER 15 · End-to-End Data Flows

## Flow 1 — Patient types *"I don't want to live."* in Chat

1. `Chat.js` → `postData('/chat/message', …, {timeout:60000})` with history.
2. `chatRoutes.js` enriches with live context (cycle/mood/risk/emotion from
   Firestore), AES-encrypts the message → `chatLogs`.
3. → `ai-service POST /api/chat`.
4. `detect_language()` → `en`.
5. `crisis_probability()` (`sentinet/suicidality`) → **~0.99**.
6. `is_dosing_question()` → false, so the LLM runs; system prompt gains the
   high-crisis note.
7. NVIDIA chain: `llama-3.1-8b` (~1.3s) → `nemotron-3-super-120b` backstop →
   static fallbacks. `apply_output_guardrail()` on the reply.
8. Response carries `crisisDetected` → mobile navigates **full-screen** to
   `CrisisSupport` (Tele-MANAS 14416, iCall, NIMHANS, grounding).
9. `escalationCron` (≤15 min) writes a `clinicianAlerts` doc **with
   `clinicianUid`** → dashboard `onSnapshot` fires a browser notification.

**Weak point to own:** step 9 has no guaranteed human recipient — no on-call, no
acknowledgement deadline. Say so before a judge asks.

## Flow 2 — Journal check-in (the money shot)

`POST /api/mood/log` — nine steps: encrypt → **parallel** sentiment/emotion/crisis
→ **divergence** → cycle LSTM → XGBoost+SHAP → alert if crisis>0.50 **or**
risk>0.60 → write `moodLogs` → update `users.riskLevel/riskScore/topFactors` →
**step 9: `computeOutcomes(uid)` non-blocking**.

**Divergence, corrected 1 Aug.** Both terms must be on one polarity scale:
`moodNeg = 1 − (mood−1)/4`, `sentNeg = P(negative)`, `divergence = |moodNeg − sentNeg|`.
Previously it compared mood-negativity against language-*positivity* — inverted,
peaking for the most **consistent** patients. Measured after the fix:
**mood 5/5 + bleak journal = 0.929**; mood 1/5 + bleak journal = 0.071.
*This is why the demo uses a HIGH mood rating.*

## Flow 3 — PHQ-9

`POST /api/assessments` scores server-side, stores `answers[]`, mirrors
`users.last_phq9`, and **any non-zero item 9 creates an alert regardless of
total**. Feeds residual symptoms + trajectory.

## Flow 4 — Biometrics

`HealthConnectService` or Google Health → `processBiometricSync()` → deviations vs
personal baseline → weighted stress score renormalised over present signals →
**≥2-signal gate** for stress alerts (the XGBoost path, `riskScore>0.60`, has no
such gate) → re-score.

## Flow 5 — Recovery plan

`GET /api/recovery/:uid` → parallel: user, moods, assessments, `effectivenessFor()`
→ `computeScore()` + `residualSymptoms()` + `/outcome/trajectory` +
`/outcome/select` → plan persisted at `recoveryPlans/{uid}_{date}` **with its
`adaptiveSelection`** (selection is stochastic; re-sampling per request made the
plan and the recommendation card contradict each other) → score snapshotted to
`recoveryScores`. `POST /recovery/goal` ticks a goal durably.

---

# CHAPTER 16 · Clinical Evidence Matrix

| Clause | Feature | Model | Backend | Collection | UI | Clinician benefit | Patient benefit | Demo evidence |
|---|---|---|---|---|---|---|---|---|
| Incomplete alleviation | PHQ-9 trajectory + plateau | OLS | `/outcome/trajectory` | `assessments` | Recovery panel | Names non-responders | Sees direction | Flag renders live |
| Incomplete alleviation | Residual symptoms | clinical rule | `recoveryService` | `assessments.answers[]` | Symptom list | Item-level target | Specific goals | Q1–Q9 render |
| Incomplete alleviation | Effectiveness | shrunk means | `outcomeService` | `interventionOutcomes` | Effectiveness table | What works for *this* patient | Better next action | Table + `insufficient` |
| Incomplete alleviation | Divergence | XLM-R + arithmetic | `moodRoutes` step 3 | `moodLogs` | Alert + SHAP | Detects masking | — | Type it live |
| Attrition | Dropout | XGBoost | `jitaiScheduler` | `users` | Early warning | — | Alert |
| Attrition | Engagement + `engagement_floor` | selector | `outcome.py` | `jitaiLogs` | Engagement stat | Sees withdrawal | Lower-effort ask | 57% on screen |
| Loss of follow-up | Escalation cron | rule (labelled) | `escalationCron` | `clinicianAlerts` | Alerts | Nobody exits silently | — | Cron fired one unprompted |
| Safety | Crisis detection | `sentinet/suicidality` | `crisis.py` | `clinicianAlerts` | CrisisSupport | Immediate | Helplines | 0.0008 vs 0.9945 |

---

# CHAPTER 17 · Claim vs Evidence

| Claim | Evidence | Risk if challenged |
|---|---|---|
| "We measure whether interventions helped" | `interventionOutcomes`, verifyLoop 44/44 | **Low** — but disclose confounding |
| "We detect crisis language" | measured 0.0008 / 0.9945 / 0.0197 | Low |
| "Tamil + romanised Tamil" | 0.008 → 0.96 with routing | Medium — non-explicit Tanglish |
| "Recovery ≠ inverted risk" | risk 88 vs recovery 36, components shown | Low |
| ~~"We predict deterioration"~~ | **synthetic training data** | **High — reduce the claim** |
| ~~"Clinically validated"~~ | nothing supports this | **Never say it** |
| "Explainable" | SHAP + `selectionRationale` on every log | Low |
| "Bounded exploration, not RL" | `outcome.py`, both floors asserted | Low |

---

# CHAPTER 18 · Architecture Consistency

Verified 2 Aug: README, `docs/*.md`, code and dashboard now tell one story.
Corrected in this pass — IndicBERT → XLM-R everywhere; `minimax-m2.7` (HTTP 410)
→ `nemotron-3-super-120b`; "9 routers" → 10; README gained the outcome/recovery
engine section it never had; dashboard label "IndicBERT" → "XLM-R sentiment";
`Build_Guide.md` carries a correction banner (it is the historical spec and the
§40 style source, deliberately not rewritten).
**PPT / UI screenshots: not specified in the project** — regenerate any slide that
names IndicBERT or Minimax.

---

# CHAPTER 19–21 · Judge Questions, Model Answers, Cross-Examination

*The ~40 questions that actually get asked, each with a senior-engineer answer and
the follow-up that usually comes next. Padding this to 300 would make it a worse
study tool.*

### Machine learning

**Q. What data trained your risk model?**
**A (senior).** *"600 synthetic rows generated with `np.random.normal` around
hand-set class means. It demonstrates the pipeline, not clinical accuracy, and we
won't claim otherwise. What is measured on real data is the outcome loop —
engagement, mood deltas, PHQ-9 trajectory."*
↳ *Follow-up: "So your headline insight, divergence, is circular?"* — **"Inside
the risk model, yes: divergence was generated with class-increasing means, so it
predicts risk because we assumed it. At inference it's a real measurement, and its
weight is an assumption we'd have to validate on real data."** Say this before
they find it.

**Q. Is this reinforcement learning?**
**A.** *"It explores and reports `selectionMode: explore`. It is not RL — no
policy, no value function, no reward propagation. One Gaussian perturbation scaled
by 1/√(n+1), so exploration decays with evidence, behind two hard floors."*

**Q. Why does the table say "not reported" three times?**
**A.** *"n = 2, 3, 2. Below four we don't report an effect."*
↳ *"Then your feature shows nothing."* — **"It shows the honest state of the
evidence. A number there would be the failure mode, not the feature."**

**Q. How do you know the intervention caused the improvement?**
**A.** *"We don't. It's associational — people who complete exercises differ from
people who don't. That's why we shrink toward the population mean and label
confidence. Causal correction is roadmap."*

**Q. Why not fine-tune your own crisis model?** — *"No labelled clinical corpus,
and a badly fine-tuned safety classifier is worse than a good pretrained one. We
validated the pretrained checkpoint with a four-input probe instead."*

### Architecture

**Q. Why is Firestore the integration bus?** — *"Alerts must land on the
clinician's screen without polling. `onSnapshot` gives that for free. Cost: two
write paths to reason about."*

**Q. What happens if the AI service dies?** — *"Every AI call has a timeout and a
labelled fallback. Chat degrades to `fallback_*` static replies; risk defaults and
says so. The check-in still saves."*

**Q. Can you scale this?** — *"Not as deployed, and I know exactly why: cron runs
inside the API process so a second replica duplicates every job, and per-user
models sit on local disk so they'd be on the wrong box. Fix is a worker tier plus
object storage."* **This answer wins points; pretending it scales loses them.**

**Q. Why one axios client for the AI service?** — *"So no route file can invent a
URL or a timeout. One boundary, one retry policy."*

### Security & clinical safety

**Q. Where does patient data go?** — *"Journals and chat are AES-256-GCM encrypted
before Firestore. But be clear: chat messages go to NVIDIA's hosted LLM in
plaintext. That's a production blocker we've documented — self-hosting or a signed
BAA is the fix. The clinician summary is already structured-aggregates-only, never
raw text."*

**Q. What happens after a crisis alert is written?** — *"The patient gets
full-screen helplines immediately, and the clinician gets a live alert. What we do
**not** have is a guaranteed human recipient — no on-call, no acknowledgement
timeout. That's the top item on the production list, and I'd rather say it than
imply a duty of care we can't fulfil."*

**Q. What stops the LLM giving medical advice?** — *"A deterministic check before
the LLM runs. We probed both models raw and they gave a sertraline dose. Through
the app it returns `modelUsed: guardrail_input`."*

**Q. Is this a medical device?** — *"It's clinical decision support, which is
SaMD-adjacent in most jurisdictions. We have no regulatory classification yet.
Not specified in the project."*

### Product & clinical

**Q. Why would a patient use this daily?** — *"Because it gives something back —
a score with its components and a three-item plan. Most apps only take."*

**Q. Only two interventions?** — *"Correct, and it's our biggest product gap. A
loop over two actions learns slowly. Expanding the action space is the cheapest
high-value work we have."*

**Q. Recovery score — isn't it inverted risk?** — open the panel: *"Risk 88,
recovery 36. Engagement 57%, mood improving, PHQ-9 worsening. They disagree, and
the disagreement is the finding."*

**Q. Why exclude GAD-7 from the composite?** — *"The problem statement is
depression. Folding an anxiety instrument in dilutes the primary signal. GAD-7 is
collected and displayed separately."*

### Business

**Q. What's your moat?** — *"Honestly, the loop is arithmetic and copyable. Two
things aren't: the outcome dataset as it accumulates, and the measured regional-
language safety pipeline. The second is where incumbents haven't invested."*

**Q. Who pays?** — *"Not specified in the project."* Don't invent a business model
in front of an investor.

---

# CHAPTER 22 · Communication Coaching

**Structure every answer: claim → evidence → limitation.** The limitation is what
makes the claim credible.

| Length | Use | Shape |
|---|---|---|
| **30s** | most judge questions | One claim, one number, one caveat |
| **1 min** | architecture | Component → why → failure mode |
| **3 min** | the loop | Problem → mechanism → measurement → honesty rule |
| **5 min** | full walkthrough | Ch. 3 diagram, arrow by arrow |

**Kill these:** "basically", "kind of", "we just", "it's very accurate", "AI-powered",
"we tried to". **Use these:** "measured", "we verified", "the trade-off was",
"the failure mode is", "we reduced that claim because".

**Sound senior:** name the trade-off before you're asked. *"We sort in memory
rather than deploy composite indexes — deliberate at demo scale, breaks past one
page."* That single sentence signals more seniority than any feature list.

---

# CHAPTER 23 · Production Readiness

**MVP (done, verified).** Closed loop, recovery engine, clinician panel, mobile
recovery screen, two safety floors, shared vocabulary, 44-assertion guard, secrets
secured, docs consistent.

**Production blockers.** (1) PHI egress to NVIDIA. (2) No guaranteed human
response to a crisis alert. (3) Synthetic-trained models + no evaluation harness.
(4) Cron in API process. (5) Models on local disk. (6) No Firestore security rules.
(7) No consent/retention/deletion policy.

**Roadmap, explicitly not claimed.** Causal correction · survival analysis ·
medication adherence · GAD-7 in the composite · Recovery Passport · Google Health
OAuth · Web Push · postpartum/perimenopause subtyping with EPDS · composite
indexes · automated mobile E2E · CI.

---

# CHAPTER 24 · Viva — the hard ones

Ten questions most likely to expose a gap. If you can answer these, you can answer
anything.

1. Walk me from a keystroke in the journal to a row in `interventionOutcomes`.
2. Your engagement rate was 0% for every real user for months. Why, and how do you
   know it's fixed?
3. Show me where a caller could bypass the crisis safety floor. *(Answer: they
   can't — `jitai.py` imports the same `choose_intervention` the API uses.)*
4. Why is `sentNeg = sentimentScore` and not `1 − sentimentScore`?
5. What is `weightsRenormalisedOver` and why does it exist?
6. A patient's PHQ-9 is 24 and residual symptoms shows nothing. Bug or data?
7. Two backend replicas — what breaks first?
8. Why doesn't sentiment take the Sarvam hop that crisis takes?
9. Your selector is stochastic. Why doesn't the dashboard contradict itself?
10. What's the worst thing in this codebase? *(Correct answer: synthetic training
    data, or PHI egress. Naming it wins the room.)*

---

# CHAPTER 25 · One-Page Revision

**Story.** 1 hour a year seen, 8,759 unseen. Detectors tell you who's sick;
we measure whether what we did helped.

**Loop.** deliver → engage → mood Δ (72h) → PHQ-9 Δ → shrunk effectiveness →
next choice. Closed, verified 44/44.

**Numbers to memorise.**
- crisis: 0.0008 benign · 0.9945 ideation
- sentiment: 0.021 positive · 0.929 negative (was a flat 0.338)
- Tanglish crisis: 0.008 → **0.96** with Sarvam
- divergence: suppression **0.929** · consistency 0.071
- shrinkage `(n·u + 3·p)/(n+3)`, `insufficient` below **n=4**
- floors: crisis **>0.75** → grounding · engagement **<25%** → checkin_nudge
- demo patient: risk **88** / recovery **36**

**Say first, unprompted.** Risk model is synthetic-trained. Crisis alerts have no
guaranteed human recipient. Chat text reaches NVIDIA.

**Never say.** "Clinically validated." "Highly accurate." "It scales."

**Closing line.** *"Chatbots talk. Dashboards display. Niranthara closes the loop —
and then measures whether closing it helped."*
