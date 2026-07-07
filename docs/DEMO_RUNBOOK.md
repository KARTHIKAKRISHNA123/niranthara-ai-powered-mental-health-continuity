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

**Python env (once — already done on the dev machine, models cached):**
```powershell
cd ai-service
uv venv .venv --python 3.11
uv pip install -r requirements.txt --python .venv\Scripts\python.exe
$env:PYTHONUTF8='1'; .\.venv\Scripts\python.exe download_models.py
```
Downloads HuggingFace models (mental-roberta, indic-bert, distilroberta — several GB) and retrains the XGBoost risk model. **Do this on hotel/home WiFi, never on demo day.** (`python`/`py` are broken shims on this machine — always go through `uv` or `.venv\Scripts\python.exe`.)

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
cd ai-service ; $env:PYTHONUTF8='1' ; .\.venv\Scripts\python.exe -m uvicorn main:app --port 8000
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
2. Phone: send one chat message → reply arrives in ~1-3 s tagged "Llama 3.1" (latency-first chat chain; "Minimax M2.7" means the quality backstop answered — also fine). An untagged bubble means the chain bottomed out to static fallback.
3. Phone: Home → Sync Biometrics → card fills.
4. Dashboard: patient visible in list with risk badge, and the browser asked for notification permission — click Allow (backgrounded-tab alerts).

---

## 3. THE MASTER DEMO — one continuous story, every device, every capability (~8 min)

This is the single top-notch demo. It weaves all 28 cookbook demos (§3.5) into one narrative across three surfaces at once. **Devices on stage:** the Fitbit Charge 6 on your wrist, the Android phone in your hand (patient Ananya), the laptop projected (clinician dashboard, logged in, notifications allowed, one tab). The audience's job is to watch data travel between them.

**Pre-stage (from §2):** all services warm, one chat message already sent (classifier warm-up), dashboard on the Patients page showing the pulsing "Live · Firestore onSnapshot" indicator, biometric mode set (SIMULATED recommended; REAL if the morning wrist-check passed).

---

**ACT 1 — The invisible patient becomes visible (0:00-1:30). Devices: watch + phone.**

Open on the projected caseload: "A psychiatrist sees a patient one hour a month. The other 729 hours are invisible — that's where symptoms return and patients quietly disappear. This dashboard is those 729 hours."

Raise your wrist: "This Fitbit has been watching all day." Phone Home → **Sync Biometrics** → HR/HRV/steps/sleep fill the card (D4/D5). "It reads Health Connect, not Fitbit — same code for Samsung, Pixel, any wearable. Absent signals are excluded, not faked — and no single signal can ever page a clinician alone; stress alerts need corroboration." Point at the risk ring and cycle ring (D1): "a per-user LSTM forecasts her hormonal vulnerability window — most platforms treat this as noise; we model it."

**ACT 2 — Clinical ground truth (1:30-2:30). Devices: phone → dashboard.**

Home → **Wellbeing check** → answer the PHQ-9 to a moderate score (D8). "The validated instrument psychiatry actually uses — scored server-side, one question per screen." Result screen → switch to the projector: open her PatientDetail → **the score just landed on the assessments trajectory** (D24). "Symptom trend between visits, not a memory test at the appointment."

**ACT 3 — THE MONEY SHOT (2:30-4:00). Devices: phone → projector, live.**

Journal tab → mood 2/5 → type: *"I keep telling everyone I'm fine but I can't get out of bed and nothing matters anymore."* → save (D7). Narrate over the ~1s of processing: "Three transformers in parallel — sentiment, emotion, crisis — the cycle LSTM, then a 15-feature XGBoost fusion. The journal was AES-256 encrypted before it touched the database."

**Do not talk over what happens next.** The alert lands on the projected dashboard in about one second. Let the room see it. Then: open the alert → PatientDetail → **Top Risk Factors** (D23): "SHAP explainability — the model shows its work. And notice the suppression signal: she *said* fine; her language didn't. Masked depression is a first-class feature here."

If the dashboard tab were minimized, the OS notification still fires (D20) — mention it or show it: "the clinician doesn't need to be watching."

**ACT 4 — The patient isn't alone either (4:00-5:30). Device: phone.**

Back to the phone — Home now shows the **breathing card** (D14): "risk went up, so a just-in-time intervention surfaced — timed by a per-user receptivity model, not a marketing scheduler." Open **Care** → send: *"I don't know how to handle tonight."* → warm reply in seconds, model tag visible (D11). Then the stunt — type: *"what dose of sertraline should I take?"* → instant deferral (D12): "deterministic guardrail, fires before the LLM even runs — this assistant never plays doctor." Tap **Support** in the header (D13): full crisis screen — tap-to-call Tele-MANAS 14416, grounding, breathing. "Detection without response is a liability. Detection here IS response."

**ACT 5 — Closing the loop (5:30-7:00). Device: projector.**

PatientDetail → **Generate Summary** (D25): while it writes, point at the alert queue (D21): "this loss-of-follow-up alert came from a cron that sweeps every 15 minutes — high-risk plus three days silent. Nobody exits care unnoticed. That's the problem statement, answered by a background job." Summary appears: "thirty days — mood trend, divergence, crisis events, assessments — in five clinical sentences, built from model outputs, never raw journal text. The 15-minute visit, prepped in 30 seconds." **Resolve** the alert: "acknowledged, on the record."

**CLOSE (7:00-7:30).**

"Chatbots talk. Dashboards display. Niranthara closes the loop: a watch that senses, models that predict, interventions that arrive when the patient will accept them, clinicians who see it explained, and a system that notices silence. Per-patient models, explainable decisions, Indian languages. Continuity is the product."

---

**Timing discipline:** rehearsed beats total ~32s of actual processing; the rest is your narration. If any beat fails live, the failure playbook (§4) has the recovery, and every act references its cookbook entry (§3.5) for the fallback. Cut Act 2 for a 5-minute slot; add D3 (suppression arc on phone) and D18 (airplane-mode offline log) for a 10-minute slot.

---

## 3.5 Per-demo cookbook — how to run EVERY demo

All services running per §2, phone logged in as the patient, dashboard as the clinician. Each entry: steps → expected result → recovery. Every path below was machine-verified (30 automated checks across two test suites).

### Mobile — patient app

**D1 · Home dashboard (risk ring, cycle ring, baseline stats).** Open the app. Expect: animated risk ring with XGBoost percentage, cycle ring, steps/sleep/mood tiles vs personal baseline. Stats show 0/— until passive data exists — sync biometrics first for a fuller screen.

**D2 · SHAP narrative card.** On Home, find the colored card ("Your system is under stress" etc.), tap the chevron. Expect: plain-language narrative + top-3 AI signal breakdown. Requires one mood log ever (writes `users.topFactors`).

**D3 · Emotional suppression arc.** Appears on Home only when mood-language divergence > 0.15 — log a mood of 4/5 with a clearly negative journal to trigger it. Expect: STATED vs EXPRESSED bars with a gap indicator.

**D4 · Biometric sync — simulated.** Long-press the "Health Connect" title → confirm SIMULATED. Tap Sync Biometrics. Expect: card fills (HR/HRV/steps/sleep), "SIMULATED" tag. This is the recommended stage mode.

**D5 · Biometric sync — real Fitbit Charge 6.** Wear the watch; open the Fitbit app and let it sync; confirm data in the Health Connect app (Browse data). In Niranthara (dev-client build, not Expo Go): long-press title → REAL mode → Sync. Expect: provider tag "Fitbit", real HR/steps/sleep, HRV shows "—" (Fitbit never writes HRV to Health Connect — absent signals are excluded from scoring, not zeroed). Recovery: falls back to SIMULATED with a reason; check Health Connect app permissions for Niranthara.

**D6 · Deterministic crisis biometrics (stage trigger).** Long-press "Sync Biometrics" (600 ms). Expect: HRV-crash payload through the real pipeline, stress ~0.58, "Alert sent to clinician" on the card, alert on the projected dashboard. Verified: fires every run.

**D7 · THE MONEY SHOT — journal → live dashboard alert.** Journal tab → mood 2/5 → journal: "I keep telling everyone I'm fine but I can't get out of bed and nothing matters anymore." → save. Expect: risk ~0.8/high with top factors returned in ~1-2 s; the projected dashboard alert appears within ~1 s (onSnapshot). Verified: 1.2 s end-to-end.

**D8 · PHQ-9.** Home → "Wellbeing check" card. One question per screen, answer all 9. Expect: score/27, severity band, result copy; score appears on the dashboard assessments chart on next load.

**D9 · GAD-7.** Long-press the same Wellbeing check card (600 ms). Same flow, 7 questions, /21.

**D10 · PHQ-9 item-9 protocol.** Take PHQ-9 and answer the last question (self-harm) with anything above "Not at all". Expect: result screen shows a "Support is available right now" button → opens Crisis Support; a clinician alert is created regardless of total score. Verified live.

**D11 · Chat with memory.** Care tab → send 2-3 related messages. Expect: replies in ~2-8 s tagged "Llama 3.1" (or "Minimax M2.7"); later replies reference earlier ones. Kill and reopen the app → thread restores (server-side decrypt). First message after service boot is slow (classifier lazy-load) — that's what the §2 warm-up is for.

**D12 · Medication guardrail (judge-proofing).** In chat, type: "what dose of sertraline should I take? should I go up to 100mg?" Expect: instant deterministic deferral ("I can't advise on medication…"), ~0.2 s — it never reaches the LLM. Verified: input-side tier fires in any language.

**D13 · Crisis support screen.** Two entries: the permanent "Support" button in the chat header (always works — use this on stage), or automatic full-screen navigation when the crisis classifier scores > 0.85 (moderate distress scores ~0.45-0.50 and will NOT auto-trigger; don't lower the threshold). Expect: tap-to-call Tele-MANAS 14416 / iCall / NIMHANS, 5-4-3-2-1 grounding, breathing handoff. Works offline.

**D14 · JITAI breathing card.** Appears on Home when risk > 0.5 (true after D7). Tap → guided 4·4·6 somatic breathing.

**D15 · CBT reframe card.** Appears on Home when 30-day avg mood < 2.5. Tap → guided thought-reframing worksheet. If avg mood is too high to trigger, open it via the crisis screen's breathing → back → or just describe it; don't force mood logs to game the average.

**D16 · Cycle screen.** Cycle tab. Expect: phase ring, vulnerability forecast. Full LSTM personalization needs period history — log a period via the screen if the ring shows day 0.

**D17 · Insights.** Home → "Insights" pill. Expect: 30-day trends and weekly narrative.

**D18 · Offline mode.** Airplane mode → log a mood → "saved offline" message; disable airplane mode → pull-to-refresh Home → offline queue syncs (`processOfflineSync`). Chat shows the saved-message line while offline.

### Dashboard — clinician

**D19 · Triage caseload.** Log in → Patients. Expect: staggered card entrance, risk-count tiles, patients sorted by XGBoost score, "Live · Firestore onSnapshot" pulsing indicator, skeleton shimmer during load.

**D20 · Live alert + browser notification.** Keep the dashboard in a background tab, run D6 or D7 on the phone. Expect: OS notification (crisis alerts stay until dismissed) + nav badge count updates live. Requires clicking Allow on the permission prompt at login (§2 smoke test).

**D21 · Alerts queue + resolve.** Alerts page. Expect: unresolved alerts newest-first (crisis alerts visually dominant); Resolve updates instantly. The queue was tidied to one alert per patient+type — escalation-cron alerts (loss-of-follow-up) now appear here too (bug fixed: they were invisible before).

**D22 · Patient detail.** Click a patient. Expect: 30-day risk trajectory chart (risk + cycle vulnerability + crisis prob), NLP signal tiles (sentiment, emotion, crisis prob, suppression), skeleton loading.

**D23 · SHAP panel.** On patient detail: "Top Risk Factors" with ranked drivers. Live for any patient with a mood log; older patients fall back to their latest log's factors.

**D24 · Assessments card.** Patient detail: PHQ-9/GAD-7 trajectory chart + latest-score tiles; item-9 flags show "Item 9 flagged — review".

**D25 · AI clinical summary.** Patient detail → Generate Summary. Expect: 4-5 clinical sentences from 30-day structured signals in ~5-30 s (chain: Minimax quality-first, Llama backstop — both tags are real). Regenerate button reruns it.

**D26 · Flag patient + PDF export.** Sidebar: Flag Patient (modal, requires reason, toast confirm; alert appears in queue) and Export PDF (patient report with summary + factors).

### Background intelligence (narrate, don't wait)

**D27 · Escalation cron.** Every 15 min: crisis-prob spikes + high-risk patients inactive 3+ days → alerts (6h per-patient dedup). Point at a "loss_of_contact" alert in the queue: "nobody silently drops out of care."

**D28 · JITAI scheduler.** Hourly receptivity sweep per patient (per-user XGBoost); nudges only when the model says the patient will engage. Show `jitaiLogs` on patient detail or narrate over the Home cards (D14/D15 are its visible output).

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
| Port 8000/5000 already in use on start | uvicorn exits with bind error | Zombie processes from a previous run: `Get-Process python \| Stop-Process -Force` (and `node` if 5000). Verified failure mode — stopping a wrapper shell can leave the child alive. |
| Want the full-screen crisis navigation from chat | Chat replies but no crisis screen | Auto-navigation requires classifier prob > 0.85 — moderate distress scores ~0.45-0.50 by design. On stage either use the permanent Support button in the chat header, or the journal money-shot (alert gate is 0.5 there). Do not lower the threshold. |
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
