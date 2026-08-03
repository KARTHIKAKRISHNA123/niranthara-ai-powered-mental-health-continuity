# Niranthara — Grant Utilisation Plan
### Government of Tamil Nadu Pre-Seed Grant · ₹15,000 · Anna University Regional Campus, Tirunelveli

**Constraints applied:** total ≤ ₹15,000 · no single component exceeds ₹10,000 ·
at least two components. This plan has **10 line items**, the largest of which is
₹3,100 — comfortably inside both rules.

**Two framing facts before the table:**
- **Months 1–3 are covered by the $300 GCP free-trial credit** (~₹25,000 of value),
  so no cloud compute cost touches the grant in that window.
- **Only Months 4–6 of GCP hit the grant** (~₹4,200). Non-GCP costs — domain,
  Firebase, Sarvam, EAS — are paid from the grant across all six months.

> **Revised August 2026.** The previous version of this plan costed a *local* LLM
> (Gemma 4B on Ollama) and named `mental/mental-roberta-base` as the crisis
> classifier. Both are obsolete: the LLM is now an NVIDIA-hosted cloud chain, and
> the crisis classifier is `sentinet/suicidality`. Two new line items appear below
> (NVIDIA inference, Google Health API) and the Sarvam justification is corrected.

---

## 1 · Cloud & Compute Infrastructure

**GCP Compute Engine — e2-medium instance — ₹3,100**
2 vCPU, 4 GB RAM, `asia-south1`. Months 4–6 only.
Hosts the Node.js Express backend (port 5000) and the Python FastAPI AI service
(port 8000) on a persistent VM. Serves all mobile-app and clinician-dashboard
requests, runs the hourly `node-cron` JITAI scheduler and the 15-minute escalation
cron, holds the Firebase Admin SDK connection for real-time Firestore writes, and
dispatches FCM push notifications. Also carries the local HuggingFace inference
load — `sentinet/suicidality` (crisis), XLM-R sentiment, distilroberta
(emotion) — which is why 4 GB RAM is the floor rather than an e2-small.

**GCP Cloud Storage — 50 GB — ₹450**
`asia-south1`, Months 4–6 only.
Persists trained model artefacts: the 15-feature XGBoost `risk_model.pkl`, the
per-user LSTM cycle models under `user_cycles/`, the per-user JITAI receptivity
models under `user_jitai/`, and the per-user LSTM autoencoders under
`user_autoencoders/`. Storing these off-instance means they survive restarts and
load into FastAPI memory at boot without retraining.

**GCP Static IP reservation — ₹450**
`asia-south1`, Months 4–6 only.
Bound to `nirantara.in` via a DNS A record. Without reservation the instance takes
a new external IP on every restart, which breaks DNS, invalidates the Let's
Encrypt certificate binding, and strands every mobile client pointed at
`api.nirantara.in`.

**GCP egress bandwidth — ~5 GB/month — ₹200**
Outbound transfer to mobile users and the dashboard: XGBoost risk scores with SHAP
factor explanations, XLM-R sentiment scores, `sentinet/suicidality` crisis
probabilities, LLM chat responses, and passive-monitoring acknowledgements.

## 2 · Domain, Security & Networking

**Domain — `nirantara.in`, 2 years — ₹1,500**
A dedicated `.in` domain establishes clinical credibility and is required to bind
SSL certificates and route production subdomains. The mobile app and dashboard
resolve through `api.nirantara.in` and `dashboard.nirantara.in` rather than a raw
IP, enabling HTTPS enforcement and subdomain routing via Nginx.

**SSL certificate — Let's Encrypt via Certbot — ₹0**
TLS is mandatory for DPDP Act 2023-compliant transmission of AES-256-GCM encrypted
journal text, Firebase JWTs, and inference payloads. Certbot automates the 90-day
renewal on the instance.

**Nginx reverse proxy — ₹0**
Terminates SSL, routes `api.nirantara.in` to Express and internal inference calls
to FastAPI, enforces network-layer rate limiting before requests reach application
code, gzips for 2G-compatible payloads, and serves the compiled dashboard build.

## 3 · APIs & Database Services

**Firebase Blaze plan — 6 months — ₹2,800**
Blaze is required because the **Spark free tier blocks outbound network calls from
the Firebase Admin SDK** running on GCP. Supports Firestore reads/writes across
`moodLogs`, `passiveLogs`, `cycleDayLogs`, `jitaiLogs`, `assessments` and
`clinicianAlerts`, and sustains FCM for JITAI push delivery.

**Sarvam AI — Tamil STT + translation — ₹1,800**
`saarika:v1` transcribes Tamil Nadu regional-accent speech for voice input.
`mayura:v1` translates Tamil and Tanglish journal text into English **before it
reaches `sentinet/suicidality` (crisis) and distilroberta (emotion), both of which
are English-only models**. Without these credits, crisis detection and emotion
classification cannot function on Tamil input at all. *(Corrected: the previous
plan named the superseded `mental-roberta` classifier here.)*

**NVIDIA API — LLM inference credits — ₹500** ← *new line item*
The conversational agent is an NVIDIA-hosted chain: `meta/llama-3.1-8b-instruct`
primary (~1–2 s measured) with `nvidia/nemotron-3-super-120b-a12b` as quality backstop, plus
the clinician narrative-summary path. This **replaces the previously budgeted local
Gemma 4B on Ollama**, which required a dedicated GPU the project does not have.
NVIDIA's build tier covers development; this reserves headroom for demo-day and
validation-user traffic.

**Google Health API — wearable data — ₹0** ← *new line item*
Reads real Fitbit Charge 6 heart rate, HRV, steps and sleep from Google's cloud
(`health.googleapis.com/v4`) into the risk pipeline. No usage cost at prototype
scale. Listed at ₹0 because it is **architecturally load-bearing and must appear in
the plan**: it is the only wearable path that works without a custom native build,
and it replaces the Fitbit Web API, which Google decommissions on 30 September 2026.

## 4 · Developer Tools

**Expo Application Services — Android build — ₹700**
Compiles the React Native app into a production-signed APK installable on real
Android devices for clinical demo and validation. Expo Go builds cannot be
distributed to external testers.

---

## Budget summary

| # | Category | Component | Price |
|---|---|---|---|
| 1 | Compute | GCP e2-medium (Months 4–6) | ₹3,100 |
| 2 | Storage | GCP Cloud Storage 50 GB | ₹450 |
| 3 | Networking | GCP Static IP | ₹450 |
| 4 | Bandwidth | GCP egress ~5 GB/mo | ₹200 |
| 5 | Domain | `nirantara.in`, 2 years | ₹1,500 |
| 6 | Security | Let's Encrypt + Certbot + Nginx | ₹0 |
| 7 | Database | Firebase Blaze, 6 months | ₹2,800 |
| 8 | Tamil NLP | Sarvam AI, 6 months | ₹1,800 |
| 9 | LLM | NVIDIA API inference credits | ₹500 |
| 10 | Wearables | Google Health API | ₹0 |
| 11 | Mobile build | EAS Android APK | ₹700 |
| | | **Total committed** | **₹11,500** |

**Largest single component: ₹3,100** (21% of grant) — well within the ₹10,000 cap.
**Components: 11** — exceeds the two-component minimum.

## Contingency — ₹3,500 unallocated

| Reserve | Amount | Trigger |
|---|---|---|
| Extended Sarvam credits | ₹1,500 | Validation scales beyond 10 Tamil-speaking users |
| Additional Firebase Blaze usage | ₹1,000 | Passive-monitoring write volume exceeds projection |
| GCP egress / storage overrun | ₹1,000 | Demo-day traffic or model-artefact growth |

**Total plan: ₹11,500 committed + ₹3,500 contingency = ₹15,000.**

---

*Niranthara — AI Continuity in Mental Care*
*Anna University Regional Campus, Tirunelveli*
