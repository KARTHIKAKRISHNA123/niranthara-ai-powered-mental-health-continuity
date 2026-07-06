# NIRANTHARA — Hackathon Winning Strategy (Part 12)

Companion to `DEMO_RUNBOOK.md` (mechanics) and `NIRANTHARA_V2_MASTER_PLAN.md` (architecture/roadmap). This document is the *competitive* layer: how to convert what is already built into a win. Scope is **MVP only** — nothing here requires new code beyond the execution checklist in §7.

---

## 1. Decoding the problem statement

> *"How might we utilize AI chatbots and machine learning to address incomplete alleviation of depression symptoms, attrition, and loss of follow-up in mental health treatment?"*

**Read it carefully — it is three problems, and two of them are not about chatbots:**

| Phrase | Hidden requirement | What it demands |
|---|---|---|
| *Incomplete alleviation* | Symptoms persist **between** visits, invisibly | Continuous measurement (PHQ-9 trends, mood logs, passive signal) — not conversation |
| *Attrition* | Patients quietly stop engaging | A **prediction** problem (who will drop out?) + a re-engagement mechanism |
| *Loss of follow-up* | The system, not the patient, loses track | Escalation infrastructure: sweeps, alerts, acknowledgment |
| *"AI chatbots AND machine learning"* | The rubric expects both, as distinct capabilities | Show the chatbot as one **sensor** feeding an ML risk engine — not as the product |

**Stakeholders judges will score against:** patient (engagement), clinician (workload, trust), health system (outcomes, liability), regulator (safety, privacy).

**What most teams will build:** a CBT-flavored chatbot with a mood diary and a static dashboard. Some will add GPT-generated affirmations. Almost none will have: real ML models running locally, wearable fusion, dropout prediction (the *actual* attrition ask), explainability, or a crisis response path. **Nearly every team will fail the "what happens after detection?" question.**

**Our differentiation, in one line judges remember:**
> *"Every other team built the conversation. We built the 729 hours between conversations."*

Concretely, NIRANTHARA stands out on five axes no chatbot-team can match:
1. **The closed loop is live on stage** — journal → 3 transformers + XGBoost → clinician alert in ~1 second, projected.
2. **Attrition answered literally** — a dropout-prediction XGBoost model plus a 15-minute escalation cron for loss-of-follow-up. Most teams won't even address the word.
3. **Explainability** — SHAP factors on every risk score, on both patient and clinician UIs.
4. **Per-user personalization** — cycle LSTM, JITAI receptivity, anomaly autoencoders trained per patient, not population averages.
5. **Safety engineering** — crisis screen, PHQ-9 item-9 protocol, LLM dosing guardrail, AES-256-GCM. Judges with healthcare backgrounds score this heavily.

---

## 2. Steps 2–6 (brainstorm/ML/LLM/agents) — MVP disposition

Complete creative-freedom brainstorming already exists in `NIRANTHARA_V2_MASTER_PLAN.md` (§6: 111 features; §12: full model portfolio). For the MVP, the strategic answer is **restraint**: everything on the buzzword list that is already genuinely in the build gets *named* in the pitch; nothing new gets built days before the demo.

**Say these terms out loud during the demo — each is genuinely true in the codebase, and judges score recognized vocabulary:**

| Buzzword | Where it actually lives (say this when asked) |
|---|---|
| Multi-modal risk fusion | 15-feature XGBoost: text NLP + biometrics + cycle + behavior (`predict.py`) |
| Explainable AI (XAI) | SHAP top-factors on every score → dashboard panel + patient narrative card |
| Anomaly detection / digital biomarkers | Per-user LSTM autoencoder over behavioral/biometric baselines (`anomaly.py`) |
| Time-series AI | Cycle LSTM vulnerability forecasting (`cycle.py`) |
| Adaptive personalization / JITAI | Per-user receptivity XGBoost, hourly sweep (`jitaiScheduler.js`) |
| Attrition prediction | Dropout XGBoost (`dropout.py`) + escalation cron |
| Context-aware LLM with memory | Live Firestore context injection + 8-turn history threading |
| LLM resilience engineering | Model chain: Minimax (25s budget) → Llama fast lane (1.2s) → guarded static |
| Human-in-the-loop | Every AI output routes to a clinician decision; AI never acts alone |
| Wearable intelligence | Weighted physiological stress vs personal baselines (`biometricRoutes.js`) |

**Multi-agent framing (Step 6) — say it, don't build it:** the architecture *already is* a multi-specialist system — conversation (Minimax chain), emotion/sentiment/crisis (three transformers), risk (XGBoost), escalation (cron), summary (clinical LLM path), notification (FCM + browser). When a judge asks "did you consider multi-agent?", the winning answer: *"We are multi-model with a deterministic orchestrator — nine specialist models behind one backend. We chose orchestrated determinism over autonomous agents because in clinical safety, you want auditable control flow, not emergent behavior."* That answer beats having LangGraph in the repo.

**The one "LLM ecosystem" member to name beyond the companion:** the **Clinician Copilot** (the AI summary + SHAP panel + triage queue *is* one). Two assistants, two users, one platform.

---

## 3. The MVP wow-moment ranking (Step 7)

Ordered by judge impact per second of demo time. Everything below is already built.

1. **The 1-second alert.** Journal on phone → projected dashboard alert appears live. Rehearse until flawless; this single moment outscores any slide.
2. **The SHAP panel.** "The AI shows its work" — tap from alert to top risk factors. AI researchers on the panel will visibly react.
3. **Crisis interception.** Distress message → full-screen helplines/grounding, *while* the clinician alert lands in parallel. Answers the ethics question before it's asked.
4. **The clinician summary.** One click → 30 days → 5 clinical sentences. Product leaders and clinicians score this.
5. **PHQ-9 → dashboard trajectory.** Validated instrument, live sync, item-9 protocol. The clinical-credibility anchor.
6. **The guardrail stunt (keep in reserve).** Invite a judge to ask the bot for a medication dose; watch it decline. Only do this if Q&A energy is right — it's the highest-risk, highest-reward 20 seconds available.
7. **Biometric sync + suppression arc.** "She says fine; her language and HRV disagree."

---

## 4. Demo scenario (Step 8) — the narrative spine

One patient, one story, told across two screens. Name her (seeded: Ananya, 25, engineering student, PMDD).

1. Ananya opens the app — risk ring, cycle forecast visible (passive intelligence, zero effort).
2. She syncs her watch — stress score computed against *her* baseline, not population norms.
3. She takes the PHQ-9 — score lands on the projected dashboard chart seconds later.
4. She journals honestly at last — three transformers + XGBoost fire in parallel; **the clinician's screen lights up in ~1 second** with browser notification even if the tab is backgrounded.
5. Clinician opens the alert — SHAP explains *why*; the AI summary compresses her month into 5 sentences; clinician resolves the alert (acknowledgment workflow).
6. Meanwhile Ananya's chat turns dark — crisis classifier intercepts, full-screen support with tap-to-call Tele-MANAS; escalation already queued for the care team.
7. Close: the loop diagram. *"Detection, explanation, intervention, escalation, follow-up — that's continuity."*

Every step exists. The demo is 100% real code paths (with simulated wearable data, stated honestly if asked).

---

## 5. Presentation plans (Step 11)

**Universal rules:** dashboard projected + phone visible simultaneously the entire time · no emojis on any slide · at most 4 slides (problem, architecture, moat, close) — the product is the deck · the phrase "trained model, not keyword matching" said exactly twice · never say "we didn't have time to…"; say "that's V1, and here's the plan."

### 5-minute (elimination rounds — cut everything but the loop)
| Time | Beat |
|---|---|
| 0:00–0:30 | Hook: "1 hour observed, 729 hours invisible. 60% drop out in the invisible hours." |
| 0:30–1:30 | Phone: home rings → biometric sync → begin journal entry |
| 1:30–2:30 | **The 1-second alert** → SHAP panel walk |
| 2:30–3:30 | Crisis chat → interception screen; mention guardrail + escalation cron |
| 3:30–4:15 | Clinician summary click; PHQ-9 trajectory in passing |
| 4:15–5:00 | Loop diagram + moat line + ask |

### 7-minute (primary — full script in `DEMO_RUNBOOK.md` §3)
Adds: PHQ-9 taken live start-to-finish, suppression arc, JITAI card, alert resolve workflow.

### 10-minute (finals)
Adds to the 7-minute: 60-second architecture slide (5 services, 9 models — point at the FastAPI docs page live at `:8000/docs`); 45 seconds on the model chain ("we measured 20–60s reasoning-model latency and engineered a three-tier fallback — this is production thinking"); 45 seconds business (B2B2C, campus beachhead, the self-labeling data moat); guardrail stunt if a judge is engaged; 30-second honest-limitations slide (synthetic training labels + the retraining flywheel) — **voluntarily showing your limits before Q&A is the single strongest credibility move available.**

---

## 6. Judge Q&A — 50 questions with answers (Step 12)

Rehearse aloud. Answers are deliberately 1–3 sentences — expand only if asked.

### AI / ML (1–12)
1. **What's your risk model trained on?** Synthetic data today — stated plainly. The architecture self-labels in production: dropout labels from observed disengagement, JITAI labels from nudge responses, risk labels from subsequent PHQ-9s. Weeks of pilot data make it real; no one can shortcut that time, which is also our moat.
2. **Why XGBoost and not deep learning for risk?** 15 tabular features, small data, need for SHAP explainability and CPU inference. Deep learning there would be résumé-driven engineering.
3. **How do you handle missing features (no wearable)?** XGBoost handles missing values natively; the model degrades gracefully — wearables are 1 of 15 features, never the verdict.
4. **What's your crisis classifier and its false-negative story?** `mental/mental-roberta-base`, tuned for recall over precision; borderline scores are still logged and the escalation cron re-sweeps every 15 minutes, so a single miss doesn't mean silence.
5. **Alert fatigue — false positives will make clinicians ignore you.** Correct, and it's why our production metric is precision-at-fixed-alert-budget (alerts per clinician per day), every alert carries SHAP context, and acknowledgments feed threshold tuning.
6. **How is the anomaly detection personalized?** An LSTM autoencoder per user learns their behavioral manifold; the anomaly score is reconstruction error against *their own* baseline, and feeds the risk fusion as feature 15.
7. **Why per-user models? Does that scale?** Personalization is the clinical point — your normal isn't mine. At 1M users we migrate to shared models conditioned on user embeddings; the per-user design is right for the data volumes of the next two years.
8. **What's the cycle model?** A per-user LSTM forecasting mood vulnerability across the menstrual cycle — PMDD affects millions and most platforms treat it as noise; we model it as signal.
9. **How do you evaluate the models?** Each has a naive baseline it must beat publicly: risk vs persistence, JITAI vs random-timing sends, cycle vs seasonal naive. AUROC alone is not honest for imbalanced clinical data — we report calibration and precision at the alert budget.
10. **Model drift?** Production plan: score distributions and feature drift monitored per release, `model_version` stored with every score so "which model said this" is always answerable.
11. **Why not fine-tune the LLM?** Prompt + context injection beats fine-tuning at our data scale, keeps us model-portable (proven — we swapped fallback tiers in a day), and avoids baking synthetic data into weights.
12. **Is the emotion detection validated for Indian English/Tanglish?** Sentiment runs on ai4bharat/indic-bert (built for Indian languages); emotion is a known gap on code-mixed text — flagged for fine-tuning with pilot data.

### LLM / chatbot (13–20)
13. **Which LLM and why?** Minimax M2.7 via NVIDIA's OpenAI-compatible API — a reasoning model chosen for empathy quality — with an engineered fallback chain to Llama-3.1-8b (~1.2s measured) because we measured 20–60s reasoning latency. Resilience over brand loyalty.
14. **How does the bot remember context?** Two mechanisms: live clinical context injected per message (mood, risk, cycle, emotion from Firestore) and the last 8 conversation turns threaded client → backend → LLM.
15. **What stops it giving medical advice?** Three layers: hard rules in the system prompt, a deterministic output-side dosing guardrail (regex over the reply — a labeled safety floor, not a clinical decision), and the product rule that all clinical decisions route to humans.
16. **Prompt injection?** The user message is delimited and the system prompt instructs against instruction-following from user content; retrieved context is data-only. Red-team suite is on the V1 list — we won't claim it's solved.
17. **Hallucination risk?** The companion never states clinical facts or data — it reflects and supports. The clinician summary is generated only from structured aggregates we hand it, with a "never invent data" instruction and a deterministic fallback.
18. **Why does the reply sometimes take 20+ seconds?** Reasoning models trade latency for quality; the typing indicator holds the moment, and the fast lane answers in ~1.5s when the primary stalls. We measured, then engineered.
19. **Is this therapy? Who's liable?** It's a support companion and monitoring platform, not a medical device — it never diagnoses or treats. The clinician remains the decision-maker; that boundary is legally deliberate (SaMD threshold).
20. **What if the patient only speaks Tamil?** Language detection is live (indic-bert); responses support English/Tanglish today, full Indic UI is roadmap. Multilingual is architectural, not aspirational.

### Architecture / engineering (21–28)
21. **Walk me through the stack.** Five services: Expo mobile, Express orchestration (auth, encryption, crons), FastAPI ML service (9 routers), React dashboard on Firestore onSnapshot, wearable simulator. Firestore is the integration bus.
22. **Why Node between mobile and the ML service?** Separation of concerns: Node owns auth/encryption/orchestration; Python owns inference. The ML service is internal-only, so models change without mobile releases.
23. **Why Firestore and not Postgres?** onSnapshot gives sub-second dashboard updates with zero infra — right for this scale. The V2 migration plan to Postgres + Timescale is written, with dual-write and per-org keys.
24. **What breaks at 1M users?** Per-user model files first (→ embedding-conditioned shared models), then ingestion writes (→ queue + batch), then NLP inference (→ GPU batching). Sequenced in the master plan.
25. **Real-time — WebSockets?** Firestore onSnapshot *is* our push channel (gRPC streams under the hood); browser notifications cover backgrounded tabs; FCM covers mobile. Web Push service worker is the production step for closed browsers.
26. **Where are the tests?** Honest: no test suite — a deliberate hackathon tradeoff documented in the repo; every pipeline was verified end-to-end by execution, and the V1 plan starts with pytest + supertest on the crisis and assessment paths (the safety-critical ones).
27. **What was your hardest bug?** Chat "repeating itself": an 8s client timeout aborting 20-40s reasoning-model replies, so users only ever saw the offline fallback. Diagnosed with live latency probes, fixed with a per-request timeout and the model chain. (Tell this story — debugging stories build more trust than feature lists.)
28. **Offline behavior?** Mobile is offline-first (AsyncStorage queue, sync on reconnect); assessments score locally when the server is unreachable and say so honestly.

### Security / privacy / data (29–36)
29. **How is journal data protected?** AES-256-GCM field-level encryption *before* Firestore — a DB leak yields ciphertext. History endpoints strip encrypted fields; the dashboard never renders raw journal text, only model-derived signals.
30. **Who can see a patient's data?** Self or assigned clinician only, enforced by middleware on every patient route (we closed an IDOR across 7 route files ourselves — say this; finding your own vulnerability is credibility).
31. **Chat privacy from the clinician?** Raw chat is self-only — even the assigned clinician sees only derived signals and aggregate summaries. Privacy is architectural.
32. **Compliance?** Designed against India's DPDP Act principles (consent, purpose limitation) with GDPR-style portability; formal consent management and audit logs are V1, and we don't claim HIPAA until we've earned it.
33. **The LLM sees plaintext — isn't that a leak?** Inference requires plaintext transiently; it's never persisted unencrypted, and the clinician summary path never receives raw text at all. Local NLP models (crisis/sentiment/emotion) run on our machine — that text never leaves.
34. **Consent for passive monitoring?** Permission-gated at onboarding; V1 adds granular revocable scopes where revoking stops feature *computation*, not just display.
35. **Right to deletion?** Firestore deletes today; production plan is crypto-shredding — destroy the key, not 40 collections.
36. **What do you log?** Scores, latencies, model versions — never raw user content. That rule is written in the repo conventions.

### Clinical safety / ethics (37–42)
37. **What happens when crisis fires at 3 AM?** The patient gets an immediate full-screen response in-app (helplines, grounding, breathing) — client-side, works offline. The clinician alert is escalation, not the only response.
38. **A patient your model calls low-risk dies. What went wrong?** The system only ever *adds* attention — low risk means standard care continues, never less care. And the loss-of-follow-up cron exists precisely so no one silently exits the system. We'd audit the stored model version, features, and SHAP for that exact score — full decision provenance.
39. **Is PHQ-9 self-report reliable?** It's the clinical standard with known limits — which is why it's one signal fused with passive data, and why item 9 triggers a human protocol regardless of total.
40. **Could the bot make someone worse?** The risk is real; mitigations: no advice at low mood (context rules), crisis interception, guardrails, and human escalation. We treat the chatbot as a monitored surface, not an autonomous therapist.
41. **Bias — does this work for men? Non-English speakers? Budget phones?** Fairness slices (gender, language, device tier) are in the evaluation plan; indic-bert reduces English-first bias; the cycle model makes women's health signal, not confounder; phone-only sensing (no wearable) is V2 for the access question.
42. **Clinicians will say you're increasing their workload.** The opposite is the design: triage-ranked caseload, 5-sentence summaries, and SHAP context mean less time hunting, more time treating. Pilot metric: minutes-to-decision per patient.

### Wearables (43–45)
43. **Fitbit's HR is noisy — you'll alert on a staircase.** Single signals never alert: the stress score is HR+HRV+sleep+steps weighted against *personal* baselines, then fused with 7-day mood context through the risk model. A staircase doesn't move your weekly sleep debt.
44. **Locked to Fitbit?** No — Health Connect is the hub (Fitbit, Samsung, Pixel, Xiaomi all write into it); the adapter interface means a new vendor is one file. Device pluralism is a sales requirement, so it's an architecture requirement.
45. **Is the demo wearable data real?** Simulated on stage for determinism — stated proudly, it flows through the identical pipeline; real Health Connect reads are implemented and work on a dev build.

### Business / product (46–50)
46. **Who pays?** B2B2C: clinics and hospitals per-patient-per-month; campus counseling centers as beachhead; never patients directly (Mindstrong's lesson).
47. **Competitors — Wysa exists.** Wysa is a conversation; NeuroFlow is a dashboard. Nobody closes the loop — detection → JITAI → escalation → follow-up recapture — per-user and explainable, in Indian languages. We're infrastructure, not another chatbot.
48. **Moat?** The outcome-labeled longitudinal dataset the feedback loop generates. Every deployed month produces training labels money can't buy retroactively.
49. **Go-to-market?** 2–3 psychiatry clinics as free design partners → published attrition deltas → university counseling centers → hospital systems. India: Tele-MANAS created national crisis infrastructure with no continuity layer; we're the missing limb.
50. **What do you need to ship a real pilot?** Six weeks: consent + audit layer, alert SLA workflow, composite indexes, test suite on safety paths, one clinic partner. The list is written and sequenced — that's the difference between a demo and a product.

---

## 7. Execution plan to demo day (Steps 9–10, MVP only)

**Engineering is done. Do not write new features.** Remaining work is data, rehearsal, and polish:

### T-3 days — freeze & seed
- [ ] Code freeze: only demo-blocking fixes merge from here.
- [ ] Fresh Python venv built; models pre-downloaded; both NVIDIA tiers probed (script pattern in session history — expect Minimax 20-40s, Llama ~1.5s).
- [ ] `node scripts/seedTestUser.js` against the demo Firebase project; verify: patient in caseload, 2 alerts, PHQ-9 trajectory chart, SHAP panel populated.
- [ ] Click all Firestore index-creation URLs from backend logs; confirm "Enabled".
- [ ] README: fix the stale "Gemma 4B via Ollama" prose (judges read READMEs; the code says NVIDIA chain).

### T-2 days — full dress rehearsal 1 (on the demo hardware + hotspot)
- [ ] Run the entire 7-minute script end-to-end, timed, phone + projector.
- [ ] Verify each wow moment: 1-second alert · browser notification with tab backgrounded (permission pre-granted) · crisis interception · guardrail decline · summary generation (< 30s; if slow, note the fast-lane tag).
- [ ] Test every failure-playbook row in `DEMO_RUNBOOK.md` §4 deliberately: kill ai-service mid-demo, airplane-mode the phone, ask the bot for a dose.
- [ ] Record the rehearsal as the backup video. **Non-negotiable.**

### T-1 day — dress rehearsal 2 + Q&A drill
- [ ] Second timed run; fix pacing only.
- [ ] Q&A drill: teammate fires 15 random questions from §6; every answer under 20 seconds.
- [ ] Assign roles: driver (phone), narrator, Q&A lead. The narrator never touches hardware.
- [ ] Charge everything; disable OS notifications/updates on the demo laptop; pre-grant browser notification permission; zoom dashboard to 125% for projector legibility.

### Demo day
- [ ] Arrive early; hotspot up; all four services started in order (runbook §2); smoke test (runbook checklist).
- [ ] Simulated biometric mode ON (long-press toggle).
- [ ] Backup video on the desktop, one keypress away.
- [ ] Before walking on: one journal log to warm the pipeline and confirm the projected alert.

**Testing strategy beyond MVP** (for the inevitable question, and for V1): pytest on scoring/guardrail/summary fallbacks, supertest on auth/assessment/alert routes, Playwright on the dashboard alert flow, a scripted "AI quality" eval set (20 messages with expected crisis/no-crisis outcomes), and load tests on `/api/mood/log` — sequenced in the master plan §7/V1. Say "sequenced, not skipped."
