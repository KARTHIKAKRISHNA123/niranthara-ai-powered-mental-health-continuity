# Niranthara — Session Handoff
**Written 2 August 2026.** Paste §1 into a new chat to restore full context.
Everything below was measured against running code, not assumed.

---

# §1 · CONTEXT BLOCK — paste this into the next session

> I'm working on **Niranthara**, an AI mental-health *continuity* platform at
> `D:\Niranthara-AI-Powered-Mental-Health-Continuity-1`. Five services:
> `mobile-app/` (React Native, Expo SDK 54), `backend/` (Node 20 / Express 5, :5000),
> `ai-service/` (Python 3.11 / FastAPI, :8000), `dashboard/` (React 19 / Vite, :5173),
> Firestore as the integration bus. **Read `CLAUDE.md` first** — it holds every
> hard-won gotcha and is current as of 2 Aug 2026.
>
> **Problem statement:** *"How might we utilize AI chatbots and machine learning
> to address incomplete alleviation of depression symptoms, attrition, and loss
> of follow-up in mental health treatment?"* Submission: **Niral Thiruvizha 3.0**.
>
> **Current state: feature-complete and verified.** `node backend/scripts/verifyLoop.js`
> reports **44 passed, 0 failed**. Dashboard builds. Both services boot.
> The intervention→outcome→learning loop is closed and measured on real data.
>
> **The headline feature** is the outcome loop: every intervention is paired with
> engagement + proximal mood delta (72h) + distal PHQ-9 delta, shrunk toward the
> population mean `(n·user + 3·pop)/(n+3)`, reported as `insufficient` below n=4,
> feeding `choose_intervention()` behind two hard safety floors (crisis > 0.75 →
> grounding; engagement < 25% → checkin_nudge).
>
> **Three things I must disclose and never overclaim:**
> 1. Risk + dropout models are trained on **600 rows of synthetic data** — pipeline
>    demonstration, not clinical accuracy.
> 2. Crisis alerts have **no guaranteed human recipient** (no on-call, no ack timeout).
> 3. Chat text reaches the **NVIDIA LLM in plaintext** (journals are encrypted at rest).
>
> **Docs to read:** `docs/DEMO_RUNBOOK.md` (the one demo script),
> `docs/MASTER_KNOWLEDGE.md` (25-chapter technical bible),
> `docs/CLINICAL_HONESTY_AUDIT.md` (every claim vs evidence),
> `docs/FINAL_REVIEW_AND_PLAYBOOK.md` (104 judge questions),
> `docs/PPT_PROMPT.md` + `docs/PROJECT_REPORT_PROMPT.md` (deck/report generators).
>
> **Open items:** explainer + journey videos (see `docs/SESSION_HANDOFF.md` §4);
> slide-by-slide deck review; A4 one-pager; brochure; A1 poster.

---

# §2 · What changed on 2 August 2026

| Area | Change |
|---|---|
| **Google Health** | Now reads a **real Fitbit Charge 6**. Three stacked bugs fixed — see below |
| **Wearable windows** | Per-signal: HR = requested · steps = since local midnight · HRV = 36h · sleep = most recent night ≤48h |
| **Step dedup** | Three writers (`Charge 6`, `MobileTrack`, `HEALTH_CONNECT`) were summed; 129 real steps showed as 909. Now wearable-only |
| **CBT save** | `/jitai/log-response` used a two-equality + `orderBy` query → `FAILED_PRECONDITION` *after* writing. Record saved, user saw an error. Now in-memory |
| **Recovery screen** | `return` sat above `try`, so `finally` never cleared `loading` → infinite spinner. Guard moved inside; timeout 20s → 45s |
| **Home / Cycle** | Both now `useFocusEffect` — tab screens stay mounted, so Home was frozen at app-start values and disagreed with Cycle on the cycle day |
| **Home sleep tile** | Falls back to journal-reported sleep when no wearable sleep exists |
| **Home quick-nav** | Journal/Care/Cycle tiles removed (duplicated the tab bar). **Insights kept** — it has no tab, that tile is its only entry point |
| **Insights** | All five emojis removed; nudge uses a Feather icon in a tinted tile matching Home |
| **Onboarding** | Gender picker reduced to **female / male**. Data model still accepts `non_binary` / `prefer_not_to_say` so existing accounts keep cycle access |
| **Docs** | `CLAUDE.md` +10 gotchas · `PPT_PROMPT.md` (Slide 4b = the loop, ten ML systems, real wearable numbers, harder honesty slide, two-line titles) · `PROJECT_REPORT_PROMPT.md` (§5.7 outcome learning, §6.8 Recovery Engine, §7.5 verification) |
| **New scripts** | `backend/scripts/checkWearable.js` — pre-flight, compares **server uptime vs `.env` mtime** and reports REAL vs `simulation` |

**The Google Health root cause, in one place:** v4 data points have **no top-level
`startTime`** — each type nests its own — so the time filter returned HTTP 400
`INVALID_DATA_POINT_FILTER_RESTRICTION_COMPARABLE` on every request; a generic
numeric-leaf parser couldn't read `beatsPerMinute: "75"` (a **string**) or
`heartRateVariability.rootMeanSquareOfSuccessiveDifferencesMilliseconds`; and
`.catch(() => null)` made the 400 indistinguishable from "no data". Fixed by
removing the filter (window in JS), per-type `EXTRACTORS`, and logging failures.
**Verified live: HR 87 · resting 76 · HRV 58ms · steps 399 · sleep 8.4h.**

---

# §3 · Demo — yes, it is planned and final

**`docs/DEMO_RUNBOOK.md` is the single script.** One path, no branches, 190 lines.
Eight beats, exactly 8:00:

`0:00 gap · 0:40 wearable · 1:30 live crisis · 2:20 Tamil + guardrail ·
3:20 money shot · 4:15 synthetic-data disclosure · 4:40 the loop ·
6:20 safety floor · 7:00 continuity · 7:35 close`

**Accounts:** phone = `ananya.demo@niranthara.dev` · dashboard =
`meena.clinician@niranthara.dev` · Google consent = your own Google account.
The `demo_patient_*` accounts **cannot be logged into** (no Firebase Auth record).

**Three money shots:** mood **5/5** + bleak journal → divergence 0.929 ·
recovery 30 beside risk 0.975 with three × `not reported` · `SAFETY_FLOOR →
grounding` firing because of the journal you just wrote.

**Keep the dashboard tab open** — clinician toasts are `onSnapshot` + browser
`Notification`; the alert doc is written either way but the popup needs the tab.
**Patient push never fires** — nothing writes `users.fcmToken`.

---

# §4 · The two videos

Both can be shot from the same 8-minute demo. Do **not** write new material.

## Video A — Explainer (2:30–3:00)

This *is* the demo, tightened. Screen recording + voiceover, no face needed.

| Time | Content | Source |
|---|---|---|
| 0:00–0:20 | The gap: one hour a year, 8,759 unseen | Runbook beat 1 |
| 0:20–0:50 | Live crisis detection, typed on screen | Runbook beat 3 |
| 0:50–1:15 | Tamil → Sarvam → 0.008 becomes 0.96 | Runbook beat 4 |
| 1:15–1:50 | **Money shot:** mood 5/5 + bleak journal → alert | Runbook beat 5 |
| 1:50–2:30 | The loop: recovery 30 vs risk 0.975, `not reported`, plateau flag | Runbook beat 7 |
| 2:30–2:50 | Safety floor + the honesty line | Runbook beats 6, 8 |

**Rule:** say the synthetic-data disclosure **in the video too**. A judge who
watches the video and then hears it live twice trusts you more, not less.

## Video B — Journey (1:30–2:00)

Startup-style. Not features — the *story of finding the bugs*, which is your
most human material and nobody else can claim it.

Beat structure:
1. **The premise** — "we set out to detect deterioration"
2. **The turn** — "then we found our crisis classifier had never fired. It
   returned the same constant for every input, including 'I want to end my life'"
3. **The second turn** — "our sentiment model had the same defect. And our
   engagement metric read zero for every real user because two halves of the
   code disagreed on a field name"
4. **What it changed** — "we stopped trusting anything we hadn't probed. Every
   model gets four contrasting inputs. Every join has a regression test"
5. **Where we landed** — 44 assertions, and a system that says `insufficient`
   rather than inventing a number
6. **Close** — the one sentence

That arc is a genuine engineering-maturity story and it maps onto the video you
referenced (the founder-journey format). Do not dramatise it; the facts are
strong enough flat.

## Tools

| Need | Tool | Why |
|---|---|---|
| Screen capture (phone) | **scrcpy** (free) or Android Studio's screen record | Mirrors the device losslessly; scrcpy also lets you drive the phone from the laptop, so no hands in frame |
| Screen capture (desktop) | **OBS Studio** (free) | Scene switching between dashboard and mirrored phone in one take |
| Editing | **DaVinci Resolve** (free) | Colour + audio + timeline in one; overkill but no watermark and no subscription |
| Faster alternative | **CapCut Desktop** (free) | Auto-captions are genuinely good, which matters for judges watching muted |
| Voiceover | Phone earbuds in a quiet room, recorded separately | Never use laptop mic + room echo. Record VO *after* the screen capture and cut picture to voice |
| Captions | CapCut auto-caption, then hand-fix every clinical term | Auto-captions will mangle "PHQ-9", "Tanglish", "sertraline" |

**Production order that saves the most time:** write the VO script → record VO →
capture screen while listening to your own VO → cut picture to voice. Editing
picture-first to a script you haven't spoken is what makes demo videos drag.

**Two hard rules.** Record at the phone's native resolution, portrait, and don't
zoom in post — text goes soft and judges notice. And do a silent watch-through
before export: if it reads without sound, it survives a noisy hall.

---

# §5 · Everything worth referring to

| Doc | Use it for |
|---|---|
| `CLAUDE.md` | Every gotcha. Read before touching code |
| `docs/DEMO_RUNBOOK.md` | The demo. One script, hold it in your hand |
| `docs/MASTER_KNOWLEDGE.md` | 25 chapters — problem, architecture, APIs, DB, ML, flows, viva |
| `docs/CLINICAL_HONESTY_AUDIT.md` | Claim vs evidence; §0 is the synthetic-data wording |
| `docs/FINAL_REVIEW_AND_PLAYBOOK.md` | 104 judge questions, communication drills, verdict |
| `docs/MVP_COMPLETION.md` | Feature list, diagrams, schema, workflows |
| `docs/PPT_PROMPT.md` | Deck generator — current architecture, two-line titles |
| `docs/PROJECT_REPORT_PROMPT.md` | Report generator — chapter outline with honesty guards |
| `docs/REAL_WEARABLE_SETUP.md` | Google Health / Health Connect setup |
| `README.md` | Public-facing, rewritten and current |
| `Build_Guide.md` | Historical spec — **carries a correction banner**; §40 is the style source |

**Scripts:** `verifyLoop.js` (44 assertions) · `verifyData.js` (who has what data) ·
`checkWearable.js` (pre-flight) · `backfillAssessmentItems.js` · `seedInterventions.js` ·
`repairAndSeedDemo.js`

**Notion:** *Niranthara — Demo Day Reference Hub* — accounts, numbers, disclosures,
category rules, notifications, pre-flight.

---

# §6 · Still open

1. **Videos** — scripts above, not shot
2. **Slide-by-slide deck review** — deck must exist first
3. **A4 one-pager / brochure / A1 poster** — structures agreed, not produced; check print lead time
4. **Cycle data from Google Health** — probed, every menstruation data type returns **HTTP 400 invalid data type ID**. Not a scope or data problem; the types aren't in the v4 surface available. Roadmap with a documented reason
5. **Broader gender options** — roadmap; return them when they change what the product does
6. Production blockers (unchanged): PHI egress to NVIDIA · no guaranteed crisis recipient · synthetic training data · cron in API process · models on local disk · no Firestore rules
