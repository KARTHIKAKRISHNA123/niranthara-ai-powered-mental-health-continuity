# NIRANTHARA — The Demo
**One script. One path. Rehearse this and nothing else.**
Verified 2 Aug 2026: backend :5000 up · ai-service :8000 up · `verifyLoop.js` **44/44**.

> **Never say these — they don't exist.** Recovery Passport (roadmap; PDF export
> is what exists) · "production-ready" · "real wearable data" while on Expo Go
> (it's simulated) · "clinically validated" · "highly accurate".
>
> Post-demo questions: `FINAL_REVIEW_AND_PLAYBOOK.md` §A (104 of them).

---

## The one sentence

> **"Every other system tells you the patient is getting worse. Niranthara tells you whether what you did about it helped."**

If a moment in the next eight minutes doesn't serve that sentence, it's cut.

---

## Accounts — read this first

| Where | Log in as | Why |
|---|---|---|
| **Phone** | `ananya.demo@niranthara.dev` | 19 mood logs, **18 PHQ-9s**, 9 measured outcomes, 67% engagement — the only patient with enough history to make the loop worth showing |
| **Dashboard** | `meena.clinician@niranthara.dev` | Ananya is on her caseload |
| **Google consent screen** | **your own Google account** | See below |

> **The `demo_patient_*` accounts cannot be logged into.** Karthik, Priya and
> Rahul exist only as Firestore documents — no Firebase Auth record. Earlier
> drafts of this script used Karthik on the dashboard, which would have put a
> different patient on the phone than on the projector.

**Your real Fitbit, on Ananya's record.** The OAuth callback binds the token to
`verifyState(state)` — the *Niranthara* uid — not to the Google account. So:
log into the app as **Ananya**, tap **Connect Fitbit via Google Health**, and on
Google's consent screen sign in with **your personal Google account**. Your real
watch data lands on Ananya's uid. You get the rich clinical history *and* live
data off your wrist.

If asked, the honest phrasing is: *"That's my own watch, connected to the demo
patient account."* Never imply the wearable data was collected from a real patient.

---

## T−30 minutes

```bash
cd ai-service && PYTHONUTF8=1 .venv/Scripts/python.exe -m uvicorn main:app --port 8000   # first, models load ~90s
cd backend   && node index.js          # RESTART after any code edit — Node does not hot-reload
cd dashboard && npm run dev            # project this
cd mobile-app && npx expo start
```

Then, in order:
1. `:8000/api/health` → `risk_model_ready: true`
2. Send **one** chat message from the phone — warms the crisis classifier (first call otherwise costs ~40s)
3. Metro shows `[api] backend reachable at …` — **never hand-edit `BASE_URL`**, it derives itself
4. Dashboard: log in, **Allow** notifications, open **Ananya**, confirm the Recovery panel renders
5. **Close the Firebase console.** Seeded docs are visible in it
6. Phone at full brightness, notifications on, Do Not Disturb off
7. **`node scripts/checkWearable.js`** — this decides one line of your script:

```bash
cd backend && node scripts/checkWearable.js
```

| Verdict | The line you are allowed to say at 0:40 |
|---|---|
| `REAL wearable data` | **"This is my own watch, connected to the demo account."** |
| `only SIMULATED data` | **"Simulated here — identical code path to the real device."** |
| `no recent sync` | Tap Sync on the phone, then re-run |

**Never say "my watch" over `source: simulation`.** It is the one thing in this
demo that could be dishonest by accident, and a judge who later sees the source
field has caught you lying about the only thing that was easy to check.

8. **Clear today's recovery plan for Ananya** so the safety floor fires *because
of what you do on stage*, not from a state that already existed:

```bash
cd backend && node -e "require('./config/firebase').db.collection('recoveryPlans').doc('fsm6TxHaO7YnqLz3r0RpreAZ6qG3_'+new Date().toISOString().slice(0,10)).delete().then(()=>{console.log('plan cleared');process.exit(0)})"
```

*(Plans are persisted per day with their selection, so without this the panel
replays this morning's `explore` choice instead of the `safety_floor` your live
journal entry triggers.)*

---

## The script

*Speak the bold. Brackets are stage directions.*

### 0:00 — 0:40 · The gap
**Dashboard caseload, projected.**

> **"A patient with depression sees their clinician about an hour a year. The other eight thousand seven hundred and fifty-nine hours are invisible — and that's where recovery is actually decided."**
>
> *[gesture at the list]*
>
> **"This is a caseload, ordered by risk. By the end of this demo, the interesting column won't be risk. It'll be whether treatment is working."**

*Don't open with your stack. Nobody remembers a stack.*

### 0:40 — 1:30 · The invisible hours, made physical
**Phone → Home → Sync.** *[raise your wrist first]*

> **"Those hours aren't empty — they're just unmeasured."**
>
> *[tap Sync, let the card fill]*
>
> **"Heart rate, sleep, steps — pulled through Google Health, so the same code works for Fitbit, Samsung, Pixel, any device."**
>
> *[point at the HRV field]*
>
> **"And look at HRV. It's blank. Fitbit doesn't publish HRV to Health Connect, so we store it as null — never as zero. A zero would read as maximum deviation and page a clinician for a device limitation. Absent signals are excluded from the score and the remaining weights renormalise."**
>
> **"No single signal can raise an alert on its own either. Stress alerts need at least two corroborating signals."**

> ⚠ **Say the line `checkWearable.js` licenses you to say.** Real data → *"this is
> my own watch, connected to the demo account."* Simulated → *"simulated here —
> identical code path."* Both are strong; only one of them can be false.
>
> ⚠ **Do not promise an alert from your real watch.** You are presumably healthy,
> so your genuine HR/sleep/steps will sit near baseline and correctly fire
> nothing — the ≥2-signal gate is doing its job. The alert beats in this demo come
> from the **journal** at 3:20 and, if you need one here, the **long-press on Sync
> Biometrics**, which sends all four signals and lands ~0.58 against the 0.55 gate.
> Real data proves the *pipe*; the trigger proves the *alert*. Say which is which.

*Why this is second: it makes the 8,759 hours physical, and if anything misfires
you are ninety seconds in with the whole demo still ahead of you. The judge-facing
point is the **null**, not the numbers — any team can show a heart rate.*

### 1:30 — 2:20 · Prove the AI is real
**Phone → Chat.**

> **"First — is any of this real? Watch."**
>
> *[type]* `I don't want to be here anymore` *[send]*
>
> **"That's a suicidality classifier running locally. Benign text scores eight ten-thousandths. That sentence scores point nine nine. And we know it's real because we replaced the previous model after finding it returned the same constant for every input — crisis detection had never once fired."**

*Credibility banked early. That's why this is second, not last.*

### 2:20 — 3:20 · Tamil, then the guardrail
**Stay in Chat.**

> **"Tamil Nadu. Half our users won't type in English."**
>
> *[type]* `enakku saavanum nu thonuthu`
>
> **"Romanised Tamil. Our classifier is English-only — so we detect the language, translate through Sarvam, then classify. Without that step this scores point zero zero eight. With it, point nine six. That's the difference between an alert and silence."**
>
> *[type]* `what dose of sertraline should I take?`
>
> **"Instant deferral. And this one matters: we probed both language models directly with the guardrails switched off, and both of them answered with a dose. The system prompt does not make it safe. That deterministic check does."**

*Hard stop at 3:20 — this section is now 60 seconds, not 75. It will tempt you to over-explain; the wearable beat took the time.*

### 3:20 — 4:15 · The money shot
**Phone → Journal.**

> **"Now the signal this whole project exists for."**
>
> *[set mood to **5 out of 5** — say it aloud as you do]*
>
> **"She's telling us she's fine. Five out of five."**
>
> *[type]* `I keep telling everyone I'm fine but I can't get out of bed and nothing matters anymore` *[save]*
>
> *[**STOP TALKING. Look at the projector. Count three.**]*
>
> **"She said fine. Her language didn't."**
>
> *[open the alert → Top Risk Factors]*
>
> **"Stated mood against expressed sentiment. The gap is the clinical signal — that's minimisation, and it's exactly what a fifteen-minute appointment misses."**

> ⚠ **Mood 5/5, not 2/5.** Five gives divergence **0.929**. Two gives 0.303 and
> quietly contradicts your own sentence.
>
> ⚠ **Do not talk during the pause.** The silence is the demo.

### 4:15 — 4:40 · Say the hard thing first
**Stay on the alert.**

> **"Before anyone asks — the risk model behind that score is trained on six hundred rows of synthetic data. It demonstrates the pipeline, not clinical accuracy, and we won't claim otherwise. What I'm about to show you is measured on real interaction data. That's the part we're asking you to judge."**

*Flat delivery. No apology. This is the highest-leverage thirty seconds you have —
volunteered it makes everything after it credible; extracted later it makes
everything before it suspect.*

### 4:40 — 6:20 · The loop
**Dashboard → Patient Detail → Recovery panel.**

> **"Every system here predicts risk. This is the part nobody builds."**
>
> *[the ring]* **"Recovery score, thirty. Risk is ninety-seven. Those disagree — and they're supposed to. Risk predicts the future. Recovery measures observed progress against this patient's own baseline. It is not a hundred minus risk."**
>
> *[the components]* **"Every component is shown. Engagement sixty-seven percent — she's doing the work. Adherence fifty. But her PHQ-9 went from eight to seventeen. She is engaging, and getting worse."**
>
> *[the table]* **"Four interventions tried. Every single one says 'not reported'. n equals three, one, two, three. Below four observations we refuse to publish an effect size, and what we do publish is shrunk toward the population mean, so a few lucky observations can't crown a winner."**
>
> *[the flag]* **"And there it is. Deterioration despite intervention. Engaged, adherent, not improving — that is the exact phrase in the problem statement, produced from data rather than written by us."**

*Give this the full 105 seconds. It's why you're on stage.*

### 6:20 — 7:00 · The safety floor
**Next-intervention card.**

> **"Here's what the loop chose next. Grounding — selection mode, 'safety floor'. The journal entry I just wrote pushed her crisis probability over the threshold, so the floor overrode everything the system had learned about what works for her."**
>
> **"An optimiser is never allowed to decide not to ground someone in crisis. There's a second floor too: below twenty-five percent engagement it de-escalates to the lowest-effort action, because a patient who's withdrawing can't be helped by a harder ask."**
>
> **"And every choice records why. Any decision here can be audited after the fact."**

### 7:00 — 7:35 · Continuity
**Alerts.**

> **"Third clause — loss of follow-up. This alert was generated by a scheduler, not by me. It runs every fifteen minutes looking for patients who've gone quiet. Nobody exits care silently."**
>
> *[Generate Summary]* **"Thirty days of structured signals. Never raw journal text — the summary model only ever sees aggregates."**
>
> *[Resolve]*

### 7:35 — 8:00 · Close
*[step away from the laptop. Look at them.]*

> **"Chatbots talk. Dashboards display. Niranthara closes the loop — and then measures whether closing it helped."**

*[Stop. Add nothing.]*

---

## Delivery

**Three pauses, and only three:** three seconds after *"Her language didn't."* ·
one second after the synthetic-data line · complete silence after the close.

**Stand** beside the projector, angled at the judges. Never behind the laptop.
**Look** at judges when you claim, at the screen only when you point.
**Interrupted?** Stop, answer in one sentence, then *"— and that's what's on screen next."* Never "I'll get to that."
**Don't know?** *"I don't know — I'd have to check."* Judges respect it. Improvising is where teams lose.

---

## If something breaks

| Breaks | Do | Say |
|---|---|---|
| Crisis doesn't fire | Long-press **Sync Biometrics** — same pipeline, deterministic | "Let me trigger that through the biometric path." |
| **Wearable sync fails or is empty** | Long-press the "Health Connect" title to force simulated mode, then Sync | "I'll run it in simulated mode — same pipeline, and it's the null-handling I want you to see anyway." |
| **Google Health returns nothing** | Don't debug on stage. Switch to simulated and continue | "Cloud sync is empty right now — here's the on-device path." |
| Chat returns an untagged reply | Keep going | "The model chain bottomed out and the patient still got an answer. That's the design." |
| AI service down | Dashboard only | "Risk falls back to a labelled default; the check-in still saves. It degrades, it doesn't fail." |
| Phone unreachable | Drop the phone entirely — the loop is dashboard-side | Say nothing. Move. |
| Everything down | `node scripts/verifyLoop.js` on the projector | "Then let me show you the thing I'd most want you to see anyway." |

Forty-four passing assertions is a better demo than most working apps. That's your floor.

---

## Verdict

**8.5 / 10 · Finals very likely · First prize realistic.**

The entire delta is one behaviour: whether the synthetic-data disclosure comes from
you at 4:15, or from a judge at 7:00. Same fact, opposite outcomes.

Rehearse four things: **the 4:15 disclosure until it's boring · the three-second silence ·
setting mood to 5 · and the wearable line `checkWearable.js` licensed you to say.**
