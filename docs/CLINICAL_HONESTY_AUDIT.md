# Niranthara — Final Clinical Honesty Audit
**2 August 2026.** Every claim checked against running code, not against intent.

The rule applied throughout: *would a psychiatrist believe this, and can we show
the evidence live?* Where the answer was no, the claim is reduced here rather
than defended.

---

## 0 · The finding that matters most

**The XGBoost risk model is trained on 600 rows of synthetic data.**
`ai-service/models/model_trainer.py:39` — `generate_synthetic_dataset(n=600)`,
`np.random.seed(42)`, features drawn from `np.random.normal()` around hand-set
per-class means. The behavioural-anomaly autoencoder also augments with
`_generate_synthetic_history()` when real data is thin.

**What this means, stated precisely:** any accuracy or AUC this model reports
measures whether XGBoost can recover the generative rules we wrote into the data.
It is **not** evidence of clinical performance. The architecture, the feature
pipeline, the SHAP explanations and the serving path are all real and working —
the training corpus is not.

One specific consequence worth knowing before a judge finds it:
`mood_sentiment_divergence` is generated with class-increasing means
`[0.05, 0.15, 0.3, 0.45]`. So the model "learned" that divergence predicts risk
**because we encoded that assumption**, not because data showed it. Divergence is
still a real measurement at inference time — but its weight in the risk score is
an assumption, not a finding.

**Required demo answer, rehearse it verbatim:**
> *"The risk model is trained on synthetic data — 600 generated rows. It
> demonstrates the pipeline, not clinical accuracy, and we won't claim otherwise.
> What IS measured on real data is the outcome loop: engagement, mood deltas,
> PHQ-9 trajectory. That's the part we're asking you to judge."*

This distinction is the difference between a defensible project and an
embarrassing one. Do not blur it.

---

## 1 · Does every feature serve the problem statement?

| Feature | Clause served | Verdict |
|---|---|---|
| Crisis detection | safety (enabler, not a clause) | keep — prerequisite |
| Sentiment + divergence | incomplete alleviation | keep |
| PHQ-9 / GAD-7 | incomplete alleviation | keep |
| PHQ-9 trajectory + plateau flag | **incomplete alleviation** | keep — core |
| Residual symptoms (item-level) | **incomplete alleviation** | keep — core |
| Intervention effectiveness | **incomplete alleviation** | keep — core |
| Dropout prediction | attrition | keep |
| Engagement rate | attrition | keep |
| `engagement_floor` de-escalation | **attrition** | keep — core |
| Escalation cron / `daysSinceContact` | **loss of follow-up** | keep — core |
| Recovery plan + goals | all three | keep |
| Adaptive selection | incomplete alleviation | keep |
| Chatbot | none directly | **keep, demoted** — it is an access ramp and a crisis surface, not the product |
| Cycle LSTM | none of the three | **keep, opt-in only** — personalisation, not a clause. Roadmap-flagged |
| Biometric anomaly | attrition (weak) | keep — passive signal when self-report stops |

**Nothing removed.** Two demoted in the narrative: the chatbot and the cycle
model are supporting features, and the pitch must not lead with either.

## 2 · Would a psychiatrist believe the claims?

| Claim | Verdict | Reduced to |
|---|---|---|
| "We detect crisis language" | believable | verified 0.0008 / 0.9945 |
| "We measure whether interventions helped" | believable | proximal mood delta, **confounded** — stated below |
| "We predict deterioration risk" | **not as stated** | "we run a risk model whose training data is synthetic" |
| "Recovery score measures recovery" | believable | it is labelled deterministic arithmetic, not a model |
| "We detect residual symptoms" | believable | standard definition, PHQ-9 items ≥2 with total <10 |
| "Tamil/Tanglish supported" | **partly** | explicit ideation yes; non-explicit Tanglish hopelessness can be missed |
| "Adaptive learning" | believable | bounded exploration, floors, `insufficient` below n=4 |

**The confounding disclosure.** Proximal mood delta compares the next check-in to
the prior three. A patient who completes an intervention differs systematically
from one who ignores it — the effect estimate is associational, not causal. The
shrinkage and the `insufficient` label limit over-claiming; they do not remove
confounding. Say this before a judge says it.

## 3 · "How do you know?" — can we show it live?

| Number on screen | Live evidence available |
|---|---|
| Crisis probability | type the sentence, watch the score |
| Divergence | mood slider + journal, recomputed on save |
| Effectiveness / `insufficient` | `GET /api/outcomes/:uid`, and the table states n |
| Recovery score | components rendered beside the total, always |
| Trajectory / plateau | `POST /api/outcome/trajectory` on the PHQ-9 series |
| Selection rationale | `selectionMode` + `selectionRationale` on every `jitaiLogs` doc |
| Whole loop | `node scripts/verifyLoop.js` — 44 assertions, in front of them |

`verifyLoop.js` is the strongest answer available: it creates its own patient,
asserts through the real service functions, and fails loudly. Offer to run it.

## 4 · Demonstrable live?

**Yes:** crisis, Tamil, divergence, risk+SHAP, alerts, escalation cron, outcome
table, recovery score, plan, adaptive selection, clinician summary, PDF export.

**No — moved to roadmap:** Google Health OAuth (credentials unset), Web Push to a
closed browser, real Fitbit ingestion, medication adherence tracking.

## 5 · Does every prediction lead to an action?

| Prediction | Action |
|---|---|
| Crisis probability | full-screen CrisisSupport + `clinicianAlerts` + grounding floor |
| Risk score | alert >0.60, `topFactors` on dashboard, JITAI eligibility |
| Dropout probability | `dropout_risk` alert, feeds `engagement_floor` |
| Receptivity | whether to send now |
| Effectiveness | which intervention next |
| Trajectory | plateau flag → treatment-review prompt |
| Residual symptoms | specific daily goals (sleep item → sleep goal) |
| Biometric anomaly | ≥2-signal alert + risk re-score |

**No orphan predictions.** Every model output terminates in a patient action, a
clinician action, or a recorded outcome.

## 6 · Intervention → outcome → learning, verified

```
delivered      jitaiLogs {selectionMode, selectionRationale}     ✓
patient act    /jitai/log-response → responseType/openedByUser   ✓ (44-assertion guard)
outcome        interventionOutcomes {moodDelta, phqDelta}        ✓ idempotent
stored         Firestore, deterministic doc ids                  ✓
recommendation effectivenessFor() → perType → choose_intervention ✓ closed
```

All five stages present and asserted. This was **not** true 48 hours ago:
engagement was written to `responseType` and read from `userResponse`, so the
loop measured only seeded data and reported 0% engagement for every real user.

## 7 · Can every dashboard number be explained?

Every panel carries provenance. `getRecovery()` returns a `method` block stating,
per number, whether it is a model output or arithmetic — rendered, not hidden.
`estimatedEffect` prints "not reported" below n=4 rather than a figure.

**One gap closed today:** the panel re-sampled `adaptiveSelection` on every
request while the plan was persisted, so two contradictory recommendations could
appear side by side. Selection is now persisted with the plan.

## 8 · Recovery score components

**It is not 100 − risk.** `riskScore` is XGBoost P(deterioration), predictive,
rises when things worsen. `recoveryScore` is deterministic arithmetic over
observed history against the patient's own baseline, and is `null` — never 50 —
until history exists. The two are supposed to disagree.

Implemented components, all rendered with their arithmetic:

| Component | Weight | Source |
|---|---|---|
| Symptoms | 0.40 | PHQ-9 % reduction, anchored so 50% = 100 |
| Adherence | 0.20 | check-ins in last 14 days |
| Engagement | 0.20 | % of interventions engaged |
| Mood | 0.20 | last 7 days vs prior 7 |

Weights renormalise over present components only — a missing signal is never
scored zero.

**Two honest gaps against the requested spec:**
1. **GAD-7 is not a component.** Deliberate: the problem statement is depression,
   and folding an anxiety instrument into a depression-recovery composite dilutes
   the primary signal. GAD-7 is collected, stored, and displayed separately.
   One-line addition if you want it — but I'd defend the exclusion.
2. **Residual symptoms are not a component.** They are detected, displayed and
   drive goal selection, but do not enter the score. Correct as-is: residual
   symptoms are a *qualitative* flag; converting them to a weighted number would
   double-count the PHQ-9 total already in `symptoms`.

## 9 · Model cards

| Model | Purpose | Training labels | Evaluation | Confidence / fallback | Known failure |
|---|---|---|---|---|---|
| `sentinet/suicidality` | crisis | pretrained (external) | probed 4 inputs | probability; thresholds 0.50/0.75/0.85 | non-explicit Tanglish after translation |
| `cardiffnlp/twitter-xlm-roberta` | sentiment | pretrained (external) | probed 6 inputs | 3-class softmax; **refuses to start if head untrained** | romanised Tanglish weaker (errs negative — safe direction) |
| `j-hartmann/emotion-distilroberta` | emotion | pretrained (external) | not re-probed | confidence returned | English-only |
| **XGBoost risk** | deterioration | **synthetic, 600 rows** | **not clinically valid** | SHAP `topFactors`; `fallback` on error | **§0 — the headline caveat** |
| **XGBoost dropout** | attrition | synthetic | not clinically valid | defaults to 0.3 on failure | same caveat |
| Cycle LSTM | vulnerability | per-user history | none | `currentDay: 0` when no model | needs ≥2 cycles |
| Anomaly autoencoder | behaviour | per-user, synthetic-augmented | reconstruction error | ≥2-signal gate | cold start |
| JITAI receptivity | timing | user's own responses | none | `population_fallback` labelled | needs ≥5 responses |
| Effectiveness | which works | measured outcomes | n-based confidence | `insufficient` below n=4 | confounded (§2) |
| LLM chain | conversation | n/a (hosted) | latency-measured | `modelUsed` returned; static fallbacks | dosing → deterministic guardrail |

**No black boxes** — but two models are honest-labelled as pipeline
demonstrations rather than validated predictors.

## 10 · Two-minute explanation

> A patient sees a clinician one hour a year. We monitor the other 8,759 —
> check-ins, journals, wearables. We predict who's deteriorating and explain why.
> Then we do the part nobody builds: we act, and we measure whether acting
> helped. Each intervention is paired with what happened next — engagement, mood
> change, PHQ-9 change — and that measurement chooses the next intervention. When
> the evidence is thin we say so instead of inventing a number. The clinician
> sees not just who's at risk, but who's engaged, adherent, and still not
> improving — which is the exact patient a risk-only system never surfaces.

## 11 · Repository audit

| Check | Status |
|---|---|
| Shared constants centralised | ✓ one intervention vocabulary, both services |
| Duplicate endpoints | ✓ none — `choose_intervention` shared by API and scheduler |
| Duplicate models | ✓ crisis classification in one module |
| Naming consistent | ✓ normalised on read; legacy aliases mapped |
| Secrets ignored | ✓ **fixed today** — `.env.bak` held live keys and was untracked but not ignored; deleted, `.env*` now in `.gitignore` |
| Documentation updated | ✓ CLAUDE.md, MVP_COMPLETION, HANDOFF, this file |
| Demo script updated | ✓ corrected to mood 4–5/5 for the divergence beat |
| Production build | ✓ dashboard builds; both services boot; 44/44 |
| Dead code | ⚠ minor: `'accepted'` unreachable in `ENGAGED_STATES`; unused `text_for_model` assignment |
| Demo scaffolding | ⚠ long-press triggers in `Home.js` still present — intentional, remove after |

## 12 · Final verdict

| Dimension | Score | Remaining gap |
|---|---|---|
| Clinical Alignment | **9/10** | GAD-7 and residual symptoms excluded from the composite (both justified above, not accidental) |
| Technical Architecture | **8/10** | `GET /outcomes/cohort/all` writes to Firestore and fans out sequentially; no composite indexes (in-memory sort at demo scale) |
| AI Design | **8/10** | Non-explicit Tanglish hopelessness can be lost in translation; emotion model English-only |
| **ML Design** | **5/10** | **Risk and dropout models trained on synthetic data.** No held-out real evaluation, no calibration curve, no clinical validation. Effectiveness estimates confounded by self-selection |
| Continuity of Care | **9/10** | Loop closed and verified end-to-end; medication adherence not tracked |
| Demo Readiness | **8/10** | Mobile not verified end-to-end on a device by automation; recovery panel not visually verified in a logged-in session |
| Judge Defensibility | **8/10** | Strong **only if** the synthetic-training answer (§0) is rehearsed. Unrehearsed, this drops to 5 |

**Average 7.9/10.** The ML score is the honest one and should not be inflated —
it is also the least fixable before a hackathon, because the fix is real clinical
data.

### Gaps: implemented vs roadmap

**Implemented this session:** engagement join, intervention vocabulary, learning
loop closed, recovery engine, dashboard panel, mobile screen, verification
script, sentiment model replaced, divergence polarity corrected, adaptive
selection persisted, secrets secured, RL wording corrected.

**Explicitly roadmap, not claimed:** real-data model training and validation ·
causal correction for confounded outcomes · GAD-7 in the composite · survival
analysis · medication adherence · Google Health OAuth · Web Push · postpartum /
perimenopause subtyping with EPDS · Firestore composite indexes · automated
mobile E2E.

**MVP status: complete** — every gap above is either implemented or listed here
as roadmap. The system does not claim anything it cannot show, with one condition:
**§0 must be said out loud before a judge asks.**
