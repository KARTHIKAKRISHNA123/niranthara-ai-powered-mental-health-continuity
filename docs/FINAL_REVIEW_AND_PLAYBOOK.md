# NIRANTHARA — Final Review & Demo Playbook
**2 August 2026. The day-of artifact.** Everything here is defensible from the
repository; nothing is invented.

## How this document relates to the others

Parts 1–10 of the review brief are already written and verified. They are indexed
here rather than duplicated — four documents restating the same architecture is
how `IndicBERT` and `minimax-m2.7` survived in the README for weeks after the code
moved on.

| Part | Lives in |
|---|---|
| 1 Executive summary · 2 Problem-statement mapping | `MASTER_KNOWLEDGE.md` Ch. 1–2, 16 |
| 3 Architecture · 4 User journey | `MASTER_KNOWLEDGE.md` Ch. 3–4, 15 |
| 5 API walkthrough · 6 Database | `MASTER_KNOWLEDGE.md` Ch. 7–8 |
| 7 ML walkthrough · 8 Recovery Engine | `MASTER_KNOWLEDGE.md` Ch. 9, 11 |
| 9 Architecture review | `MASTER_KNOWLEDGE.md` Ch. 13 + CTO diligence |
| 10 Clinical honesty | `CLINICAL_HONESTY_AUDIT.md` (all 12 sections) |
| **11 Judge attacks · 12 Interview sim** | **§A below — 104 questions** |
| **13 Communication drills** | **§B below** |
| **14 Demo script** | **§C below** |
| **15 Winning strategy** | **§D below** |

---

# §A · Question Bank — 104 questions

Format: **Q** → the answer that survives the follow-up. Where an answer requires
conceding something, it concedes it — that is what makes the rest credible.

## A1 · Machine learning (18)

1. **What data trained the risk model?** 600 synthetic rows, `np.random.normal` around hand-set class means, seed 42. Demonstrates the pipeline, not clinical accuracy.
2. **So your risk score is meaningless?** As a clinical predictor today, yes. As a demonstration that features → SHAP-explained score → action works end to end, no. The outcome loop is the part measured on real data.
3. **Is divergence circular inside the model?** Yes — it was generated with class-increasing means. At inference it's a real measurement; its *weight* is an assumption we'd validate on real data.
4. **Why XGBoost over a neural net?** Tabular, 15 features, hundreds of rows. Trees win at that scale and SHAP gives per-patient attribution a clinician can read.
5. **Why SHAP not feature importance?** Global importance says what matters on average; SHAP says what drove *this* patient's score.
6. **Is this reinforcement learning?** It explores and reports `selectionMode: "explore"`. Not RL — no policy, no value function, no reward propagation. One Gaussian perturbation scaled 1/√(n+1).
7. **Then it does explore on patients?** Only outside the floors. Crisis > 0.75 → grounding; engagement < 25% → checkin_nudge. Never on someone in crisis or withdrawing.
8. **Why shrinkage?** `(n·user + 3·pop)/(n+3)`. Three lucky observations must not crown a winner.
9. **Why k = 3?** It makes n = 3 weigh equally with the prior. Chosen for interpretability, not tuned — we have no validation set to tune on.
10. **Why "insufficient" below n = 4?** Below four paired observations a mean is noise. We print the label instead of the number.
11. **How do you know an intervention caused improvement?** We don't. Self-selection confounds it. Associational, shrunk, labelled.
12. **Why not fine-tune the crisis model?** No labelled clinical corpus. A badly fine-tuned safety classifier is worse than a good pretrained one.
13. **How did you validate the pretrained one?** Four-input probe: 0.0008 benign, 0.0197 mild, 0.9859 suppression, 0.9945 explicit ideation.
14. **What if a model has an untrained head?** It happened twice — crisis constant 0.465, sentiment constant 0.338. `sentiment.py` now refuses to boot if `id2label` is still `LABEL_0/1/…`.
15. **Per-user models — cold start?** `population_fallback`, and the response says so. JITAI needs ≥5 responses, cycle LSTM ≥2 cycles.
16. **Model drift monitoring?** None. Production gap, documented.
17. **Evaluation metrics?** None that are clinically meaningful, because the training data is synthetic. Publishing an AUC here would be dishonest.
18. **Why is the recovery score not a model?** Because we can compute it exactly. A model would be theatre and unexplainable at the bedside.

## A2 · Architecture (16)

19. **Why five services?** Python owns ML, Node owns auth/encryption/orchestration, and neither language fights the other's ecosystem.
20. **Why Firestore as the bus?** Alerts must reach the clinician without polling. `onSnapshot` gives that free.
21. **Cost of that choice?** Two write paths to reason about, and the dashboard reads Firestore directly — so backend authorization isn't sufficient in production.
22. **Why one axios client for AI calls?** So no route can invent a URL or timeout. One boundary, one retry policy.
23. **What if the AI service dies?** Every call has a timeout and a labelled fallback. Chat degrades to `fallback_*`; the check-in still saves.
24. **What if the backend dies?** Mobile queues on genuine transport failure only; HTTP 5xx returns `{success:false}` rather than a false "Saved Offline".
25. **Can you scale to two backend replicas?** Not today — cron runs in the API process, so every job duplicates. Needs a leader lock or worker tier.
26. **Two AI replicas?** Worse — per-user models are on local disk, so half the requests silently fall back. Needs object storage.
27. **What breaks first under load?** `GET /outcomes/cohort/all`: sequential per-patient recompute that *writes* during a GET, plus an unbounded scan in `populationMeanDelta()`.
28. **Why no composite indexes?** Deliberate demo-scale tradeoff — the indexed thread query 500'd in rehearsal. Breaks past one page.
29. **Why is `computeOutcomes` idempotent?** Deterministic doc ids `{uid}_{jitaiLogId}`, so a late check-in is picked up on the next pass without duplicating.
30. **Where's your retry strategy?** The model chain *is* the retry. OpenAI SDK created with `max_retries=0` — with defaults a 25s budget measured 80s wall time.
31. **Why does the scheduler call the same selector as the API?** So the safety floors cannot be bypassed by a caller that forgets them.
32. **Design patterns used?** Facade (`aiClient`), strategy (model chain), template (shared `processBiometricSync` for two ingest paths).
33. **Biggest architectural regret?** Cron inside the API process.
34. **How would Google build this?** Pub/Sub between backend and inference, models in a registry behind an autoscaled serving tier, schedulers as Cloud Scheduler jobs.

## A3 · Backend / Node (10)

35. **Why fail fast on missing config?** A server that boots and 500s on every encrypted write is worse than one that refuses to start.
36. **Why log no bodies?** Journals and chat are PHI. Method, path, status, ms only.
37. **How is IDOR prevented?** `requireSelfOrAssignedClinician` — caller must be the patient or their assigned clinician.
38. **Rate limiting?** `nlpLimiter` on the expensive NLP path, `generalLimiter` elsewhere.
39. **Why is `/google-health/callback` unauthenticated?** Google redirects a browser there. Protected by an HMAC-signed 10-minute `state`.
40. **What's in `moodRoutes` step 9?** Non-blocking outcome recompute. A check-in must never fail because bookkeeping did.
41. **Why parallel NLP calls?** Three independent models; `Promise.allSettled` so one failure doesn't lose the other two.
42. **Why 45s timeout on mood log?** Measured worst case through the chain. The 8s global default used to time out into a silent offline queue.
43. **Error handling weakness?** Three handlers return raw `error.message` to the client. Minor information disclosure.
44. **Idempotency anywhere else?** `recoveryPlans`, `recoveryScores`, `cycleDayLogs` — all date-keyed, because users double-tap.

## A4 · Frontend / React Native (8)

45. **Why derive `BASE_URL`?** A hardcoded IP with a one-digit typo broke every request, and `postData()` reported it as "Saved Offline". Now probes `/api/health`.
46. **Offline strategy?** AsyncStorage queue, transport failures only.
47. **Why 60s chat timeout?** LLM latency. At 8s the user only ever saw the offline line.
48. **Why is the crisis screen full-screen?** A modal can be dismissed by accident. Crisis navigation is a route, not an overlay.
49. **Why is cycle tracking opt-in?** `tracksCycle()` reads `gender` + `tracksCycle`, both asked at onboarding, never inferred.
50. **How does the dashboard stay live?** `onSnapshot`; `useAlerts` fires a browser Notification for newly-added unresolved alerts, skipping the initial snapshot.
51. **Accessibility?** Labels on interactive elements; SVG ring has `role="img"` + aria-label. No full audit — gap.
52. **Why show components beside the recovery score?** A composite that hides its drivers is clinically unusable.

## A5 · Database (8)

53. **Why 15 collections?** One per bounded concept; joins happen in the backend.
54. **How do you avoid N+1?** Mostly we don't — `cohort/all` is N+1 by construction. Fine at demo scale, documented.
55. **Security rules?** Not specified in the project. Real production gap given direct dashboard reads.
56. **What's encrypted?** `moodLogs.journalText`, chat messages, Google refresh tokens — AES-256-GCM.
57. **Key rotation?** Single `ENCRYPTION_KEY`, no KMS, no rotation. Gap.
58. **Why must alerts carry `clinicianUid`?** The dashboard filters on it. Escalation alerts were invisible until this was fixed.
59. **What breaks if `interventionOutcomes` is dropped?** The learning engine — it's the only record pairing action to result.
60. **Retention / deletion?** `/auth/delete-account` and `/export-data` exist. No formal policy. Gap.

## A6 · Security & privacy (10)

61. **Where does patient data go?** Encrypted at rest in Firestore — **but chat text goes to NVIDIA's hosted LLM in plaintext.** Production blocker, documented.
62. **Why is the clinician summary safe then?** It's built from structured aggregates only — never raw journal or chat text. The right pattern, applied there and not in chat.
63. **HIPAA / DPDP compliant?** No. No BAA, no DPA, no residency guarantee, no consent flow. Prototype.
64. **Is this a medical device?** Clinical decision support — SaMD-adjacent. No regulatory classification yet.
65. **Threat model?** IDOR (mitigated), PHI egress (open), forged OAuth callback (mitigated by HMAC state), secrets in repo (mitigated — `.env*` ignored after a live-key backup was caught).
66. **Auth mechanism?** Firebase `verifyIdToken` server-side. No custom JWT signing.
67. **Can a clinician read any patient?** Only assigned ones.
68. **What about the LLM leaking advice?** `is_dosing_question()` before the model, `apply_output_guardrail()` after.
69. **Why deterministic and not prompt-based?** We probed both models raw with guardrails bypassed. Both gave a sertraline dose.
70. **Worst security issue?** PHI egress to an unBAA'd vendor. Naming it first is the honest answer.

## A7 · Clinical (16)

71. **What is residual symptom detection?** PHQ-9 items ≥2 while total <10 — the strongest relapse predictor, invisible to a total score.
72. **Why threshold 2?** "More than half the days" on the instrument itself. Not a threshold we chose.
73. **Why total <10?** Above that they're active symptoms, not residual.
74. **Item-level answers missing?** API returns `itemsAvailable: false`. Absence of data is never rendered as a negative finding.
75. **What's a plateau?** OLS slope between −0.5 and +0.5/week without remission or 50% response. Flag: *"Incomplete symptom alleviation — engaged but not improving."*
76. **Why OLS on so few points?** With n this small a linear slope is the only defensible summary; anything fancier implies precision the data lacks.
77. **Recovery score vs risk score?** Risk is predictive P(deterioration), rises when worse. Recovery is retrospective arithmetic vs the patient's own baseline. **Live: risk 88 / recovery 36.**
78. **Why do they disagree?** He's engaging (57%) with mood improving while PHQ-9 worsens. The disagreement is the clinical finding.
79. **Why is GAD-7 excluded from the composite?** The problem statement is depression. Anxiety dilutes the primary signal. Collected and shown separately.
80. **Treatment response definition?** ≥50% PHQ-9 reduction. Remission <5. Standard, not invented.
81. **What happens on PHQ-9 item 9?** Any non-zero value creates a clinician alert regardless of total.
82. **What happens after a crisis alert?** Patient gets full-screen helplines immediately; clinician gets a live alert. **No guaranteed human recipient — no on-call, no acknowledgement timeout.** Top production gap.
83. **Isn't that dangerous?** Yes, which is why we say it rather than imply a duty of care we can't fulfil today.
84. **Would a psychiatrist trust the divergence signal?** As a flag to look closer, yes. As a diagnosis, no — and we don't present it as one.
85. **Who writes the recovery plan?** Generated from residual symptoms and measured effect. A clinician cannot yet edit or approve it. Gap.
86. **Only two interventions?** Correct, and our biggest product gap. A loop over two actions learns slowly.

## A8 · Product & business (10)

87. **Why would a patient use this daily?** It gives something back — a score with components and a three-item plan. Most apps only take.
88. **Why only three goals?** A depressed patient handed twelve completes none, and an uncompleted plan is more evidence of failure.
89. **Who is the buyer?** Not specified in the project.
90. **What's the moat?** The loop is copyable arithmetic. Durable assets: the accumulating outcome dataset, and the measured regional-language safety pipeline.
91. **Why is Tamil a moat?** Wysa and Woebot haven't invested in Indian regional-language crisis detection. We measured 0.008 → 0.96.
92. **Differentiator vs Wysa/Woebot?** They measure engagement. We measure symptom change and refuse to report effects we can't support.
93. **What's the weakest part of the product?** Two deliverable interventions.
94. **Time to production?** 9–12 months with a compliance hire. Not 3.
95. **What would you build next?** Not more models — real training data, causal correction, and a bigger action space.
96. **Would you use this on a family member?** For between-visit monitoring with a clinician attached, yes. As a standalone crisis service, no — and the app never presents itself that way.

## A9 · Engineering process (8)

97. **How do you know the loop works?** `node scripts/verifyLoop.js` — 44 assertions on data it creates itself, through the real service functions. Offer to run it.
98. **Test coverage?** That script only. No unit tests, no CI. Gap.
99. **Biggest bug you found?** Engagement was written to `responseType` and read from `userResponse`, so the loop measured only seeded data and reported 0% for every real user.
100. **How did it survive?** The seeder happened to write the field the reader wanted. A demo that passes on seeded data and fails live is the worst failure mode we have — now a named regression test.
101. **Second biggest?** Two models with untrained heads returning constants.
102. **Third?** Divergence compared mood-negativity against language-*positivity* — inverted, peaking for the most consistent patients.
103. **What's still broken?** Nothing known and unfixed at demo scale. Production blockers are listed, not hidden.
104. **How do you prevent regression?** Every join that has broken before has a named assertion in `verifyLoop.js`.

---

# §B · Communication drills

**Every answer: claim → evidence → limitation.** The limitation is what makes the
claim credible. Three worked examples:

### "What does Niranthara do?"

**30s.** *"A depressed patient sees a clinician about an hour a year. We monitor
the other 8,759 — check-ins, journals, wearables — predict who's deteriorating,
act on it, and then measure whether acting helped. That last part is what nobody
builds."*

**1 min.** Add: *"Each intervention is paired with what happened next — engagement,
mood change, PHQ-9 change — and that measurement chooses the next intervention.
When evidence is thin we print 'insufficient' instead of inventing a number."*

**2 min.** Add the clinical payoff: *"The clinician sees not just who's at risk,
but who's engaged, adherent, and still not improving — the patient a risk-only
system never surfaces. That's the exact phrase in the problem statement, and we
produce it from data."*

### "Is your AI real?"

**30s.** *"Type into the app and watch. The crisis classifier scores 0.0008 on
'the sky is blue' and 0.9945 on explicit ideation. That's live inference, not
keyword matching."*
**1 min.** Add the guardrail: probed raw, both LLMs gave a sertraline dose; through
the app it returns `guardrail_input`.
**2 min.** Add the honesty: risk model is synthetic-trained; the outcome loop is not.

### "Why should we trust the numbers?"

**30s.** *"Because most of them refuse to appear. Below four observations we print
'insufficient' rather than an effect size."*
**1 min.** Add shrinkage formula and the two floors.
**2 min.** Add: *"And every recommendation stores why it was chosen — you can audit
any decision after the fact."*

**Kill:** "basically", "kind of", "we just", "very accurate", "AI-powered", "we tried".
**Use:** "measured", "we verified", "the trade-off was", "the failure mode is".

---

# §C · The 8-minute demo

**Pre-flight (T−30 min).** Restart backend (Node does **not** hot-reload) · confirm
:8000 and :5000 health · `node scripts/verifyData.js` · Metro shows
`[api] backend reachable at…` · dashboard logged in on `demo_patient_karthik_004`
· phone at full brightness, notifications on, **Firebase console closed**.

| Time | Screen | Say | Don't say |
|---|---|---|---|
| **0:00** | Dashboard caseload | *"A patient sees a clinician about an hour a year. The other 8,759 are invisible."* | Don't open with the stack |
| **0:45** | Chat | Type ideation → alert lands. *"Live classifier, not a keyword list."* | Don't call it "our AI" |
| **1:45** | Chat | Tanglish → then sertraline question → instant deferral. *"The prompt doesn't make it safe. That check does."* | Don't linger — 90s hard stop |
| **3:00** | Journal, **mood 5/5** | Bleak text → Save → **stop talking** → alert → SHAP. *"She said fine. Her language didn't."* | Don't narrate over the silence |
| **4:00** | — | **Unprompted:** *"Before you ask — the risk model is synthetic-trained. Here's what isn't."* | Never "clinically validated" |
| **4:30** | Recovery panel | Ring 36 beside risk 88. Components. Three × `not reported`. Then the flag. | Don't apologise for "insufficient" |
| **6:15** | Next-intervention card | *"Crisis probability overrode the learned preference. It chose grounding, and recorded why."* | Don't explain Thompson sampling |
| **7:00** | Alerts | Loss-of-follow-up alert → Generate Summary → Resolve | Don't open Firestore |
| **7:40** | — | *"Chatbots talk. Dashboards display. Niranthara closes the loop — and measures whether closing it helped."* | Don't add a feature list |

**Expected interruptions and where to jump.**

| Interruption | Jump to | One-liner |
|---|---|---|
| "Is this real data?" | Chat, type live | "History is seeded. Every inference is live — watch." |
| "What trained the model?" | stay | The §0 line, then continue |
| "Why does it say insufficient?" | Effectiveness table | "n = 2, 3, 2." |
| "Is that just inverted risk?" | Components | "88 and 36. Engagement 57%, mood up, PHQ-9 down." |
| "Does it work in Tamil?" | Chat | Type the Tanglish line |

**Failure recovery.**

| Fails | Do |
|---|---|
| Crisis doesn't fire | Long-press **Sync Biometrics** — deterministic crisis through the real pipeline |
| Chat returns `fallback_*` | Narrate it: *"Chain bottomed out — the patient still gets a reply. That's the design."* |
| Phone can't reach backend | Switch to dashboard-only; the loop story doesn't need the phone |
| Dashboard blank | `node scripts/verifyData.js` on the projector — it's honest and it's evidence |
| Everything fails | Run `verifyLoop.js` live. 44 assertions passing is a better demo than most working apps |

---

# §D · Winning strategy

## Top strengths (10 that matter — the other 10 are noise)

1. `verifyLoop.js` 44/44, runnable in front of them
2. Refuses to report effects below n=4
3. Two safety floors, architecturally enforced, visible on screen
4. Divergence — a genuinely original clinical signal, now correctly signed
5. Tanglish crisis 0.008 → 0.96, measured
6. Deterministic dosing guardrail with proof the prompt alone fails
7. Recovery 36 vs risk 88 — live proof it isn't inverted risk
8. Item-level residual symptoms
9. Every decision auditable (`selectionMode` + `selectionRationale`)
10. They wrote their own honesty audit — hand it over

## Top weaknesses (own them before they're found)

1. Risk/dropout trained on synthetic data
2. Chat text leaves to NVIDIA in plaintext
3. No guaranteed human response to a crisis alert
4. Two deliverable interventions
5. Effectiveness confounded by self-selection
6. Cron in API process / models on local disk — can't scale
7. No Firestore security rules
8. No CI, one test script
9. Everything reads `insufficient`
10. No regulatory or payer strategy

## Judge traps

1. "So it's clinically validated?" — **No.** Never accept the premise.
2. "Your accuracy?" — refuse the number; explain why it would be meaningless.
3. "Isn't this just ChatGPT with a dashboard?" — the loop, and the two floors.
4. "Can it scale?" — name the exact two blockers.
5. "What's your moat?" — concede the loop is copyable; pivot to the data and the language pipeline.

## Things never to say

"Clinically validated" · "highly accurate" · "it scales" · "AI-powered" ·
"we predict depression" · "HIPAA compliant" · "our model learns from patients" ·
"basically" · "we just" · "it's very simple"

## Verdict

**Confidence: 8.5 / 10.** Finals: **yes, very likely.** Win: **realistic, not
assured** — it depends almost entirely on whether the synthetic-data disclosure is
delivered by you at minute 4 or extracted by a judge at minute 7.

- **9.5** if §0 is rehearsed and one mobile dry-run is done.
- **6.5** if a judge surfaces the training data first.

**What must change before presenting:** nothing in the code. Rehearse the
synthetic-data line until it's boring, run the mood-5/5 journal beat once on a
real device, and restart the backend before you walk up.
