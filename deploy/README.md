# Deploying Niranthara

Three containers behind a TLS reverse proxy. Everything in this directory is
self-contained — nothing in the local development setup changes.

```
                    ┌──────────────────────────────┐
  Internet ──443──▶ │ caddy  (TLS, Let's Encrypt)  │
                    └──────┬────────────────┬──────┘
                           │ /api/*         │ everything else
                    ┌──────▼──────┐  ┌──────▼───────────┐
                    │ backend     │  │ dashboard        │
                    │ :5000       │  │ nginx :80        │
                    └──────┬──────┘  └──────────────────┘
                           │ AI_SERVICE_URL=http://ai-service:8000
                    ┌──────▼──────────────────┐
                    │ ai-service :8000        │
                    │ + user_models volume    │
                    └─────────────────────────┘
                           │
                    Firestore · Firebase Auth · NVIDIA  (managed, external)
```

**`mobile-app/` is not here on purpose.** Expo compiles to an APK; it is a
client of this deployment, not part of it. Firestore, Firebase Auth and the
NVIDIA LLM endpoint are managed services the containers connect out to — they
are never containerised.

---

## What you need on the VM (one time)

- **GCP Compute Engine `e2-standard-2`** (2 vCPU / 8GB), Ubuntu 24.04 LTS, 30GB disk.
  4GB is the floor — three transformer models sit resident in RAM alongside
  torch, XGBoost and SHAP. `e2-micro` and `e2-small` will OOM-kill `ai-service`.
- **Firewall:** allow `tcp:80` and `tcp:443` only. Do **not** open 5000 or 8000
  — the compose network reaches them internally, and exposing 8000 would put
  an unauthenticated AI service on the public internet.
- **A domain** with an A record pointing at the VM's external IP. Not optional:
  Android API 28+ blocks cleartext HTTP, so the phone cannot talk to a bare IP.
- Docker Engine + the Compose plugin, and git.

```bash
curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker $USER
```

Log out and back in for the group change to apply.

---

## First deploy

**1. Clone.**

```bash
git clone https://github.com/<you>/Niranthara.git ~/Niranthara
```

**2. Ship the secrets.** This is the step that makes "git pull and it just
works" false the first time — all four files are gitignored and will not arrive
with the clone.

```bash
gcloud compute scp backend/.env backend/serviceAccountKey.json ai-service/.env niranthara-vm:~/Niranthara/ --zone=asia-south1-a
```

Put `backend/.env` and `serviceAccountKey.json` in `~/Niranthara/backend/`, and
`ai-service/.env` in `~/Niranthara/ai-service/`. Then create the compose env
file:

```bash
cp ~/Niranthara/deploy/.env.example ~/Niranthara/deploy/.env
```

Fill in `DOMAIN` and the six `VITE_FIREBASE_*` values.

**3. Point the OAuth callback at the new host.** In the Google Cloud console,
add `https://<DOMAIN>/api/google-health/callback` to the authorised redirect
URIs. Compose passes the matching `GOOGLE_HEALTH_REDIRECT_URI` to the backend
automatically; if the two disagree the Fitbit path fails at the callback.

**4. Build and start.**

```bash
cd ~/Niranthara/deploy && docker compose up --build -d
```

First build takes **10–20 minutes** — it downloads ~1.5GB of HuggingFace models
and bakes them into the image. Later builds hit the layer cache and take
seconds unless `requirements.txt` changed.

**5. Verify — do not assume.**

```bash
curl -s https://$DOMAIN/api/health
```

Then check the AI service from inside the network, including that the XGBoost
models actually exist:

```bash
docker compose exec ai-service curl -s localhost:8000/api/health
```

`risk_model_ready` and `dropout_model_ready` must both be `true`. If either is
`false` the mood check-in pipeline — the headline feature — is dead, and
nothing else will tell you.

**6. Rebuild the APK** against the deployment:

```bash
EXPO_PUBLIC_API_URL=https://your-domain npx expo run:android --variant release
```

`api.js` reads `EXPO_PUBLIC_API_URL` as its highest-priority override. Without
it the app falls back to the Expo packager's LAN IP, which does not exist in
production, and every request dies into the offline queue while reporting
"Saved Offline".

---

## Every deploy after that

```bash
cd ~/Niranthara && git pull && cd deploy && docker compose up --build -d
```

If you only changed backend JS, skip the ai-service rebuild — seconds instead
of minutes:

```bash
docker compose up -d --build backend
```

---

## Things that will bite you

**Per-user models are runtime state, and there are three kinds.**
`anomaly.py:127` writes `models/user_autoencoders/{uid}.pt`, `cycle.py:71`
writes `models/user_cycles/`, and `jitai.py:52` writes
`models/user_jitai/{uid}.pkl`. All three are named volumes. If you ever run
`docker compose down -v`, the `-v` deletes them and every patient's
personalised models are gone — behavioural baseline, cycle forecast and
receptivity all reset to cold. Use `docker compose down` without `-v`.

Note the volumes mount the *subdirectories*, never `/app/models` itself —
mounting the parent would shadow `risk_model.pkl` and `dropout_model.pkl` that
the build put there.

**Never scale the backend past 1.** `index.js` starts `jitaiScheduler` and
`startEscalationCron` inside `app.listen`. Two replicas send duplicate JITAI
pushes to patients and duplicate crisis alerts to clinicians. `scale: 1` in the
compose file is load-bearing, not a default.

**This is also why Compose-on-a-VM beats Cloud Run here.** Cloud Run would
autoscale those crons and its ephemeral filesystem would discard the per-user
models on every cold start. The single-VM shape matches the app's actual
statefulness.

**Dashboard env vars are build-time.** Vite inlines `VITE_*` into the bundle.
Changing one in `deploy/.env` and restarting does nothing — you need
`docker compose up --build dashboard`.

**Cold start is slow on purpose.** `ai-service` warms the crisis classifier at
boot (~40s on CPU) so the first patient message doesn't pay it. The healthcheck
allows 150s before marking it unhealthy; shortening that restart-loops the
container.

**Watch the first boot logs.** `sentiment.py` refuses to start if its model's
`id2label` is still `LABEL_0/1/…` — that guard exists because a headless model
silently scored a constant 0.338 for months.

```bash
docker compose logs -f ai-service
```

---

## Rollback

Images are tagged per build, so the fastest rollback is by commit:

```bash
git checkout <last-good-sha> && docker compose up --build -d
```

The Firestore data is external and unaffected by a container rollback.
