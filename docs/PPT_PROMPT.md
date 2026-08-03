# Hackathon PPT Generation Prompt

Copy everything inside the block below into your slide generator (Gamma, Canva Magic Design, Copilot in PowerPoint, or ChatGPT/Claude + a PPT tool). It contains all real project facts — the generator should invent nothing.

---

```
Create a 16-slide hackathon presentation deck for NIRANTHARA, an AI mental-health
continuity platform built by Team Niranthara, Anna University Regional Campus,
Tirunelveli.

SLIDE TITLES — render BOTH lines on every slide.
Line 1 is the section label: small, uppercase, letter-spaced, warm-gray #8A8076,
in the sans face. It is the functional name a judge scans for.
Line 2 is the headline: large, serif, charcoal. It is the argument.
The bold, highlighted, dominant line is **line 1's subject rendered at title
weight** only where noted; otherwise line 2 carries the visual weight.

| Section label (line 1) | Headline (line 2) |
|---|---|
| **PROJECT SUMMARY** | Why Niranthara Exists |
| **PROBLEM STATEMENT** | The 8,759-Hour Healthcare Gap |
| **EXISTING SOLUTIONS** | Why Today's Mental Health Apps Fail |
| **PROPOSED SOLUTION** | Closing the Gap Between Appointments |
| **ARCHITECTURE** | Engineering the Continuity Platform |
| **FEATURES** | Intelligence Behind Every Interaction |
| **AI MODELS** | The AI That Makes Clinical Decisions |
| **DEMO** | Niranthara in Action |
| **IMPACT** | From Monitoring to Meaningful Intervention |
| **FUTURE SCOPE** | Where Niranthara Goes Next |
| **THANK YOU** | Every Hour Matters |

Why both: the label lets a judge locate themselves in a 16-slide deck at a
glance; the headline makes an argument they remember. A deck with only labels is
a table of contents, and one with only headlines is a poem nobody can navigate.

DESIGN LANGUAGE (strict):
- Palette: warm cream background #FBF7F2 (never pure white), charcoal text #2C2826,
  rose accent #C97B84 (dark #8B4A52), lavender #9B8EC4, sage #7BA68A,
  terracotta #E8634A reserved ONLY for crisis/risk elements.
- Typography: elegant serif (Cormorant Garamond or similar) for titles,
  clean humanist sans (DM Sans or similar) for body. Generous whitespace.
- NO emojis anywhere. NO stock-photo clip art. NO purple gradients.
  Feel: premium calm wellness brand meets medical instrument, not a hospital app.
- Diagrams as clean line schematics in the palette colors.
- Numbers always large and tabular. Max 5 bullet lines per slide.

SLIDE 1 — TITLE
"NIRANTHARA — The AI Mental Health Continuity Platform"
Tagline: "A psychiatrist sees a patient one hour a month. We make the other
729 hours visible." Team name, institution, hackathon name.

SLIDE 2 — PROBLEM STATEMENT
The official problem: "How might we utilize AI chatbots and machine learning to
address incomplete alleviation of depression symptoms, attrition, and loss of
follow-up in mental health treatment?"
Four stat callouts: 50-70% of patients on first-line antidepressants do not reach
remission; 20-60% of outpatients drop out of therapy silently between sessions;
a clinician observes ~1 of every 730 hours of a patient's month; relapse hits 50%
after one episode, 80%+ after two.

SLIDE 3 — THE INSIGHT
"Treatment fails in the gaps between appointments, not in the appointments."
Contrast: chatbots talk, dashboards display — nobody closes the loop.
Introduce the loop diagram: passive detection → ML risk prediction →
just-in-time intervention → clinician escalation → follow-up recapture.

SLIDE 4 — SOLUTION OVERVIEW
One diagram, three surfaces: any smartwatch (cloud via the Google Health API, or
on-device via Health Connect) → patient mobile app (React Native) → Node backend
→ FastAPI AI service (10 ML systems) → NVIDIA cloud LLMs → Firebase Firestore →
clinician web dashboard updating in under 1 second (onSnapshot). Caption:
"Clinical decisions come from trained models; the only hardcoded rules are the
two deterministic safety floors, and we label them as such."

SLIDE 4b — THE LOOP NOBODY ELSE CLOSES  ← the differentiating slide, do not cut
Every competitor stops at detection. Draw the closed circle:
  intervention delivered → engagement → proximal mood delta (next check-in vs the
  prior three, 72h) → distal PHQ-9 delta → per-patient effectiveness → chooses
  the next intervention.
Three numbers on this slide and nothing else:
  · effectiveness is a SHRUNK mean — (n·patient + 3·population)/(n+3) — and we
    print "insufficient evidence" below n=4 rather than an effect size
  · a PHQ-9 OLS slope that flags PLATEAU: "engaged, adherent, not improving" —
    the problem statement's own words, produced from data
  · residual symptoms at PHQ-9 ITEM level (items ≥2 while the total is <10),
    invisible to any total-score system
Closing line: "Chatbots talk. Dashboards display. We measure whether it helped."

SLIDE 5 — PATIENT APP FEATURES
AI companion chat with multi-turn memory, context-injected with live mood/cycle/
risk state; PHQ-9 and GAD-7 validated assessments (one question per screen,
item-9 self-harm protocol auto-alerts the clinician); encrypted journaling with
mood-language divergence detection (masked depression); crisis support screen
with tap-to-call Tele-MANAS 14416, grounding, breathing; JITAI intervention
cards timed by a per-user receptivity model; offline-first.

SLIDE 6 — WEARABLE INTELLIGENCE (DEVICE-AGNOSTIC)
Demo hardware: Fitbit Charge 6 → Google Health → **Google Health API (cloud,
OAuth)** → our adapter. Verified live on 2 Aug 2026 reading a real Charge 6:
HR 87, resting 76, HRV 58ms, sleep 8.4h. Two ingest paths share ONE pipeline —
the cloud path (works anywhere, no native module) and on-device Health Connect
(needs a dev build; returns simulated data in Expo Go). Key line: "We integrate
the platform, not the vendor — Samsung, Pixel, any wearable is the same code
path." Mention the deduplication if asked: three sources write steps (watch,
phone tracker, aggregator) and summing them triple-counts, so we take the
wearable only. Multi-signal physiological stress score
(HR 30% / HRV 35% / steps 20% / sleep 15%) against PERSONAL baselines, absent
signals excluded not zeroed, and stress alerts require 2+ corroborating signals —
climbing stairs never pages a psychiatrist.

SLIDE 7 — THE TEN ML SYSTEMS
Table: crisis detection (sentinet/suicidality — an ELECTRA classifier, NOT
MentalRoBERTa, which we replaced after finding it returned a constant for every
input), sentiment incl. Tamil/Tanglish (cardiffnlp XLM-R), emotion
(DistilRoBERTa), 15-feature risk fusion (XGBoost + SHAP explainability),
attrition/dropout prediction (XGBoost), cycle vulnerability forecasting
(per-user PyTorch LSTM), behavioral anomaly detection (per-user LSTM
autoencoder), JITAI receptivity (per-user XGBoost), guarded LLM chat, and
**outcome learning — shrunk per-intervention effectiveness + PHQ-9 OLS
trajectory, the only one whose inputs are real measured patient data**.
Highlight: three are trained PER PATIENT, and one measures whether any of the
other nine changed anything.

SLIDE 8 — THE LLM CHAIN AND SAFETY
Latency-first chain: Llama 3.1 8B primary (~1.3s measured) → Nemotron-3 Super
120B backstop (~4.5s) → labeled static fallback; clinical summaries run the chain
in reverse for quality. (Minimax M2.7 was the backstop until it returned HTTP 410
Gone — model IDs expire, so the chain IS the resilience strategy.) Two
deterministic guardrail tiers: dosing questions
deferred BEFORE the LLM runs; dosing advice blocked in outputs. Every chat
message passes the crisis classifier before generation. Line: "This assistant
never plays doctor."

SLIDE 9 — CLINICIAN COMMAND CENTER
Live triaged caseload sorted by risk; alerts land in under 1 second with browser
notifications even when the tab is backgrounded; SHAP "why this score" panel;
PHQ-9/GAD-7 trajectory charts; AI clinical summary — 30 days of structured
signals in 5 clinical sentences, raw journal text never leaves encryption;
a 15-minute cron guarantees loss-of-follow-up alerts: "nobody silently exits care."

SLIDE 10 — LIVE DEMO
Placeholder slide shown during the live demo. Title: "The 729 hours, live."
Sub-bullets as cue card: watch sync → PHQ-9 lands on dashboard → concerning
journal → alert on projector in ~1s → SHAP explanation → guardrail stunt →
crisis screen → AI summary → resolve.

SLIDE 11 — ARCHITECTURE AND ENGINEERING QUALITY
Clean architecture schematic (5 services). Proof points: field-level AES-256-GCM
encryption before the database; IDOR-proof authorization middleware; single AI
boundary module; fail-fast config; graceful degradation at every layer (the app
never blocks on a model); 30 automated end-to-end checks passing; measured:
mood-to-alert 1.2s, chat 2-8s, guardrail 0.2s.

SLIDE 12 — PROTOTYPE BUDGET (₹15,000)
Table totaling ₹15,000:
- Wearable device (Fitbit Charge 6, prototype sensor): ₹8,500
- Cloud and API costs for development + demo (Firebase Blaze headroom, NVIDIA
  API usage, misc hosting): ₹1,500
- Android test device provisioning / accessories (cables, hotspot data,
  SD storage): ₹2,000
- Demo hardware (HDMI capture/adapter, presenter remote, backup battery): ₹1,500
- Printing, poster, and presentation materials: ₹1,000
- Contingency: ₹500
Footnote: "All software is open-source or free tier — the budget buys sensing
hardware and demo reliability, not licenses."

SLIDE 13 — HONEST LIMITS AND ROADMAP
Left (today, said plainly): **risk and dropout models are trained on 600 rows of
SYNTHETIC data — they demonstrate the pipeline, not clinical accuracy**; effect
estimates are associational, not causal (patients who complete an exercise differ
from those who don't); crisis alerts have no guaranteed human recipient yet; chat
text reaches the LLM vendor in plaintext; single-host demo scale; no clinical
validation claimed. State the synthetic-data limit OUT LOUD before a judge asks —
volunteered it earns credit, extracted it costs the whole deck. Right (the path): the system
self-labels in production (JITAI engagement, 21-day dropout labels, PHQ-9
anchors); V1 = consent + audit + pilot with a partner clinic; V2 = PostgreSQL/
TimescaleDB, HealthKit, FHIR, multi-tenancy; V3 = teleconsult, federated
learning. Line: "Sophistication about our own limitations is the strategy."

SLIDE 14 — IMPACT AND MARKET
India: ~200M people with mental disorders, <1 psychiatrist per 100,000; Tele-MANAS
built national crisis infrastructure with no continuity layer — Niranthara is the
missing follow-up limb. B2B2C model: per-patient-per-month licensing to clinics,
campus counseling centers as beachhead. Moat: the outcome-labeled longitudinal
dataset the feedback loop generates.

SLIDE 15 — TEAM AND ASK
Team Niranthara, Anna University Regional Campus, Tirunelveli. The ask: pilot
partnership with one psychiatry clinic or campus counseling center.

SLIDE 16 — CLOSE
Full-bleed cream slide, serif type: "Chatbots talk. Dashboards display.
Niranthara closes the loop." Below, small: helplines Tele-MANAS 14416 · iCall
9152987821 — and the disclaimer: "Niranthara augments clinicians. It never
diagnoses, prescribes, or replaces care."

SPEAKER NOTES: for every slide, write 3-4 sentences of natural spoken narration
matching the calm, confident, clinically-serious tone. Never overclaim: say
"prototype", "measured in rehearsal", "roadmap" where applicable.
```

---

**Usage tips:** generate at 16:9; if the tool supports theme locking, set background `#FBF7F2` and heading color `#2C2826` globally first, then generate. Replace Slide 12 numbers if your actual spend differs — the ₹15,000 total and "hardware not licenses" story is the part judges remember. Slides 10's cue card should match DEMO_RUNBOOK.md §3 exactly.
