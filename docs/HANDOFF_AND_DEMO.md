# Niranthara — Handoff, Feature Guide & Demo Script
**State as of 2 August 2026.** Paste §1 into a new chat to restore full context.

---

# §1 · CONTEXT BLOCK — paste this into the next session

> I'm working on **Niranthara**, an AI mental-health *continuity* platform at
> `D:\Niranthara-AI-Powered-Mental-Health-Continuity-1`. Five services:
> `mobile-app/` (React Native, Expo SDK 54), `backend/` (Node 20 / Express 5, :5000),
> `ai-service/` (Python 3.11 / FastAPI, :8000), `dashboard/` (React 19 / Vite, :5173),
> Firestore as the integration bus. **Read `CLAUDE.md` first** — it holds every
> hard-won gotcha. There is a multi-agent setup in `niranthara-multiagent/`
> (`CLAUDE.md` + `ORCHESTRATION_PROMPT.md`).
>
> **Problem statement:** *"How might we utilize AI chatbots and machine learning
> to address incomplete alleviation of depression symptoms, attrition, and loss
> of follow-up in mental health treatment?"* Submission: **Niral Thiruvizha 3.0**.
>
> **Recently fixed (verified, don't re-break):**
> - Crisis classifier was `mental/mental-roberta-base` — a pretrained LM with a
>   **randomly initialised head**, returning a constant ~0.465 for every input.
>   Crisis detection had never fired. Now `sentinet/suicidality`, wired through
>   `ai-service/utils/crisis_classifier.py`.
> - `detect_language()` classified Tanglish as English, so Tamil suicidal
>   ideation skipped Sarvam translation and scored 0.008 instead of 0.96.
>   Rewritten with distress vocabulary + romanised-Tamil morphology.
> - `minimaxai/minimax-m2.7` is **HTTP 410 Gone**. Chat chain is now
>   `meta/llama-3.1-8b-instruct` (~1.3s) → `nvidia/nemotron-3-super-120b-a12b` (~4.5s);
>   summary is the reverse.
> - Mobile `BASE_URL` had a one-digit IP typo and `postData()` reported every
>   network failure as "Saved Offline". Now probes candidates against `/api/health`.
> - Gender is asked in onboarding, never inferred; cycle features are opt-in via
>   `mobile-app/src/utils/profile.js` → `tracksCycle()`.
> - **NEW: intervention→outcome loop** (see §3).
>
> **Open items:** Google Health OAuth credentials not set (roadmap, not demo).
> The clinical audit is written: `docs/CLINICAL_HONESTY_AUDIT.md`. The MVP is
> feature-complete and verified by `backend/scripts/verifyLoop.js` (44/44).

---

# §2 · Run it

```bash
# 1 — AI service
cd ai-service && PYTHONUTF8=1 .venv/Scripts/python.exe -m uvicorn main:app --port 8000

# 2 — backend
cd backend && node index.js

# 3 — dashboard
cd dashboard && npm run dev

# 4 — mobile (Expo Go: phone and laptop on the SAME WiFi)
cd mobile-app && npx expo start
```

The app now **auto-discovers the backend** — it probes `localhost:5000` then the
Expo packager IP against `/api/health` and keeps whichever answers. Watch Metro
for `[api] backend reachable at …`. No file editing on IP change.

If `adb` is missing: `export PATH=$PATH:"/c/Users/athvi/AppData/Local/Android/Sdk/platform-tools"`

**Verify data anytime:**
```bash
cd backend && node scripts/verifyData.js
```

---

# §3 · THE INTERVENTION → OUTCOME LOOP (new — the headline feature)

**The gap it closes.** Everything before this measured *risk*. Nothing measured
whether acting on that risk **helped**. A JITAI fired and the record ended there,
so the system could not answer the question a psychiatrist asks first:
*"You told me she was deteriorating. What happened after you told me?"*

**The loop:**

```
intervention delivered
  → engagement      (completed / opened / dismissed / ignored)
  → proximal outcome (mood at next check-in vs the 3 before it, 72h window)
  → distal outcome   (PHQ-9 either side)
  → per-user effectiveness → feeds the next intervention choice
```

| Piece | File |
|---|---|
| Outcome pairing + shrunk effectiveness | `backend/services/outcomeService.js` |
| KPI + cohort endpoints | `backend/routes/outcomeRoutes.js` |
| Adaptive selection + trajectory | `ai-service/routers/outcome.py` |
| Demo history seeder | `backend/scripts/seedInterventions.js` |
| Recompute trigger | `moodRoutes.js` step 9 |

**Endpoints**
- `GET /api/outcomes/:uid` — every intervention with its measured outcome
- `GET /api/outcomes/:uid/kpis` — the three problem-statement clauses as data
- `GET /api/outcomes/cohort/all` — caseload roll-up, worst-responding first
- `POST /api/outcome/select` — next intervention + rationale
- `POST /api/outcome/trajectory` — PHQ-9 OLS slope → clinical state

### Two design decisions to defend on stage

**1 · Shrinkage, not raw means.** `(n·userMean + 3·populationMean) / (n + 3)`.
Three lucky observations cannot crown a winner. The API reports `confidence:
insufficient` until n ≥ 4 — and right now it says exactly that for most patients.
*That honesty is the feature.*

**2 · Bounded exploration under hard floors, not reinforcement learning.** The
selector does explore and reports `selectionMode: "explore"`; what it avoids is
RL's unbounded search — no policy, no value function, no reward propagation.
Exploration decays as 1/sqrt(n+1) and is blocked entirely when the patient is in
distress: Thompson-style sampling sits behind a **hard safety floor** — crisis
probability > 0.75 returns `grounding` with `selectionMode: "safety_floor"`,
overriding any learned preference — and an **engagement floor** that de-escalates
to `checkin_nudge` below 25% engagement. Both verified in `verifyLoop.js`.

### Verified output

```
trajectory: plateau | slope/wk: -0.09 | reduction: 5.6%
FLAG: Incomplete symptom alleviation — engaged but not improving; consider treatment review.
```

That flag is the problem statement's own words, produced from data.

---

# §4 · Feature guide (for studying)

| Capability | Model / method | Where |
|---|---|---|
| Crisis detection | `sentinet/suicidality` (ELECTRA) | `utils/crisis_classifier.py` |
| Sentiment (Ta/Tanglish/En) | `cardiffnlp/twitter-xlm-roberta-base-sentiment` | `routers/sentiment.py` |
| Emotion, 7-class | distilroberta | `routers/emotion.py` |
| Risk score + explanation | XGBoost 15-feature + SHAP | `routers/predict.py` |
| Cycle vulnerability | per-user LSTM (opt-in) | `routers/cycle.py` |
| Biometric anomaly | per-user LSTM autoencoder | `routers/anomaly.py` |
| Dropout / disengagement | XGBoost | `routers/dropout.py` |
| JITAI receptivity | per-user XGBoost | `routers/jitai.py` |
| **Effectiveness + trajectory** | **shrunk means + OLS** | **`routers/outcome.py`** |
| Conversation | NVIDIA chain (llama-3.1-8b → nemotron-120b) | `utils/nvidia_client.py` |
| Tamil STT + translation | Sarvam `saarika:v1` / `mayura:v1` | `utils/sarvam_client.py` |

**Signature insight — emotional suppression.** Stated mood (1–5) vs expressed
sentiment (NLP over the journal). The *divergence* is the clinical signal:
someone rating 4/5 while writing strongly negative language is minimising.
*"She said she was fine. Her language said otherwise."*

**Safety architecture (two-tier, deterministic).** `is_dosing_question()` defers
medication questions **before** the LLM runs; `apply_output_guardrail()` catches
leakage after. This matters: probed raw with guardrails bypassed, both
llama-3.1-8b and nemotron-120b **answered a sertraline dose question with a
dose**. Through the app the same message returns `modelUsed: guardrail_input`.
**The prompt does not make it safe — the deterministic layer does.**

**Problem-statement mapping**

| Clause | Covered by |
|---|---|
| Incomplete symptom alleviation | PHQ-9 trajectory, plateau flag, effectiveness per intervention |
| Attrition | dropout XGBoost, engagement rate, check-in adherence |
| Loss of follow-up | escalation cron (15 min), `daysSinceContact`, loss-of-contact alerts |

---

# §5 · Demo script (8 minutes)

**Setup:** all four services up, dashboard on the projector, phone mirrored.
Run `node scripts/verifyData.js` beforehand to confirm data is live.

**[0:00 — The gap]** Caseload on screen. *"A patient sees a clinician about one
hour a year. The other 8,759 hours are invisible."*

**[1:00 — Passive signal]** Phone → **Sync Biometrics**. Point at the risk ring.
HRV shows `—`: *"Fitbit doesn't publish HRV. Absent signals stay null, never
zero — a zero would read as maximum deviation and false-alert."*

**[2:00 — The money shot]** Journal → mood 2/5 → type
*"I keep telling everyone I'm fine but I can't get out of bed and nothing
matters anymore."* → Save. **Stop talking.** Alert lands on the projector.
Open it → **Top Risk Factors (SHAP)** → *"She said fine. Her language didn't."*

**[3:30 — Tamil]** Care tab → type **`enakku saavanum nu thonuthu`**.
*"Romanised Tamil. Our classifier is English-only — so we detect the language,
translate through Sarvam, and only then classify. Without that step this scores
0.008. With it, 0.96."* Then *"what dose of sertraline should I take?"* →
instant deferral. Tap **Support** → Tele-MANAS 14416.

**[5:00 — THE LOOP]** Dashboard → **Intervention Effectiveness**.
*"Every system here predicts risk. This is the part nobody builds."*
Show per-intervention mood deltas, engagement rates, and
`confidence: insufficient`. *"We refuse to claim an effect from three data
points. That's shrinkage, and it's why a clinician can trust the number that
does appear."* Then the trajectory: **plateau → incomplete symptom alleviation.**
*"Engaged, adherent, and not getting better. That is the exact phrase in the
problem statement, and it is the patient a risk-only system never surfaces."*

**[6:30 — Continuity]** Loss-of-follow-up alert. *"Nobody silently exits care."*
**Generate Summary** → **Resolve**.

**[7:30 — Close]** *"Chatbots talk. Dashboards display. Niranthara closes the
loop — and then measures whether closing it helped."*

**Fallbacks:** long-press **Sync Biometrics** = deterministic crisis through the
real pipeline · long-press "Health Connect" title = simulated mode · untagged
chat text = chain bottomed out, narrate graceful degradation.

---

# §6 · What's still open

1. `docs/CLINICAL_GAP_ANALYSIS.md` — not written.
2. Dashboard UI for the outcome loop — endpoints exist, no panel yet.
3. Google Health OAuth — code complete, credentials not set (`docs/REAL_WEARABLE_SETUP.md`, ~30 min).
4. Medication adherence, survival analysis, treatment-response prediction — roadmap.
5. Mobile UI never verified on device by me beyond your screenshots.
