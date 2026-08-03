# Niranthara — MVP Completion Report
**1 August 2026 · verified state, not aspirational**

Every claim below was checked against running code. `backend/scripts/verifyLoop.js`
reports **44 passed, 0 failed** against live Firestore and the AI service on :8000.

---

## 1 · Complete feature list

### The six engines

| # | Engine | Where it lives | Status |
|---|---|---|---|
| 1 | Monitoring | `moodRoutes`, `biometricRoutes`, `googleHealthClient`, `cycle.py`, `anomaly.py` | shipped |
| 2 | Prediction | `predict.py` (XGBoost 15-feature + SHAP), `dropout.py`, `crisis_classifier.py`, `jitai.py` | shipped |
| 3 | **Recovery** | `services/recoveryService.js`, `routes/recoveryRoutes.js`, `screens/Recovery.js` | **new** |
| 4 | **Outcome** | `services/outcomeService.js`, `routes/outcomeRoutes.js` | **now measures real data** |
| 5 | **Clinician Intelligence** | `components/RecoveryPanel.jsx` on `PatientDetail.jsx` | **new** |
| 6 | **Learning** | `outcome.py :: choose_intervention()` ← `jitaiScheduler` | **now connected** |

### Capability inventory

| Capability | Method | Confidence handling |
|---|---|---|
| Crisis detection | `sentinet/suicidality` (ELECTRA) | probability, gated at 0.50 / 0.75 / 0.85 |
| Sentiment (Ta/Tanglish/En) | `cardiffnlp/twitter-xlm-roberta-base-sentiment` | untrained-head guard refuses startup |
| Emotion, 7-class | distilroberta | confidence returned |
| Risk score | XGBoost 15-feature + SHAP | `topFactors` always shown |
| Cycle vulnerability | per-user LSTM (opt-in) | `tracksCycle()` gated |
| Biometric anomaly | per-user LSTM autoencoder | ≥2-signal gate, nulls never zero |
| Dropout | XGBoost | probability |
| JITAI receptivity | per-user XGBoost | `population_fallback` labelled |
| **Intervention effectiveness** | **shrunk mean, k=3** | **`insufficient` below n=4** |
| **Adaptive selection** | **Thompson-style + 2 hard floors** | **`selectionMode` always returned** |
| **PHQ-9 trajectory** | **OLS slope** | **`insufficient_data` below n=2** |
| **Recovery score** | **weighted composite, renormalised** | **`null` when no history** |
| **Residual symptoms** | **PHQ-9 items ≥2 with total <10** | **item-level, named** |
| Conversation | llama-3.1-8b → nemotron-120b | `modelUsed` returned |

---

## 2 · Architecture diagram

```
                         ┌──────────────── FIRESTORE (integration bus) ──────────────┐
                         │ users · moodLogs · jitaiLogs · assessments                │
                         │ interventionOutcomes · recoveryPlans · recoveryScores     │
                         │ clinicianAlerts · cycleLogs · passiveLogs                 │
                         └───▲──────────────────────────────────────────────▲────────┘
                             │ writes                             onSnapshot │ reads
   ┌─────────────┐   JWT  ┌──┴───────────────┐   HTTP   ┌──────────────┐  ┌─┴──────────┐
   │ mobile-app  │───────▶│ backend :5000    │─────────▶│ ai-service   │  │ dashboard  │
   │ RN / Expo   │        │ Express 5        │  aiClient│ FastAPI :8000│  │ React 19   │
   └─────────────┘        └──────────────────┘          └──────┬───────┘  └────────────┘
                                   │                            │
                          cron: jitaiScheduler          NVIDIA cloud (chat)
                                escalationCron          local HF / XGBoost / LSTM

                    ── THE CLOSED LOOP ──
   mood check-in ─▶ risk (XGBoost+SHAP) ─▶ recovery plan ─▶ intervention delivered
        ▲                                                          │
        │                                                          ▼
   better next choice ◀── choose_intervention() ◀── effectiveness ◀── engagement
        (Learning)            (shrunk means)          (Outcome)      + mood delta
```

---

## 3 · API diagram

```
OUTCOME ENGINE
  GET  /api/outcomes/:uid            every intervention + measured outcome
  GET  /api/outcomes/:uid/kpis       the three problem-statement clauses as data
  GET  /api/outcomes/cohort/all      caseload roll-up, worst-responding first

RECOVERY ENGINE
  GET  /api/recovery/:uid            score + components + trajectory + residual + today's plan
  GET  /api/recovery/:uid/history    recoveryScores time series
  POST /api/recovery/goal            { goalId, done } → completion tracking
  GET  /api/recovery/cohort/all      clinician caseload recovery view

LEARNING ENGINE (ai-service)
  POST /api/outcome/select           next intervention + rationale + selectionMode
  POST /api/outcome/trajectory       PHQ-9 OLS slope → clinical state + flag
  POST /api/jitai/receptivity        WHEN to intervene; delegates WHICH to the selector
```

Auth: every route behind `verifyToken`; patient data behind
`requireSelfOrAssignedClinician`; cohort routes behind `requireClinician`.

---

## 4 · Database schema changes

**New collections**

| Collection | Doc id | Purpose |
|---|---|---|
| `interventionOutcomes` | `{uid}_{jitaiLogId}` | idempotent pairing of intervention → outcome |
| `recoveryPlans` | `{uid}_{YYYY-MM-DD}` | today's goals + completion state |
| `recoveryScores` | auto | daily score snapshot for the trend line |

**Fields added to `jitaiLogs`** — `source` (`jitai` \| `self_initiated`),
`selectionMode`, `selectionRationale`, `completedAt`, `hour_of_day`, `day_of_week`.

Doc ids are deterministic so recompute is idempotent — `moodRoutes` step 9 reruns
`computeOutcomes()` on every check-in.

---

## 5 · ML workflow

```
effectiveness (backend, per user)
  measured outcomes → per-type raw mean mood delta
  → shrunk:  (n·userMean + 3·populationMean) / (n + 3)
  → confidence: n≥8 moderate · n≥4 low · else INSUFFICIENT

selection (ai-service, choose_intervention)
  1. crisisProbability > 0.75 or riskLevel crisis → "grounding"      [safety_floor]
  2. engagementRate < 25%                        → "checkin_nudge"   [engagement_floor]
  3. otherwise: shrunk effect + Gaussian(0, 0.5/√(n+1)) → argmax     [explore|exploit]
     candidates filtered by selectable_interventions(tracksCycle)

trajectory (ai-service, OLS on PHQ-9 vs days)
  latest < 5              → remission
  ≥50% reduction          → treatment_response
  slope ≤ −0.5/wk         → improving
  slope ≥ +0.5/wk         → deteriorating
  else                    → PLATEAU + "incomplete symptom alleviation" flag
```

**Bounded exploration under hard safety floors — not reinforcement learning.**
Be precise: the selector *does* explore, and reports it as `selectionMode:
"explore"`. Exploration is a single Gaussian perturbation scaled by 1/√(n+1), so
it decays as evidence accumulates — there is no policy, no value function, no
reward propagation, and no unbounded search. The two floors are hard constraints
no learned preference can override, so exploration never happens on a patient in
crisis or disengaging. Both floors are asserted in `verifyLoop.js`.

---

## 6 · Backend workflow

**Check-in (`POST /api/mood/log`)** — encrypt journal → parallel sentiment /
emotion / crisis → divergence → cycle LSTM → XGBoost + SHAP → alert if
crisis>0.50 or risk>0.60 → write `moodLogs` + `users.riskLevel`/`topFactors` →
**step 9: recompute outcomes (non-blocking)**.

**Hourly JITAI sweep** — dropout probability → **`effectivenessFor(uid)`** →
`perType` + `populationMean` + `engagementRate` + `tracksCycle` sent to
`/api/jitai/receptivity` → receptivity decides *whether*, `choose_intervention()`
decides *which* → `jitaiLogs` written with `selectionMode` + `selectionRationale`.

**Engagement** — `POST /api/jitai/log-response` resolves the pending JITAI
server-side, so the client never needs a `logId`; a self-initiated exercise
creates its own log with `source: 'self_initiated'`.

---

## 7 · Frontend workflow

**Mobile** — `Recovery.js`: score with components (never a bare number), trend,
today's plan, goal completion → `POST /api/recovery/goal`. Refuses to render any
value the backend marked `insufficient`. Non-clinical language throughout: a
plateau is "your symptoms have levelled off", never "failure to respond".

**Dashboard** — `RecoveryPanel.jsx` on `PatientDetail`: per-intervention
effectiveness with evidence strength, engagement, adherence, trajectory chip,
residual-symptom list, plateau indicator. Clinical wording lives here only.

---

## 8 · End-to-end testing guide

```bash
cd backend && node scripts/verifyLoop.js
```

44 assertions across 6 groups: vocabulary normalisation, engagement resolution,
outcome pairing, effectiveness/confidence, recovery score + residual symptoms,
and the learning engine including both safety floors. Creates a namespaced
synthetic patient, asserts through the real service functions, deletes only its
own documents. `--offline` skips the :8000 group; `--keep` retains the patient.

Named regression guards (each maps to a break that actually happened):
- a completed JITAI is never scored `ignored`
- legacy `somatic_breathing` normalises to `breathing` on read
- engagement rate is 50%, **not 0**
- no intervention is crowned on 1 observation
- no history yields `null`, not a fabricated 50
- crisis overrides learned preference

Manual: dashboard `npm run build` ✓ · backend module load ✓ · mobile screens parse ✓.

---

## 9 · Hackathon demo script (8 min)

**[0:00 Gap]** Caseload on screen. *"A patient sees a clinician about one hour a
year. The other 8,759 hours are invisible."*

**[1:00 Passive]** Phone → Sync Biometrics. HRV shows `—`: *"Fitbit doesn't
publish HRV. Absent signals stay null, never zero — zero would read as maximum
deviation and false-alert."*

**[2:00 Money shot]** Journal — **set mood to 4/5 or 5/5**, then write *"I keep
telling everyone I'm fine but I can't get out of bed and nothing matters
anymore."* Save. **Stop talking.** Alert lands. Open → SHAP factors → *"She said
fine. Her language didn't."*

> **Use a HIGH mood rating here.** Divergence measures the gap between what the
> patient claims and what their language shows, so the suppression story needs a
> high self-report with negative text. Measured: mood 5/5 + this journal →
> **0.929**; mood 4/5 → 0.197; mood 2/5 → 0.303; a consistent mood 1/5 + bleak
> journal → 0.071, correctly LOW because that patient is not suppressing.
> The earlier script said mood 2/5, which is not a suppression case at all.

**[3:30 Tamil]** Care tab → `enakku saavanum nu thonuthu`. *"Romanised Tamil. Our
classifier is English-only, so we detect language, translate through Sarvam, then
classify. Without that step: 0.008. With it: 0.96."* Then *"what dose of
sertraline should I take?"* → instant deferral. Support → Tele-MANAS 14416.

**[5:00 THE LOOP]** Dashboard → Recovery panel. *"Every system predicts risk. This
is the part nobody builds."* Per-intervention effect, engagement, and
`insufficient` shown honestly. Then trajectory: **plateau → incomplete symptom
alleviation.**

**[6:30 Recovery]** Phone → Recovery tab. Score with its four components, today's
three goals. *"The first goal is the intervention that measurably helped her —
chosen by the outcome data, not by a rule."*

**[7:30 Close]** *"Chatbots talk. Dashboards display. Niranthara closes the loop —
and then measures whether closing it helped."*

**Fallbacks** — long-press Sync Biometrics = deterministic crisis through the real
pipeline · long-press "Health Connect" = simulated mode · untagged chat = chain
bottomed out, narrate graceful degradation.

---

## 10 · Speaker notes

- Lead with the **gap**, not the stack. Judges have seen ten risk dashboards.
- Say the word **shrinkage** once and explain it in one sentence: *"three lucky
  observations shouldn't crown a winner, so sparse estimates stay pulled toward
  the population mean and we print 'insufficient' instead of a number."*
- When `insufficient evidence` appears on screen, **do not apologise for it.**
  Say: *"That is the system refusing to claim an effect it can't support."*
- The safety floors are the strongest 20 seconds you have. *"Crisis probability
  above 0.75 returns grounding and overrides anything the model learned. An
  optimiser is never allowed to decide not to ground someone."*
- If asked "is this RL?" — **do not say "we don't explore", because we do.** Say:
  *"It explores, and it tells you when it did — but it's bounded, not RL. One
  Gaussian perturbation that shrinks as evidence accumulates, no policy, no
  reward propagation. And two hard floors mean it never explores on someone in
  crisis or someone who's disengaging."*

---

## 11 · Judge Q&A

**Q. Is the effectiveness number from real usage or seeded data?**
Real. `verifyLoop.js` asserts the loop on data it creates through the live service
functions with no seeding shortcuts. Engagement previously read a field only the
seeder wrote — that bug is fixed and has a named regression test.

**Q. Why is engagement 50% and not higher?**
Because one of two synthetic interventions was ignored. A demo that always shows
100% is a demo running on fabricated data.

**Q. How is recoveryScore not a repackaged riskScore?**
`riskScore` is XGBoost P(deterioration), predictive, rises when things worsen.
`recoveryScore` is deterministic arithmetic over observed history against the
patient's own baseline, and is `null` until that history exists. They are
supposed to disagree sometimes.

**Q. You claim "zero hardcoding" — the JITAI used an if/elif chain.**
It did. It now delegates to `choose_intervention()`, the same selector the API
uses, so the scheduler cannot bypass the safety floors.

**Q. What stops the LLM giving medication advice?**
A deterministic input-side check, not the prompt. Probed raw with guardrails
bypassed, both models answered a sertraline dose question with a dose. Through
the app it returns `modelUsed: guardrail_input`.

**Q. What's the weakest part?**
Sample size. Most patients sit at `confidence: insufficient`. We report that
rather than hide it. Second: proximal mood delta is confounded — a patient who
completes an exercise is different from one who doesn't. Causal correction is on
the roadmap, not claimed today.

**Q. Tamil support — real or translated keywords?**
Language ID routes to Sarvam translation, then the English classifier runs. The
detector is a word list *for routing only*; no clinical decision uses keywords.

---

## 12 · Production roadmap

**Explicitly out of MVP scope, listed so the boundary is visible:**
causal inference for confounded proximal deltas · survival analysis for
time-to-dropout · medication-response prediction · Bayesian hierarchical pooling
across patients · federated per-site learning · reinforcement learning once
sample sizes and a safety envelope justify exploration.

**Nearer term:** Web Push + service worker for closed-browser clinician alerts ·
Google Health OAuth credentials (code complete) · Firestore composite indexes
(currently sorting in memory at demo scale) · real test runner (`verifyLoop.js` is
the only automated guard).

---

## 13 · Final repository audit

| Check | Result |
|---|---|
| `verifyLoop.js` | **44 passed, 0 failed** |
| Backend modules load + export | ✓ all 6 |
| `node --check` on 10 loop files | ✓ |
| `py_compile` on 4 AI files | ✓ |
| Dashboard `npm run build` | ✓ (chunk-size warning only) |
| Mobile screens parse (8 files) | ✓ |
| Client↔server route contracts | ✓ aligned |
| Route shadowing (`/:uid` vs `/cohort/all`) | ✓ none — differing segment counts |
| Intervention vocabulary | ✓ one source, 6 ids, alias map, normalised on read |
| Safety floors | ✓ both asserted |
| Sentiment model discriminates | ✓ 0.021 pos / 0.929 neg / 0.058 neutral (was a flat 0.338) |
| Crisis model discriminates | ✓ 0.0008 / 0.9945 / 0.0197 |
| Divergence polarity | ✓ suppression 0.929, consistency 0.071 (was inverted) |

**Known limitations, stated:**
1. No test runner beyond `verifyLoop.js`; no unit tests.
2. Proximal outcomes are confounded (self-selection into engagement).
3. Firestore indexes still dodged by in-memory sorting.
4. Mobile UI verified by parse and by the author's device, not by automated E2E.
5. `docs/CLINICAL_GAP_ANALYSIS.md` still unwritten.
6. Demo scaffolding (`Home.js` long-press triggers) must be removed post-hackathon.

---

## Can Niranthara now honestly claim to solve the official problem statement?

**Yes — with the scope stated honestly.**

| Clause | Evidence in code |
|---|---|
| Incomplete symptom alleviation | PHQ-9 OLS trajectory with a plateau state that emits the problem statement's own phrase; residual-symptom detection at PHQ-9 item level, which total-score systems cannot see; per-intervention effectiveness with confidence |
| Attrition | dropout XGBoost; engagement rate now measured from real fields; the `engagement_floor` constraint that de-escalates to the lowest-effort action when outreach is being ignored |
| Loss of follow-up | escalation cron every 15 min; `daysSinceContact`; the daily check-in is a permanent plan goal because it is the measurement the loop depends on |

What it does **not** claim: that any effect size here is causal, or that a
shrunk mean over a handful of observations is clinical evidence. The system says
`insufficient` more often than it says anything else, and that is the design.

The loop is closed: monitoring → prediction → recovery plan → intervention →
outcome → learning → better intervention. It is verified end-to-end by a script
that fails loudly when any join breaks — which is the only reason the claim is
worth making.
