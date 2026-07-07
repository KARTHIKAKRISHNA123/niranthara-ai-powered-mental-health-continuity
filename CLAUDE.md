# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Maintenance rule: update this file in the same session as any change that affects architecture, routes, pipelines, models, screens, or gotchas.** Stale guidance here is worse than none.

## What this is

Niranthara is an AI mental-health *continuity* platform: passive monitoring of depression triggers, just-in-time interventions (JITAI), and a clinician dashboard with real-time risk intelligence. It is a multi-service monorepo, not a single app.

## Five services (each is independently run)

| Dir | Stack | Port | Run |
|---|---|---|---|
| `ai-service/` | Python 3.11 · FastAPI · PyTorch · XGBoost · HuggingFace | 8000 | `uvicorn main:app --reload --port 8000` |
| `backend/` | Node 20 · Express · Firebase Admin · node-cron | 5000 | `node index.js` (no `start`/`test` script — `npm test` is a stub) |
| `dashboard/` | React 18 · Vite 5 · Firebase Web SDK | 5173 (vite) | `npm run dev` · `npm run build` · `npm run lint` |
| `mobile-app/` | React Native · Expo SDK 50 | — | `npm start` / `expo start` (`--android` / `--ios`) |
| `smartwatch/` | Node · Express | — | `npm run dev` (nodemon) / `npm start` |

There is **no test suite** wired up anywhere (no pytest config, backend `test` is `exit 1`). Verify changes by running the relevant service, not by running tests.

### Python environment caveat
Use **`ai-service/.venv`** (CPython 3.11.15, built with `uv venv .venv --python 3.11`; deps via `uv pip install -r requirements.txt --python .venv\Scripts\python.exe`). Run: `.venv\Scripts\python.exe -m uvicorn main:app --port 8000`. The old committed `venv` (no dot) is pinned to a nonexistent `C:\Python313` — ignore it. `python`/`py` are broken uv shims on this machine; go through `uv` or the `.venv` interpreter directly. Set `PYTHONUTF8=1` when running scripts that print unicode (e.g. `download_models.py` crashes on cp1252 without it). Pydantic is v2.

## Architecture: how the services talk

```
mobile-app ──(Firebase JWT)──▶ backend :5000 ──(HTTP)──▶ ai-service :8000 ──▶ NVIDIA cloud (chat)
     │                              │                          │
     └── offline-first AsyncStorage │                          └── local HF models (NLP), XGBoost, per-user LSTM/JITAI pkl
                                    ▼
                         Firebase Firestore (shared state) ◀── dashboard (onSnapshot live reads)
```

- **`backend` is an orchestration layer.** It owns auth, encryption, Firestore writes, and cron schedulers; it proxies all ML/NLP work to `ai-service`. The AI service URL is `process.env.AI_SERVICE_URL` (default `http://localhost:8000`).
- **Firestore is the integration bus.** Backend writes (`users`, `moodLogs`, `cycleLogs`, `chatLogs`, `clinicianAlerts`, `jitaiLogs`); the dashboard reacts via `onSnapshot` (see `dashboard/src/hooks/usePatients.js`). There are no REST calls from dashboard → backend for the live patient list.
- **Cron is started inside `backend/index.js` `app.listen`**: `jitaiScheduler` (hourly receptivity sweep) and `escalationCron` (`startEscalationCron()`, runs every 15 min for crisis + loss-of-follow-up). Editing scheduler cadence means editing those service files, not config.

### The two pipelines that span files

1. **Mood check-in → risk.** `POST /api/mood/log` (`backend/routes/moodRoutes.js`) is the heavy path: AES-encrypt journal → call ai-service sentiment + emotion + crisis in parallel → compute mood/sentiment divergence → pull cycle vulnerability (LSTM) → assemble XGBoost features → write `moodLogs` + update `users.riskLevel`, and write a `clinicianAlerts` doc if crisis. To change risk behavior you touch both `moodRoutes.js` and `ai-service/routers/predict.py`.

2. **Chat.** `mobile Chat.js → backend /api/chat/message → ai-service /api/chat → NVIDIA`. `chatRoutes.js` enriches the message with live user context (cycle/mood/risk/emotion from Firestore) and forwards recent conversation turns; `ai-service/routers/chat.py` runs a crisis classifier (`mental-roberta`), detects language, and calls `utils/nvidia_client.py`. The LLM is a **model chain via NVIDIA's OpenAI-compatible API** (`AsyncOpenAI`, base_url `integrate.api.nvidia.com`), latency-first for chat: `meta/llama-3.1-8b-instruct` primary (~1-2s measured; env `NVIDIA_CHAT_MODEL` / `NVIDIA_CHAT_TIMEOUT`, default 12s) → Minimax M2.7 quality backstop (`NVIDIA_MODEL` / `NVIDIA_PRIMARY_TIMEOUT`, 25s) → rotating static fallbacks. The clinician summary chain is the reverse (Minimax first for quality — latency is acceptable there). Guardrails are two-tier and deterministic (labeled safety floor, not clinical decisions): `is_dosing_question()` defers medication-dose questions before the LLM runs (language-proof), and `apply_output_guardrail()` catches dosing advice in replies. **Reply language follows the typed message** (per-message detection: Tamil script / Tanglish words), never the profile language — profile-language override made English questions get Tamil answers and bypassed the English output regex. Multi-turn memory works by threading `history` (client state → backend → ai-service `messages` array), not by re-reading Firestore. When a crisis is detected, mobile navigates full-screen to `CrisisSupport` (helplines, grounding); the Chat header has a permanent Support button.

3. **Assessments.** `POST /api/assessments` (`backend/routes/assessmentRoutes.js`) scores PHQ-9/GAD-7 server-side, stores item answers in `assessments`, mirrors the latest score onto `users.last_phq9`/`last_gad7`, and **any non-zero PHQ-9 item 9 creates a `clinicianAlerts` doc** (self-harm protocol) regardless of total. Mobile flow: `screens/Assessment.js` (one question per screen; Home card opens PHQ-9, long-press for GAD-7; scores locally if offline). Dashboard: assessments trajectory card on `PatientDetail.jsx`.

4. **Clinician AI summary.** `GET /api/clinician/summary/:uid` assembles 30-day structured aggregates (mood trend, divergence, crisis events, assessments, open alerts — **never raw journal/chat text**) → `ai-service POST /api/chat/summary` → `generate_clinical_summary()` (same model chain, temp 0.3, deterministic template fallback).

## Conventions to preserve

- **ML-first, "zero hardcoding".** Clinical decisions come from a trained model or NLP classifier; rule-based branches exist only as network/`fallback_*` paths and are explicitly labeled. Don't add keyword matching to make something "work" — wire it to the model.
- **Stack is JavaScript only** (no TypeScript), functional React with hooks, async/await. Mobile/dashboard styles are co-located (`StyleSheet.create`, theme constants in `mobile-app/src/theme/theme.js`).
- **Secrets / required local files (gitignored, must exist to run):** `backend/serviceAccountKey.json` (Firebase Admin), `backend/.env` (`PORT`, `AI_SERVICE_URL`, encryption key), `ai-service/.env` (`NVIDIA_API_KEY`, Sarvam keys), `dashboard/.env` and `mobile-app/src/utils/firebase.js` (Firebase web config). `.env.example` files exist for backend and smartwatch.
- **Journal text and chat messages are AES-256-GCM encrypted** before Firestore (`backend/utils/encryption.js`); `/chat/history` strips the encrypted field before returning.
- **Auth:** every protected backend route uses `middleware/verifyToken.js` (Firebase `verifyIdToken`), exposing `req.user.uid`. Mobile injects the Firebase JWT via the Axios interceptor in `mobile-app/src/utils/api.js`.

## Gotchas verified in this codebase

- **`main.py` must load `.env` before router imports** (`load_dotenv()` at the top) — `nvidia_client.py` reads `NVIDIA_API_KEY` at import time. Before this fix the service silently ran chat on static fallbacks unless the key happened to be in the shell env.
- **OpenAI SDK retries multiply timeouts**: the NVIDIA client is created with `max_retries=0` because the model chain is the retry strategy — with default retries a 25s budget produced 80s wall time (measured). Worst-case chain time must stay under the backend's 45s axios timeout.
- **SHAP output shape differs by version**: `predict.py`'s `_select_class_shap()` normalizes old (list per class) vs new ((samples, features, classes) array) SHAP output. Without it `/api/predict/risk` 500s on shap>=0.50.
- **LLM latency is the #1 trap.** Minimax M2.7 is a reasoning model: measured 20-40s replies with 60s+ stalls. The mobile global axios timeout is **8s** — chat overrides it per-request to 60s (`postData(..., { timeout: 60000 })`). If chat "always returns the same message", check `modelUsed` in the response: `fallback_*` means the chain bottomed out; an 8s client timeout means the user only ever sees the offline line.
- **README prose is stale on the LLM.** Badges/sections say "Gemma 4B via Ollama (local)"; the actual chat backend is the NVIDIA model chain (`nvidia_client.py` is the source of truth). Trust the code, not the README, on the model.
- **`mobile-app/src/utils/api.js` `BASE_URL` is a hardcoded LAN IP.** Physical-device testing requires editing it to the dev machine's WiFi IPv4 (the file documents the candidates). Android emulator uses `10.0.2.2`.
- **`ai-service/main.py` registers 9 routers** including `anomaly` (LSTM autoencoder) and a 15-feature `predict`; some README tables list 8/14 — the running app is the authority.
- Firestore composite indexes are created via console URLs printed in backend logs on first query; there is no `firestore.indexes.json` to deploy. The dashboard, `/api/assessments` GET, and `/api/chat/thread` fetch-by-uid and sort/filter in memory to dodge missing indexes (deliberate demo-scale tradeoff; the indexed thread query 500'd in rehearsal).
- **Stopping a background service wrapper can orphan its child process** on Windows — port 8000/5000 "already in use" on restart means zombie `python`/`node` processes; kill them explicitly.
- **`users.topFactors` is written on every mood log** (moodRoutes step 8) — the dashboard SHAP panel reads it; older patients fall back to the latest mood log's factors.
- **Dashboard browser notifications**: `useAlerts` (`dashboard/src/hooks/usePatients.js`) fires a `Notification` for each newly-added unresolved alert (skips the initial snapshot; `tag` dedups). Closed-browser delivery needs Web Push + service worker — roadmap, not built.
- **Wearable alerts are already multi-signal**: `biometricRoutes.js` computes a weighted stress score (HR 30% / HRV 35% / steps 20% / sleep 15%) against personal baselines and re-runs the 15-feature XGBoost with 7-day mood context; the alert gate is `stress > 0.55 || riskScore > 0.60`. The Home screen long-press demo trigger depends on that 0.55 gate — don't raise it before the demo.
- **Demo scaffolding to remove after the hackathon**: hidden long-press triggers in `Home.js` (crisis biometrics, data-source toggle).

## Reference docs in repo
`README.md` (deep feature/model walkthrough — stale in places, see gotchas), `NIRANTARA_TECHNICAL_SPEC_V2.md`, `Build_Guide.md`, `nirantara_feature_map_v2.html`, **`docs/NIRANTHARA_V2_MASTER_PLAN.md`** (architecture review, roadmap, feature tiers), **`docs/DEMO_RUNBOOK.md`** (startup order, demo script, failure playbook), **`docs/HACKATHON_STRATEGY.md`** (problem-statement decode, 5/7/10-min presentation plans, 50 judge Q&As, execution checklist).
