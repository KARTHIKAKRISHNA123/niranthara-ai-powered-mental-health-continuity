# Niranthara — Session Handoff
**Updated 2 August 2026, end of session.** Paste §1 into a new chat to restore context.
Everything here was measured against running code, not assumed.

---

# §1 · CONTEXT BLOCK — paste this into the next session

> I'm working on **Niranthara**, an AI mental-health *continuity* platform at
> `D:\Niranthara-AI-Powered-Mental-Health-Continuity-1`. Five services:
> `mobile-app/` (React Native, Expo SDK 54), `backend/` (Node 20 / Express 5, :5000),
> `ai-service/` (Python 3.11 / FastAPI, :8000), `dashboard/` (React 19 / Vite, :5173),
> Firestore as the integration bus. **Read `CLAUDE.md` first** — it holds every
> hard-won gotcha and is current as of 2 Aug 2026. Note it is **gitignored**, so it
> exists only on this machine.
>
> **Problem statement:** *"How might we utilize AI chatbots and machine learning
> to address incomplete alleviation of depression symptoms, attrition, and loss
> of follow-up in mental health treatment?"* Submission: **Niral Thiruvizha 3.0**.
>
> **State: feature-complete and verified.** `cd backend && node scripts/verifyLoop.js`
> → **44 passed, 0 failed**. Dashboard builds. Both services boot. The
> intervention→outcome→learning loop is closed and measured on real data.
>
> **Headline feature — the outcome loop.** Every intervention is paired with
> engagement + proximal mood delta (72h) + distal PHQ-9 delta, shrunk toward the
> population mean `(n·user + 3·pop)/(n+3)`, reported as `insufficient` below n=4,
> feeding `choose_intervention()` behind two hard safety floors (crisis > 0.75 →
> `grounding`; engagement < 25% → `checkin_nudge`). It **does explore** and says so
> (`selectionMode: "explore"`) — bounded, decaying as 1/√(n+1), never on a patient
> in crisis or disengaging. It is not RL. Never claim "we don't explore".
>
> **Three things I must disclose and never overclaim:**
> 1. Risk + dropout models are trained on **600 rows of synthetic data** — pipeline
>    demonstration, not clinical accuracy. `models/model_trainer.py:39`.
> 2. Crisis alerts have **no guaranteed human recipient** (no on-call, no ack timeout).
> 3. Chat text reaches the **NVIDIA LLM in plaintext** (journals are encrypted at rest).
>
> **Demo accounts:** phone = `ananya.demo@niranthara.dev`, dashboard =
> `meena.clinician@niranthara.dev`. The `demo_patient_*` docs have **no Firebase Auth
> record and cannot be logged into**.
>
> **Docs:** `docs/DEMO_RUNBOOK.md` (the one demo script) ·
> `docs/MASTER_KNOWLEDGE.md` (25-chapter technical bible) ·
> `docs/CLINICAL_HONESTY_AUDIT.md` (claim vs evidence) ·
> `docs/FINAL_REVIEW_AND_PLAYBOOK.md` (104 judge questions + playbook) ·
> `docs/VIDEO_SCRIPTS.md` (explainer + 2-host journey video) ·
> `docs/PPT_PROMPT.md` + `docs/PROJECT_REPORT_PROMPT.md` (generators).

---

# §2 · What changed in this session

## Models and clinical signal
- **Sentiment model was headless.** `ai4bharat/indic-bert` has no classification
  head; `num_labels=3` minted a random one → **constant ~0.338 for every input**
  ("I am so happy today" scored *negative*). Replaced with
  `cardiffnlp/twitter-xlm-roberta-base-sentiment`. Verified 0.021 positive /
  0.929 negative. `sentiment.py` now **refuses to boot** if `id2label` is still
  `LABEL_0/1/…`, and the old `INDICBERT_MODEL` env var is deliberately not read.
- **Mood-sentiment divergence was inverted.** It compared mood *negativity*
  against language *positivity*, so it peaked for the most **consistent** patients
  and collapsed for suppression. Now both on one polarity scale: suppression
  **0.929**, consistency **0.071**. *This is why the demo uses mood 5/5, not 2/5.*
- **Tanglish sentiment deliberately skips Sarvam** — measured, translation
  *inverts* distress ("I'm in great distress" → *"I am very comfortable"*). Raw
  XLM-R errs negative, which is the safer failure mode. Crisis still translates.

## Google Health — now reading a real Fitbit
Three stacked bugs fixed. Verified live: **HR 87 · resting 76 · HRV 58ms ·
steps 399 · sleep 8.4h**.
1. `listDataPoints` sent a `startTime/endTime` filter → **HTTP 400 on every data
   type**; v4 points have no top-level `startTime`. Filter removed, windowing in JS.
2. Generic numeric-leaf parser read nothing (`beatsPerMinute` is a **string**).
   Per-type `EXTRACTORS` added. Points are **newest-first** → latest is `[0]`.
3. `.catch(() => null)` made a 400 and "no data" identical. Failures now log.

Plus **per-signal windows** (HR = requested · steps = since local midnight ·
HRV = 36h · sleep = most recent night within 48h) and **single-source steps** —
three writers publish steps (`Charge 6`, `MobileTrack`, `HEALTH_CONNECT`) and
summing triple-counted: a real 129-step morning displayed as 909, now 399.

## Bugs fixed
| What | Cause |
|---|---|
| Recovery page span forever | `if (!user?.uid) return` **before** the try → `finally` never cleared `loading` |
| "Could not save the thought record" | two-equality + `orderBy` needs a composite index → threw *after* the write succeeded |
| *"An effect function must not return anything"* | `useFocusEffect(asyncFn)` returns a Promise |
| Dashboard showed two different "next interventions" | selection is stochastic and was re-sampled per request; now persisted with the daily plan |
| "No items scoring 2+" beside a PHQ-9 of 24 | empty `answers[]` rendered as a negative finding; now `itemsAvailable: false` |
| Residual symptoms empty for every seeded patient | `scripts/backfillAssessmentItems.js` (seeded docs only, sums verified) |
| `checkWearable.js` lied | it read its **own** env, not the server's; now compares server uptime vs `.env` mtime |
| **Live API keys one `git add` from commit** | `.env.bak` was untracked but **not ignored**; deleted, `.env*` now in `.gitignore` |

## UI
- Home quick-nav reduced to **Insights only** — Journal/Care/Cycle duplicated the
  tab bar. Insights kept because it is a stack screen with no tab.
- All five emojis removed from Insights; Feather icon in a tinted tile instead.
- Dashboard `RecoveryPanel`: score **ring** (with *"not 100 minus risk"* on its
  face), all raw hex → design tokens, clinical-flag accent bar, and
  `PHQ-9 change 9.1% increase` instead of the double-negative `−9% reduction`.
- Dashboard label `IndicBERT` → `XLM-R sentiment`.

## Docs written or rewritten
`CLINICAL_HONESTY_AUDIT.md` · `MVP_COMPLETION.md` · `MASTER_KNOWLEDGE.md` (25 ch) ·
`FINAL_REVIEW_AND_PLAYBOOK.md` (104 questions) · `VIDEO_SCRIPTS.md` ·
`DEMO_RUNBOOK.md` (fully rewritten — the old one told you to **hardcode an IP**,
the project's worst historical bug, and used mood 2/5 for the money shot) ·
`CLAUDE.md` (10 new gotchas) · `README.md` (diagram + architecture sweep) ·
`PPT_PROMPT.md` + `PROJECT_REPORT_PROMPT.md` · `Build_Guide.md` correction banner.

**Notion:** one standalone page —
[Niranthara — Demo Day Reference Hub](https://app.notion.com/p/3b037129cbc481eba2c9f9949f9789e2).
Not nested under the user's Niranthara page (no parent ID was available).

---

# §3 · Verified state

```
verifyLoop.js ......... 44 passed, 0 failed
dashboard build ....... clean (~750ms)
backend modules ....... all load, all exports resolve
ai-service ............ 10 routers, py_compile clean
mobile screens ........ all parse
crisis classifier ..... 0.0008 benign · 0.9945 ideation
sentiment ............. 0.021 positive · 0.929 negative
Tanglish crisis ....... 0.008 without Sarvam → 0.96 with
divergence ............ suppression 0.929 · consistency 0.071
Google Health ......... connected, real Fitbit data flowing
```

**Ananya (demo patient):** risk 0.975 · recovery 30 · engagement 67% ·
PHQ-9 8 → 17 · 4 intervention types, **all `insufficient`** (n = 3,1,2,3).
She is engaging and getting worse — literally the problem statement.

---

# §4 · Open decisions — awaiting the user's call

1. **`docs/` tracking.** User wants all of `docs/` untracked. I pushed back:
   README links to `docs/` in 8 places and 8 docs are tracked. Suggested middle
   ground — untrack only the internal working material
   (`BUDGET_GRANT_PLAN`, `PITCH_DESIGN_PROMPTS`, `PPT_PROMPT`, `PROJECT_REPORT_PROMPT`),
   keep `DEMO_RUNBOOK`, `REAL_WEARABLE_SETUP`, `HACKATHON_STRATEGY`,
   `NIRANTHARA_V2_MASTER_PLAN`. **Not yet actioned.**
2. **`Build_Guide.md` deletion.** User wants it gone. **§40 is the Style Guide,
   796 lines**, referenced by CLAUDE.md as the design source of truth and still
   needed for poster/brochure/deck. Offered to extract to `docs/STYLE_GUIDE.md`
   first. **Not yet actioned.**
3. **`.codex/` and `dashboard/README.md`** — commands given, not yet run.
4. **Hours framing inconsistency.** README says *"one hour a month / 729 hours"*;
   demo script and all other docs say *"one hour a year / 8,759 hours"*. Both
   defensible; **pick one** — a judge who sees both will ask.
5. **`CLAUDE.md` is gitignored** (`.gitignore:13`) — two days of gotchas live only
   on this machine. Decide whether that should change.
6. **Design deliverables not started:** slide-by-slide creative review, A4 project
   summary, brochure (fold/GSM/finish), A1 poster. User said they'll handle these
   "here after" — confirm before building.
7. **Notion page is standalone**, not under their Niranthara page.

---

# §5 · Known broken / roadmap — never claim these work

- **Patient push notifications do not fire.** `NotificationService.js` fetches an
  Expo token but **nothing writes `users.fcmToken`**; the scheduler only pushes
  `if (shouldIntervene && user.fcmToken)`.
- **Clinician toasts need the dashboard tab OPEN.** `onSnapshot` + browser
  `Notification`. The alert *document* is written either way. Web Push = roadmap.
- **iOS entirely unsupported** — no HealthKit integration anywhere.
- **Cycle data from Google Health is not possible today** — every plausible type
  (`menstruation`, `menstruation-flow`, `menstrual-cycle`, …) returns **HTTP 400**,
  the type IDs don't exist in the v4 surface. Manual cycle logging works.
- **Recovery Passport does not exist** (PDF export on PatientDetail does).
- Cron runs in the API process; per-user models on local disk → **cannot scale
  horizontally**. `GET /outcomes/cohort/all` writes during a GET and fans out
  sequentially. No Firestore security rules. No CI.

---

# §6 · Run it

```bash
# 1 — AI service FIRST (models take ~1-2 min)
cd ai-service && PYTHONUTF8=1 .venv/Scripts/python.exe -m uvicorn main:app --port 8000

# 2 — backend (RESTART AFTER EVERY EDIT — Node does not hot-reload)
cd backend && node index.js

# 3 — dashboard
cd dashboard && npm run dev

# 4 — mobile
cd mobile-app && npx expo start
```

**If a restart "doesn't work":** on Windows the new process dies on `EADDRINUSE`
and the stale one keeps serving. This bit us three times in one session.
```bash
netstat -ano | grep ":5000.*LISTENING"
taskkill //PID <pid> //F
```

**Never activate a venv** — `python`/`py` are broken uv shims. Call
`ai-service/.venv/Scripts/python.exe` directly.

**Pre-demo checks:**
```bash
cd backend && node scripts/verifyLoop.js      # expect 44/44
cd backend && node scripts/verifyData.js      # who has what data
cd backend && node scripts/checkWearable.js   # decides if you may say "my watch"
```

---

# §7 · The one sentence

> **"Every other system tells you the patient is getting worse. Niranthara tells you whether what you did about it helped."**
