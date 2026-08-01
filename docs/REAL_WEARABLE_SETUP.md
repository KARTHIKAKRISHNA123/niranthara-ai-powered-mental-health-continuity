# Getting your real Fitbit Charge 6 data into Niranthara

Written for the primary-user story: **one real person, real watch data, real risk pipeline.**

---

## The situation, stated plainly

You are running the app through **Expo Go**. Health Connect is an Android *native module*.
Expo Go cannot load native modules, so `HealthConnectService.js` detects this and returns
**simulated** numbers. That is by design and it is clearly labelled in the UI — but it means
**no Fitbit data can reach the pipeline through Expo Go, ever.** No amount of permission-granting
changes that.

There are exactly three ways to get real data in. Pick based on how much time you have.

| Path | Works in Expo Go | Setup time | Real data |
|---|---|---|---|
| **A · Google Health API** (cloud) | ✅ yes | ~30 min | ✅ yes |
| **B · Health Connect** (on-device) | ❌ needs dev build | ~45 min build | ✅ yes |
| **C · Simulated** | ✅ yes | 0 | ❌ no |

**Path A is implemented and is the recommended one.** It is also the only one that survives
past September.

---

## Why not the Fitbit Web API

Do not build on `api.fitbit.com`. Google is **decommissioning the legacy Fitbit Web API on
30 September 2026** — existing OAuth tokens do not transfer, and data simply stops arriving.
Cloud access to Fitbit data has moved to the **Google Health API** (`health.googleapis.com/v4`).
Google Fit's REST API is also end-of-life in late 2026.

Sources: [Fitbit → Google Health migration](https://developers.google.com/health/migration) ·
[Google Fit migration FAQ](https://developer.android.com/health-and-fitness/health-connect/migration/fit/faq)

---

## Path A — Google Health API (recommended)

Your watch already syncs to Google's cloud: **Charge 6 → Fitbit app → Google account**.
This path has the *backend* read from that cloud. The phone only does a one-time consent, so
**no native module and no dev build are required** — it works in Expo Go and on iOS.

### 1. Create the Google Cloud project

1. <https://console.cloud.google.com> → **New project** → name it `niranthara`.
2. **APIs & Services → Library** → search **Google Health API** → **Enable**.

### 2. Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen** → **External** → Create.
2. App name `Niranthara`, your email as support and developer contact.
3. **Scopes** → Add:
   - `.../auth/googlehealth.activity_and_fitness.readonly`
   - `.../auth/googlehealth.health_metrics_and_measurements.readonly`
   - `.../auth/googlehealth.sleep.readonly`
4. **Test users** → add **the Google account your Fitbit syncs to**.

> **This is the step that saves your demo.** In *Testing* mode the app works
> **immediately** for up to 100 listed test users. Google's full verification review is only
> needed to go public — you do **not** need it for a hackathon. Do not click "Publish app".

### 3. Create the OAuth client

1. **Credentials → Create credentials → OAuth client ID → Web application**.
2. **Authorised redirect URIs** → add exactly:
   ```
   http://<YOUR_LAN_IP>:5000/api/google-health/callback
   ```
   Find `<YOUR_LAN_IP>` with `ipconfig` (the IPv4 on the network your phone is on).
   It must match `GOOGLE_HEALTH_REDIRECT_URI` character for character.
3. Copy the client ID and client secret.

### 4. Configure the backend

Add to `backend/.env`:

```bash
GOOGLE_HEALTH_CLIENT_ID=<client id>
GOOGLE_HEALTH_CLIENT_SECRET=<client secret>
GOOGLE_HEALTH_REDIRECT_URI=http://<YOUR_LAN_IP>:5000/api/google-health/callback
```

Restart the backend:

```bash
node index.js
```

### 5. Connect from the phone

1. Open Niranthara → **Home**.
2. The Health Connect card now shows **"Connect Fitbit via Google Health"** (it only appears
   once the server reports the credentials are configured).
3. Tap it → the system browser opens Google's consent screen → approve.
4. You will see a "Google Health connected" confirmation page. Return to the app.
5. The sync button now reads **"Sync from Google Health"**. Tap it.

Your real heart rate, HRV, steps and sleep flow through the same scoring, alert gate and
XGBoost re-score as any other sync — nothing downstream changes.

### What you will actually see

- **HRV may show `—`.** Fitbit does not publish HRV to every surface. This is correct
  behaviour, not a bug: absent signals stay `null` and are excluded from the stress score,
  which is renormalised over the signals actually present. If a missing signal were scored as
  `0`, "0 steps" would read as maximum deviation and fire a false alert.
- **Stress-gate alerts need ≥ 2 corroborating signals.** One deviant reading — an elevated
  heart rate from stairs or coffee — never alerts on its own.
- **Empty first sync?** Open the Fitbit app and let it finish syncing, then retry. The backend
  reads a 24-hour window.

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Connect button missing | Server reports `configured: false` | Check the three env vars, restart backend |
| `redirect_uri_mismatch` | URI differs from the console entry | Must match exactly — scheme, IP, port, path |
| "Reconnect needed — no refresh token" | Google reuses a prior grant | Remove Niranthara at [myaccount.google.com/permissions](https://myaccount.google.com/permissions), connect again |
| `403` on a data type | Scope not granted | Re-consent and tick every box |
| Sync returns no records | Watch hasn't synced | Open the Fitbit app, wait, retry |
| Browser can't open the callback | Phone can't reach your machine | Same Wi-Fi, use the LAN IP, allow node through the firewall |

---

## Path B — Health Connect (on-device, needs a dev build)

Already implemented in `mobile-app/src/services/HealthConnectService.js`. It only works in a
custom dev build:

```bash
npx eas build --profile development --platform android
```

Install the resulting APK, then run `npx expo start --dev-client`. Chain:
**Charge 6 → Fitbit app → Health Connect → Niranthara.** In the Fitbit app, enable
Settings → Health Connect and grant the permission sheet when the app requests it.

Note that Fitbit does not write HRV into Health Connect, so HRV will be `—` on this path too.

---

## Path C — Simulated (fallback only)

Long-press the **"Health Connect"** title on the Home card to force simulated data. The card
labels itself `SIMULATED` whenever it is not reading real records — leave that badge visible.
Claiming simulated numbers are real is the one thing that will actually cost you the pitch;
saying "this is simulated, here is the real path, here is why HRV is blank" reads as
engineering maturity.

---

## Recommendation for pitch day

Do **Path A tonight** — 30 minutes, and the consent survives reboots because the backend holds
an encrypted refresh token. Keep Path C as the stage fallback. If Path A is connected, open the
demo with *your own* wrist data: it is a materially stronger story than any seeded patient.
