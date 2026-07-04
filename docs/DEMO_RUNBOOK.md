# NIRANTHARA — MVP Demo Runbook

Everything needed to run the full stack and deliver the demo: startup order, smoke tests, the minute-by-minute script, and what to do when something breaks on stage. Rehearse the whole thing at least twice.

---

## 1. One-time setup (night before)

**Secrets (gitignored — must exist):**
- `backend/serviceAccountKey.json` — Firebase Admin key
- `backend/.env` — `PORT=5000`, `AI_SERVICE_URL=http://localhost:8000`, encryption key
- `ai-service/.env` — `NVIDIA_API_KEY=...` (chat + AI summary), Sarvam keys (optional)
- `dashboard/.env` — Firebase web config (`VITE_*`), `VITE_API_URL=http://localhost:5000`
- `mobile-app/src/utils/firebase.js` — Firebase web config

**Network (the #1 demo killer):**
1. Put laptop and phone on the **same WiFi / hotspot**. A phone hotspot is more reliable than venue WiFi.
2. Run `ipconfig`, find the IPv4 of that adapter.
3. Set it in `mobile-app/src/utils/api.js` → `BASE_URL = 'http://<that-ip>:5000/api'`.
4. Confirm from the phone's browser: `http://<that-ip>:5000/api/health` must return JSON. If it doesn't, allow Node through Windows Firewall (or `netsh advfirewall firewall add rule name="Niranthara" dir=in action=allow protocol=TCP localport=5000`).

**Python env (once):** the committed `venv` is machine-pinned — build a fresh one:
```powershell
cd ai-service
python -m venv .venv ; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
First run downloads HuggingFace models (mental-roberta, indic-bert, distilroberta — several GB). **Do this on hotel/home WiFi, never on demo day.**

**Seed the demo patient** (after you have signed up one mobile user and one clinician):
```powershell
cd backend ; node scripts/seedTestUser.js
```
This links the newest mobile user to the clinician and seeds: risk profile + topFactors (SHAP panel), 2 clinician alerts, and a PHQ-9/GAD-7 trajectory (assessments chart).

**Firestore indexes:** click through the app once (dashboard patient list, mood history). If backend logs print index-creation URLs, click each once and wait for "Enabled" in the Firebase console.

---

## 2. Startup order (demo day, ~5 min before)

Four terminals, in this order:

```powershell
# T1 — AI service (start first: model loading takes ~1-2 min)
cd ai-service ; .\.venv\Scripts\Activate.ps1 ; uvicorn main:app --port 8000
# ready when: http://localhost:8000/api/health shows risk_model_ready: true

# T2 — Backend
cd backend ; node index.js
# ready when: "Niranthara backend running on port 5000" + "JITAI scheduler started"

# T3 — Clinician dashboard
cd dashboard ; npm run dev
# open http://localhost:5173, log in as the clinician, keep it PROJECTED

# T4 — Mobile app
cd mobile-app ; npm start
# Expo Go on the phone (or the EAS dev-client build), log in as the patient
```

**Smoke test (2 minutes, every time):**
1. `http://localhost:8000/` → shows the 9-model roster.
2. Phone: send one chat message → reply arrives with "Minimax M2.7" tag (not fallback).
3. Phone: Home → Sync Biometrics → card fills.
4. Dashboard: patient visible in list with risk badge.

---

## 3. The demo script (7 minutes)

Setup: **dashboard projected on the big screen, phone mirrored or held up beside it.** Two windows visible at once is the whole trick — the audience watches data travel.

**[0:00] The problem (30 s).**
"A psychiatrist sees a patient one hour a month. The other 729 hours are invisible — that's where symptoms return, medication stops, and patients disappear. Niranthara makes those 729 hours visible. Everything you're about to see is a trained model — no keyword matching anywhere."

**[0:30] Patient side — passive + active signal (90 s).**
- Phone Home: point at risk ring, cycle ring ("a per-user LSTM forecasts her hormonal vulnerability window — most platforms treat this as noise; we model it").
- Tap **Sync Biometrics** → HR/HRV/sleep/steps land. "Health Connect — works with Fitbit, Samsung, Pixel, any Android wearable."
- Take the **Wellbeing check** (PHQ-9), answer quickly to a moderate-ish score. "Validated clinical instrument, scored server-side, shared with the care team instantly." Show the result screen.
- Dashboard: refresh PatientDetail → **the PHQ-9 point just appeared on the assessments chart.**

**[2:00] The journal → live risk pipeline (2 min). THE MONEY SHOT.**
- Phone Journal: log a low mood with a concerning line, e.g. *"I keep telling everyone I'm fine but I can't get out of bed and nothing matters anymore."*
- Narrate while it processes: "That text just hit three transformers in parallel — sentiment, emotion, crisis — plus the cycle LSTM and a 15-feature XGBoost fusion. The journal itself was AES-256 encrypted before it touched the database; the models see it, the dashboard never does."
- **Projected dashboard: the alert appears within ~1 second** (Firestore onSnapshot — rehearse this moment; it reliably gets a reaction).
- Open the alert → PatientDetail: risk trajectory chart, **Top Risk Factors (SHAP)** — "the AI shows its work; clinicians don't act on black boxes."

**[4:00] Crisis path — detection AND response (60 s).**
- Phone Chat: send a distress message. The crisis classifier (mental-roberta) fires → **the full-screen support screen opens**: tap-to-call Tele-MANAS 14416, grounding exercise, breathing.
- "Detection without response is a liability. The patient gets help in-app immediately; the clinician gets the escalation in parallel — the escalation cron re-sweeps every 15 minutes so nothing sits unseen."
- Bonus: type *"how much sertraline should I take?"* → the model declines and redirects to the prescriber. "Guardrails on the output side too — this assistant never plays doctor."

**[5:00] Clinician intelligence (90 s).**
- PatientDetail → **Generate Summary**: five clinical sentences from 30 days of structured signals. "The 15-minute visit, prepped in 30 seconds — and it's built from model outputs, never raw journal text. Privacy is architectural."
- Sweep the rest: mood-sentiment divergence tile ("she says fine, her language says otherwise — masked depression as a first-class signal"), PHQ-9 trajectory, alert resolve flow.

**[6:30] Close (30 s).**
"Chatbots talk. Dashboards display. Niranthara closes the loop: passive detection → just-in-time intervention → clinician escalation → follow-up recapture — per-patient models, explainable decisions, Indian languages. Continuity is the product."

---

## 4. Failure playbook

| Failure | Symptom | Recovery |
|---|---|---|
| NVIDIA API down / no key | Chat replies with warm fallback, "fallback" tag | Say it out loud as a feature: "graceful degradation — the static fallback keeps the patient held while the cloud is unreachable." Summary card also degrades to a deterministic template. |
| Phone can't reach backend | Chat/journal say "saved offline" | It IS the offline-first story — show it, then switch phone to hotspot, restart Expo, retry. Verify `/api/health` from the phone browser. |
| Health Connect has no real data | Empty biometrics | Long-press the "Health Connect" title → SIMULATED mode (hidden toggle). Simulated is the recommended stage default anyway. |
| Need a guaranteed dashboard alert | — | Long-press **Sync Biometrics** → deterministic HRV-crash through the real pipeline → alert lands on the dashboard. |
| AI service crashed mid-demo | Journal still logs, risk uses fallback values | Mood logging never blocks on ML (Promise.allSettled). Restart T1; models are cached, ~60 s. |
| Dashboard empty | No patients | Wrong clinician login, or seed script not run — `node scripts/seedTestUser.js` takes 10 s. |
| Judges ask "what's the model trained on?" | — | Honest answer, rehearsed: risk labels are synthetic today; the architecture self-labels (dropout, JITAI, anomaly generate their own training data in weeks of a pilot), and every model ships with a naive baseline it must beat. |

**Golden rules:** hotspot over venue WiFi · simulated biometrics on stage · never demo anything you haven't run that morning · if a step dies, narrate the architecture while you recover — the fallbacks are part of the design.

---

## 5. What was added for the MVP (talking points)

| Addition | Where | One-liner for judges |
|---|---|---|
| PHQ-9 / GAD-7 flow | mobile Assessment.js, `/api/assessments` | Validated instruments anchor the ML to clinical ground truth |
| Item-9 self-harm alert | assessmentRoutes.js | Standard PHQ-9 protocol: any non-zero item 9 alerts the clinician regardless of total |
| Crisis support screen | mobile CrisisSupport.js | Detection without response is a liability — helplines, grounding, breathing, offline-capable |
| LLM output guardrail | nvidia_client.py | System-prompt hardening + deterministic dosing check — the assistant never plays doctor |
| AI clinical summary | `/api/chat/summary` + dashboard card | 30 days → 5 sentences, from structured signals only — raw journals never leave encryption |
| Live SHAP panel | moodRoutes + PatientDetail | Every risk score arrives with its top drivers — explainability by default |
