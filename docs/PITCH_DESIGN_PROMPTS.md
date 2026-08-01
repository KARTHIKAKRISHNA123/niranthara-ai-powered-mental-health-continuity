# Niranthara — Pitch Day Design Prompts

Three ready-to-paste prompts for Claude (claude.ai → "Create an artifact" / Claude Design).
All three share the same design system so the deck, the poster and the summary read as one
brand. **Paste one prompt per conversation** — they are long on purpose; splitting them
across chats produces inconsistent output.

Everything below is drawn from `Build_Guide.md` §40 and `mobile-app/src/theme/theme.js`.

---

## Shared design system (already embedded in each prompt)

| Token | Hex | Role |
|---|---|---|
| Rose | `#C97B84` | primary, CTAs |
| Rose Light | `#F2D9DC` | card backgrounds |
| Rose Dark | `#8B4A52` | headers, splash |
| Lavender | `#9B8EC4` | AI / secondary |
| Lavender Light | `#E8E4F4` | AI surfaces |
| Sage | `#7BA68A` | low risk, success |
| Sage Light | `#D6EAD9` | low-risk surfaces |
| Cream | `#FBF7F2` | background — **never pure white** |
| Warm White | `#FEFCFA` | card surfaces |
| Charcoal | `#2C2826` | all text |
| Warm Gray | `#8A8076` | muted text |
| Alert | `#E8634A` | crisis / high risk only |
| Warning | `#F0A830` | moderate risk only |

Type: **Cormorant Garamond** (300–400) for display, **DM Sans** (400/500) for everything else.
Radius: 8 / 16 / 24 / 32 / pill. Spacing scale: 4, 8, 12, 16, 24, 32, 48.

---

# 1 · Pitch deck (animated, 3D)

> Build me a self-contained HTML presentation deck for **Niranthara**, an AI mental-health
> *continuity* platform. Single HTML file, no external requests — inline all CSS and JS, embed
> fonts via Google Fonts `@import` only if it works offline-first, otherwise use system serif +
> sans stacks that visually match Cormorant Garamond and DM Sans.
>
> **Design system — follow exactly:**
> Colors: rose `#C97B84`, rose-light `#F2D9DC`, rose-dark `#8B4A52`, lavender `#9B8EC4`,
> lavender-light `#E8E4F4`, sage `#7BA68A`, sage-light `#D6EAD9`, cream `#FBF7F2` (background —
> never pure white), warm-white `#FEFCFA` (cards), charcoal `#2C2826` (text), warm-gray `#8A8076`
> (muted), alert `#E8634A` (crisis only), warning `#F0A830` (moderate only).
> Typography: Cormorant Garamond 300–400 for display headings (48–72px), DM Sans 400/500 for
> body (14–18px) and section labels (16px, weight 500). Border radius 8/16/24/32px. Generous
> whitespace — this is a calm, clinical product, not a startup hype deck.
>
> **Motion and 3D — the deck must feel alive:**
> - Slides transition with a subtle 3D perspective push (`transform: perspective(1400px)
>   rotateY()/translateZ()`), 500–650ms, `cubic-bezier(0.16, 1, 0.3, 1)`. Never bouncy.
> - Every slide staggers its own content in on entry (60–110ms apart, 18px rise + fade).
> - Cards lift on hover with a soft shadow and 2–4° tilt tracking the cursor.
> - Numbers count up when their slide becomes active.
> - One signature moment: an SVG ring that draws itself via `stroke-dashoffset`.
> - Respect `prefers-reduced-motion: reduce` — disable transforms, keep opacity fades.
>
> **Navigation:** arrow keys, on-screen prev/next, clickable dot indicator, and a slide counter.
> Keyboard focus states must be visible. Works at 1920×1080 projector and scales down to a laptop.
>
> **Slides:**
> 1. **Title** — "Niranthara" in Cormorant 72px on rose-dark, tagline "Chatbots talk. Dashboards
>    display. Niranthara closes the loop." Soft animated gradient mesh background, very slow drift.
> 2. **The problem** — a patient sees a clinician for roughly **1 hour a year**. The other
>    **8,759 hours** are invisible. Animate 8,759 counting up. This is the emotional hook.
> 3. **Why existing tools fail** — three cards: chatbots (no clinical loop), mood diaries (no
>    prediction), dashboards (no patient signal). Each card flips in 3D.
> 4. **What Niranthara does** — passive monitoring → risk prediction → just-in-time intervention
>    → clinician alert. Animated horizontal flow with a pulse travelling along the connectors.
> 5. **Architecture** — 5 services: React Native app, Express orchestration, FastAPI ML service,
>    Firestore as integration bus, clinician React dashboard. Draw as an isometric 3D layered
>    diagram; layers separate slightly on hover.
> 6. **The ML stack** — XGBoost + SHAP (risk & explainability), sentinet/suicidality (crisis
>    classification), IndicBERT (Tamil/Tanglish sentiment), distilroberta (emotion), personalised
>    per-user LSTM (cycle vulnerability), LSTM autoencoder (biometric anomaly). Emphasise: *every
>    clinical decision comes from a trained model — zero keyword matching, zero hardcoded
>    thresholds.*
> 7. **The signature insight** — "Emotional suppression detection". Show two bars: STATED mood vs
>    EXPRESSED sentiment, with the gap animating open. Caption: *"She said she was fine. Her
>    language said otherwise."* This is the slide that wins the room — give it the most space.
> 8. **Wearable integration** — Fitbit Charge 6 → Google Health API → weighted multi-signal
>    stress score (HR .30 / HRV .35 / steps .20 / sleep .15), renormalised over signals actually
>    present. Note that absent signals stay null, never zero — a real engineering decision that
>    prevents false alerts.
> 9. **Safety architecture** — two-tier deterministic guardrails around the LLM, AES-256-GCM
>    encryption of journals and chat before storage, DPDP-Act delete/export, crisis routing to
>    Tele-MANAS 14416. Frame safety as a floor under the model, not a replacement for it.
> 10. **Inclusive by design** — gender-aware onboarding; cycle tracking is an opt-in signal, not
>     the shape of the product. Show the same home screen for a user who tracks a cycle and one
>     who doesn't.
> 11. **Live demo** — a single full-bleed slide reading "Demo" with a slow breathing animation.
> 12. **Impact & roadmap** — India: ~0.75 psychiatrists per 100,000 people. Niranthara multiplies
>     clinician reach instead of replacing clinicians. Roadmap: Web Push, multi-clinician triage,
>     regional language expansion.
> 13. **Close** — repeat the tagline, large, on rose-dark, with a slow fade of the ring motif.
>
> Keep body copy to at most 25 words per slide — the speaker carries the narrative. No emoji
> anywhere. No stock-photo placeholders; build all visuals from CSS and inline SVG.

---

# 2 · Pitch-day poster

> Design a single-page **A1 portrait poster (594 × 841 mm)** for **Niranthara**, an AI
> mental-health continuity platform, as a self-contained HTML file sized with CSS `@page` and mm
> units so it prints correctly at 300 DPI. No external requests — inline everything.
>
> **Design system — follow exactly:** [same palette and typography block as the deck: rose
> `#C97B84`, rose-light `#F2D9DC`, rose-dark `#8B4A52`, lavender `#9B8EC4`, lavender-light
> `#E8E4F4`, sage `#7BA68A`, sage-light `#D6EAD9`, cream `#FBF7F2` background — never pure white,
> warm-white `#FEFCFA` cards, charcoal `#2C2826` text, warm-gray `#8A8076` muted, alert `#E8634A`,
> warning `#F0A830`. Cormorant Garamond display, DM Sans body. Radius 8/16/24/32.]
>
> A poster is read from 2 metres away and then from 40 cm. Build both distances:
>
> **From 2 m — the hook must land without reading anything:**
> - Title "Niranthara" in Cormorant Garamond, ~140pt, rose-dark.
> - Subtitle: "AI-powered continuity of mental-health care" ~36pt DM Sans.
> - One enormous number: **8,759** — the hours a year a patient is *not* with their clinician.
> - The suppression graphic (STATED vs EXPRESSED bars with a visible gap) as the dominant visual.
>
> **From 40 cm — the substance:**
> - Three-column grid below the hero.
> - **Column 1 — The problem:** treatment gap statistics for India, why episodic care misses
>   deterioration, what "loss of follow-up" costs.
> - **Column 2 — The system:** a clean architecture diagram (mobile → Express orchestration →
>   FastAPI ML → Firestore → clinician dashboard) plus the ML inventory (XGBoost + SHAP,
>   sentinet/suicidality, IndicBERT, distilroberta, per-user LSTM, LSTM autoencoder). Add a compact
>   "how a check-in becomes an alert" numbered pipeline: encrypt → NLP → divergence → cycle
>   vulnerability → XGBoost → alert.
> - **Column 3 — Results & safety:** the multi-signal wearable stress score with its weights,
>   the two-tier LLM guardrails, AES-256-GCM at rest, DPDP compliance, crisis routing to
>   Tele-MANAS 14416, and the inclusivity note (cycle tracking is opt-in; the platform serves
>   everyone).
> - A footer strip: institution, team, and a QR-code placeholder box labelled "Live demo"
>   (draw the placeholder as a bordered square — do not fabricate a scannable code).
>
> Use rose-light and sage-light card fills to separate sections. Thin rose rules between columns.
> Charts and diagrams as inline SVG only. No emoji, no stock imagery, no lorem ipsum — write
> real, specific copy. Ensure every text/background pairing meets WCAG AA contrast.

---

# 3 · Project summary (one-pager)

> Create a **colourful, information-dense one-page project summary** for **Niranthara** as a
> self-contained, responsive HTML artifact. It should work as a leave-behind for judges: skimmable
> in 30 seconds, complete in three minutes. Screen-first, but must print cleanly to A4 portrait.
>
> **Design system — follow exactly:** [same palette and typography block as above.]
>
> **Structure:**
> 1. **Header band** — rose-dark background, "Niranthara" in Cormorant Garamond, tagline
>    "Chatbots talk. Dashboards display. Niranthara closes the loop.", and a one-sentence
>    description: an AI platform that monitors depression risk between appointments and closes
>    the loop back to the clinician.
> 2. **The gap** — a compact hero stat row: 1 hour of care a year vs 8,759 unmonitored hours;
>    India's psychiatrist ratio; the dropout problem. Animated count-up on scroll into view.
> 3. **How it works** — a five-step horizontal pipeline with icons drawn as inline SVG:
>    passive signals → NLP + ML risk scoring → SHAP explanation → just-in-time intervention →
>    clinician alert. Each step gets one sentence.
> 4. **Feature grid** — 6–8 cards, each with a title, one line of plain English, and a small
>    monospace tag naming the model behind it:
>    daily check-in with encrypted journalling (`IndicBERT · distilroberta`), crisis detection
>    (`sentinet/suicidality`), explainable risk score (`XGBoost + SHAP`), emotional-suppression
>    detection (`mood–sentiment divergence`), cycle vulnerability (`per-user LSTM`, opt-in),
>    wearable stress score (`Google Health API`), AI companion chat (`NVIDIA model chain`),
>    clinician dashboard with live alerts (`Firestore onSnapshot`).
> 5. **The differentiator** — a highlighted lavender-light panel on emotional-suppression
>    detection, with the STATED vs EXPRESSED bar graphic and the line *"She said she was fine.
>    Her language said otherwise."*
> 6. **Architecture at a glance** — a small, clean five-service diagram with the tech stack
>    labelled per service (React Native/Expo · Node 20/Express 5 · Python 3.11/FastAPI/PyTorch ·
>    Firebase Firestore · React 19/Vite).
> 7. **Safety & privacy strip** — sage-light band: AES-256-GCM encryption of journals and chat,
>    deterministic medication-dosing guardrails on both input and output, no raw GPS storage,
>    DPDP-Act export and delete, crisis routing to Tele-MANAS 14416.
> 8. **Inclusivity note** — one short paragraph: Niranthara serves everyone; gender is asked, not
>    assumed, and cycle tracking is an opt-in signal that never appears for users it doesn't apply to.
> 9. **Footer** — team, institution, repository placeholder.
>
> Colour is the organising principle: rotate rose-light / lavender-light / sage-light card fills
> so the eye can navigate by hue, but keep all body text charcoal on cream or warm-white for
> contrast. Subtle entrance animations on scroll (fade + 16px rise, staggered), disabled under
> `prefers-reduced-motion`. Responsive down to 375px — cards stack, nothing scrolls horizontally.
> No emoji. Write real copy, not placeholders.

---

## Using these

1. Open a fresh Claude conversation per prompt.
2. Paste the prompt including the design-system block (it is repeated in each on purpose).
3. Ask for revisions by section — "redo slide 7 with the gap 2× wider" — rather than
   regenerating the whole artifact.
4. For the deck, test on the actual projector resolution before pitch day.
