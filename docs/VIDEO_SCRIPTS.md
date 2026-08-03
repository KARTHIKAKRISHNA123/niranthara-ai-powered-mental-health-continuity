# Niranthara — Video Scripts
**Explainer (2:40) + Journey (1:50).** Read the VO aloud with a timer before you record.

> **A note on style.** I don't have reliable knowledge of Achinna Mayya's specific
> delivery on Aevy TV, and I'd rather not fake an imitation and label it as hers.
> What I've written to instead, which is the common spine of that kind of Indian
> explainer channel:
> - **hook in the first five seconds**, usually a number or a contradiction
> - **second person**, conversational, spoken not written
> - **short sentences.** Frequent full stops. Almost no subordinate clauses
> - **concrete over abstract** — never "leverages AI", always "scores 0.99"
> - one **"but here's the thing"** turn in the middle
> - ends on a **reframe**, not a summary
>
> If she does something specific you want — a signature open, a pacing trick, a
> recurring phrase — tell me and I'll rewrite to it.

---

# VIDEO A · EXPLAINER (2:40)

Screen recording + voiceover. No face needed. Record VO first, cut picture to voice.

---

### 0:00 — 0:18 · The hook
**On screen:** black → the clinician caseload fading in.

> **"A person with depression sees their doctor for about one hour a year."**
>
> *(beat)*
>
> **"There are eight thousand seven hundred and fifty-nine other hours in that year. Nobody is watching those. And that's where people actually get worse."**
>
> **"This is Niranthara. It watches the other hours."**

---

### 0:18 — 0:45 · Prove the AI is real, immediately
**On screen:** phone, Chat tab. Type the sentence live. Let the reply land.

> **"First question you should ask: is any of this actually AI, or is it just checking for sad words?"**
>
> *(typing on screen)*
>
> **"This is a suicidality classifier running on our own server. Normal text scores zero point zero zero zero eight. That sentence scores zero point nine nine."**
>
> **"No keywords. It reads the sentence."**

---

### 0:45 — 1:10 · Tamil
**On screen:** type `enakku saavanum nu thonuthu`.

> **"Now watch this. That's Tamil, written in English letters. Half of India types like this."**
>
> **"Our classifier only understands English. So we detect the language first, translate it, and then classify."**
>
> **"Without that step, this scores zero point zero zero eight. With it, zero point nine six."**
>
> **"That is the difference between an alert and silence."**

---

### 1:10 — 1:50 · The money shot
**On screen:** Journal. Set mood to **5/5** visibly. Type the entry. Save. **Hold on the dashboard in silence for three full seconds** as the alert appears.

> **"Here's the part I want you to watch closely."**
>
> **"She's rating her mood five out of five. She's telling us she's fine."**
>
> *(typing)* **"And this is what she writes."**
>
> *(SILENCE — 3 seconds — alert lands)*
>
> **"She said fine. Her language didn't."**
>
> **"That gap — between what someone reports and what their words carry — is minimisation. It's the thing a fifteen-minute appointment misses most often."**

---

### 1:50 — 2:25 · The loop
**On screen:** dashboard → Recovery panel. Move slowly: ring → components → table → flag.

> **"But detecting that she's struggling isn't the hard part. Every app does detection."**
>
> **"Here's the part nobody builds."**
>
> **"Her risk score is ninety-seven. Her recovery score is thirty. Those disagree — and they're supposed to. One predicts the future. The other measures what's actually happened."**
>
> **"She's engaging with sixty-seven percent of what we send her. And her depression score went from eight to seventeen. She's doing the work, and getting worse."**
>
> **"Look at this column. Four interventions tried, and next to every one it says 'not reported'. Because we've only measured two or three of each. Below four, we refuse to publish a number."**
>
> **"And then it says this: deterioration despite intervention."**

---

### 2:25 — 2:40 · The honest close
**On screen:** hold the clinical flag. Then cut to black.

> **"One thing we'll say plainly: our risk model is trained on synthetic data. It proves the pipeline works. It is not clinical accuracy, and we won't pretend otherwise."**
>
> **"What is real is everything you just watched measured — the engagement, the mood change, the trajectory."**
>
> *(beat)*
>
> **"Chatbots talk. Dashboards display. Niranthara closes the loop — and then measures whether closing it helped."**

---

**Runtime check:** ~415 words. At a natural explainer pace (~155 wpm) that lands
at 2:40 with the silences. If you overrun, cut the Tamil section to two lines —
never the three-second silence.

---

# VIDEO B · JOURNEY (2:00) — TWO HOSTS

### The pitch, in one line
> *"We built a system to detect depression. Then we discovered it had never once worked — and fixing that honestly became the product."*

## Casting the two roles

Do **not** split one monologue into alternating lines. It reads as two people
reciting, and an audience feels it within ten seconds. Give each person a
standing reason to speak:

| | Role | Owns |
|---|---|---|
| **A** | The builder | The premise, the ambition, what changed afterwards |
| **B** | The one who broke it | The tests, the discoveries, the uncomfortable numbers |

A is telling the story. **B keeps interrupting it with evidence.** That tension is
the video. A is not the straight man — A is genuinely defending work they were
proud of, and B has the receipts. Play it that way and it stops being a script.

**Framing:** two-shot for the whole video, both on camera throughout. Cut to
single only for the two beats marked. Sitting is better than standing — this is a
confession, not a pitch.

---

### 0:00 — 0:20 · The premise
**Two-shot. A leads, relaxed.**

> **A:** "We started where everybody starts. Build something that notices when a patient is getting worse, and tell their doctor before it becomes a crisis."
>
> **A:** "We built it. Crisis detection, risk scoring, a clinician dashboard. It ran for months."
>
> **B:** *(flat)* "It did run for months."
>
> **A:** *(to B)* "…that's your setting-up voice."

Keep A's last line only if it lands naturally in the room. If it feels acted, cut
it — the flatness of B's line already does the work.

---

### 0:20 — 0:50 · The first discovery
**B takes over. A listens.**

> **B:** "I sat down to properly test the crisis classifier. Four sentences. One about eating rice. One where somebody says they want to end their life."
>
> *(beat)*
>
> **B:** "They scored the same."
>
> **A:** "Not similar. The same — to two decimal places."
>
> **B:** "The model we'd picked had no trained output layer. It was returning roughly one number for every sentence that had ever been typed into it."
>
> **A:** *(quietly)* "Which means our crisis detection had never fired. Not once. Not since the day we shipped it."

**CUT TO SINGLE on A for that last line.** It's the only moment in the video that
should feel heavy, and it should be the builder saying it, not the tester.

---

### 0:50 — 1:20 · It wasn't just one
**Back to two-shot. Pace picks up.**

> **B:** "So we stopped trusting everything at once."
>
> **B:** "The sentiment model had the identical defect. Flat score, every input. 'I am so happy today, everything is wonderful' — our system was calling that negative."
>
> **A:** "And the engagement metric read zero percent for every real user. Two halves of our own code disagreed about the name of a single field."
>
> **B:** "It only ever looked correct on demo data. Which is the worst possible way for something to be broken."
>
> **A:** "Because that's the version you show people."

---

### 1:20 — 1:45 · What changed
**A takes it back. This is A's recovery.**

> **A:** "That week changed how we build."
>
> **A:** "Every model now gets probed with four contrasting inputs before we trust a single number it produces. Every join between two parts of the system has a test that fails loudly."
>
> **B:** "Forty-four of them. They run in about a minute."
>
> **A:** "And when we don't have enough data to claim something, the app says so. On the clinician's screen. In plain words — 'insufficient evidence'."
>
> **B:** "We had to fight the instinct to put a number there anyway."

---

### 1:45 — 2:00 · The reframe
**Two-shot. Slow down. Neither of you rushes this.**

> **A:** "We didn't set out to build a system that admits what it doesn't know."
>
> *(beat — let it sit)*
>
> **B:** "But in mental health, that's the only kind worth building."

**Hold the two-shot for two seconds after B finishes.** Then cut to black. No
logo animation, no music swell.

---

## Directing notes

**The one thing that will ruin this:** dramatising it. No music sting on "they
scored the same." No zoom-in. No slow-motion. The facts are extraordinary on
their own, and the moment you score them like a thriller, a judge reclassifies
the whole thing as marketing.

**Overlap is good.** Let B come in slightly early on A's lines once or twice.
Two people who actually worked together interrupt each other. Perfectly clean
turn-taking is the tell that it's scripted.

**Nobody looks at the camera** except for the final line, and only if it feels
natural. Look at each other. You're telling *each other* a story the audience is
overhearing.

**Wardrobe/set:** anything, as long as it isn't a stage. A desk, a lab, a stairwell.
The content is polished enough that a polished setting tips it into corporate.

**Why this works as a startup journey video:** it has a genuine reversal, it costs
you nothing to admit because it's already fixed, and it converts your biggest
liability — synthetic training data, tiny sample sizes — into evidence of
judgment. Founders who can say "here is precisely where we were wrong" read as
more investable, not less. With two people, it also becomes *checkable*: one
person claiming rigour is a boast, two people describing the same failure is a
culture.

---

# Production notes

**Order:** write VO → record VO → capture screen while listening to your own VO →
cut picture to voice. Editing picture-first to an unspoken script is what makes
demo videos drag.

**Capture:** scrcpy for the phone (drive it from the laptop, no hands in frame),
OBS for scene-switching phone ↔ dashboard in one take.

**Edit:** DaVinci Resolve (free, no watermark) or CapCut (better auto-captions).
Hand-fix every clinical term — auto-caption will mangle *PHQ-9*, *Tanglish*,
*sertraline*.

**Two hard rules.** Native resolution, portrait for phone footage, never zoom in
post. And watch it once on mute before export — if it reads silent, it survives
a noisy hall.
