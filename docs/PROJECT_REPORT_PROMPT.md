# Niranthara — Project Report Generation Prompt
### Anna University format · Niral Thiruvizha 3.0 submission

Paste the prompt below into a fresh Claude conversation. It produces a complete
project report in the Anna University Chennai 600 025 format, adapted for a
**Niral Thiruvizha 3.0 innovation-challenge submission** rather than a degree award.

> **The one format deviation, stated up front:** the standard Anna University
> Bonafide Certificate certifies work submitted *"in partial fulfilment for the
> award of the degree"*. This report is **not** a degree submission, so the
> certificate and title page are reworded to certify the work as a Niral
> Thiruvizha 3.0 entry. Every other element — page order, fonts, spacing,
> reference style, appendix numbering — follows the university format exactly.

---

## The prompt

> Write a complete **project report for Niral Thiruvizha 3.0** following the
> **Anna University, Chennai 600 025 format for preparation of project reports**.
> This is an innovation-challenge submission, **not** a B.E./B.Tech degree
> submission — so the title page and certificate must certify the work as a
> Niral Thiruvizha 3.0 entry, **not** "in partial fulfilment for the award of the
> degree". Keep every other formatting rule from the university specification.
>
> ### Formatting rules (follow exactly)
> - Font throughout: **Times New Roman**. General text **size 14**, line spacing **1.5**.
> - Abstract and Bonafide Certificate: **double** line spacing, Times New Roman 14.
> - Table of Contents, List of Tables, List of Figures, List of Symbols: **1.5** spacing.
> - References: typed 4 spaces below the heading **REFERENCES**, **alphabetical by
>   first author**, **single** spacing, left-justified, author names immediately
>   followed by year. Use this exact style:
>   `Ariponnammal, S. and Natarajan, S. (1994) 'Transport Phonomena of Sm Sel – X Asx', Pramana – Journal of Physics Vol.42, No.1, pp.421-425.`
> - Page size **A4**. Front matter (Abstract onward) numbered in **lower-case Roman**;
>   main chapters in Arabic numerals. Title page and Bonafide Certificate are **not**
>   listed in the Table of Contents, though their page numbers are Roman.
> - Appendices numbered **Appendix 1, Appendix 2, …**; each carries the title of the
>   work reported, and the same title appears in the contents page.
> - Tables are tabulated numerical data; all other non-verbal material (charts,
>   diagrams, screenshots, graphs) are **Figures**. Captions **above** tables and
>   **below** figures, and the Lists must reproduce those captions verbatim.
> - Place each table and figure in the immediate vicinity of the text citing it.
> - Footnotes used sparingly, single-spaced, at the foot of the citing page.
>
> ### Arrangement (in this order)
> 1. Cover Page & Title Page 2. Bonafide Certificate 3. Abstract
> 4. Table of Contents 5. List of Tables 6. List of Figures
> 7. List of Symbols, Abbreviations and Nomenclature 8. Chapters
> 9. Appendices 10. References
>
> **Title page** — centred, Times New Roman Bold, following the university specimen:
> project title (size 18, 1.5 spacing) / "A PROJECT REPORT" (14) / "Submitted by"
> (14, italic) / candidate names (16) / "submitted to **NIRAL THIRUVIZHA 3.0**"
> (14, italic) / department and college (14) / "ANNA UNIVERSITY REGIONAL CAMPUS,
> TIRUNELVELI" (14) / "AUGUST 2026" (14).
>
> **Bonafide Certificate** — reworded for the challenge, retaining the university's
> layout, the double spacing and the capitalised term SUPERVISOR between the
> supervisor's name and academic designation:
> *"Certified that this project report 'NIRANTHARA — AI-POWERED CONTINUITY OF
> MENTAL HEALTH CARE' is the bonafide work of '<names>' who carried out the project
> work under my supervision, submitted to Niral Thiruvizha 3.0."*
> Two signature blocks side by side: HEAD OF THE DEPARTMENT and SUPERVISOR, each
> with name, academic designation, department and full address of the institution.
> Leave the names as clearly-marked placeholders for me to fill in.
>
> ### Project subject matter
>
> **Niranthara** is an AI mental-health *continuity* platform: it monitors
> depression risk between clinical appointments, delivers just-in-time adaptive
> interventions (JITAI), and closes the loop back to a clinician dashboard with
> real-time risk intelligence. The thesis: a patient sees a clinician for roughly
> **one hour a year**; the other **8,759 hours** are clinically invisible.
> Chatbots talk, dashboards display — Niranthara closes the loop.
>
> **Architecture — five independently-run services:**
>
> | Service | Stack | Port | Role |
> |---|---|---|---|
> | `mobile-app/` | React Native 0.81, Expo SDK 54 | — | Patient app, offline-first |
> | `backend/` | Node 20, Express 5, Firebase Admin, node-cron | 5000 | Orchestration, auth, encryption, schedulers |
> | `ai-service/` | Python 3.11, FastAPI, PyTorch, XGBoost, HuggingFace | 8000 | All ML/NLP inference |
> | `dashboard/` | React 19, Vite 8, Firebase Web SDK | 5173 | Clinician portal, live alerts |
> | Firestore | Google Cloud | — | Integration bus between services |
>
> The backend is a pure orchestration layer: it owns authentication, AES-256-GCM
> encryption and Firestore writes, and proxies every ML call to the AI service
> through a single Axios client. Firestore is the integration bus — the dashboard
> reacts to writes via `onSnapshot` rather than polling the backend.
>
> **Machine-learning inventory — state each model, its input, and its output:**
>
> | Purpose | Model | Note |
> |---|---|---|
> | Depression risk score | XGBoost, 15 features, 4-class | Explained by SHAP |
> | Crisis / suicidality detection | `sentinet/suicidality` (ELECTRA) | Fine-tuned classifier |
> | Sentiment (Tamil / Tanglish / English) | XLM-R sentiment (`ai4bharat/indic-bert`) | Code-mixed input |
> | Emotion (7-class) | `j-hartmann/emotion-english-distilroberta-base` | |
> | Menstrual-cycle vulnerability | Per-user personalised LSTM | Opt-in signal |
> | Biometric anomaly | Per-user LSTM autoencoder | Behavioural manifold |
> | Disengagement / dropout | XGBoost classifier | Loss-of-follow-up |
> | Conversational agent | NVIDIA-hosted chain: `meta/llama-3.1-8b-instruct` primary → `nvidia/nemotron-3-super-120b-a12b` backstop → static fallbacks | Latency-first |
> | Tamil speech-to-text | Sarvam AI `saarika:v1` | |
>
> **Design principle to state explicitly and defend in the report:** every clinical
> decision comes from a trained model. Rule-based branches exist only as network
> fallback paths and are explicitly labelled as such. There is **no keyword matching
> for crisis detection** and **no hardcoded clinical threshold**.
>
> **The two pipelines that define the system — describe each as a numbered
> sequence with a figure:**
>
> 1. **Mood check-in → clinician alert.** Encrypt journal (AES-256-GCM) → parallel
>    NLP (sentiment, emotion, crisis) → compute mood–sentiment divergence →
>    retrieve cycle vulnerability (LSTM) → assemble XGBoost feature vector →
>    write `moodLogs`, update `users.riskLevel` → if crisis, write a
>    `clinicianAlerts` document, which the dashboard receives in about one second.
> 2. **Conversation.** Mobile chat → backend enriches the message with live user
>    context and recent turns → AI service runs the crisis classifier, detects
>    language, calls the NVIDIA model chain → deterministic two-tier medication
>    guardrails (input-side deferral and output-side interception) → reply.
>
> **Signature contribution — give this its own chapter section.** *Emotional
> suppression detection*: the system compares **stated mood** (a 1–5 self-report)
> against **expressed sentiment** (NLP over the free-text journal) and treats the
> divergence between them as a first-class clinical signal. A patient who rates
> their mood 4/5 while writing language that scores strongly negative is
> minimising — the single hardest thing to catch in episodic care. Frame it as:
> *"She said she was fine. Her language said otherwise."*
>
> **Inclusivity design decision — state it as a deliberate architectural choice.**
> The platform serves everyone, not only women. Gender is **asked during
> onboarding, never inferred**, and menstrual-cycle tracking is an **opt-in
> signal** resolved through a single predicate. Users who do not track a cycle
> never see a cycle tab, ring, or nudge, and the client does not even request
> cycle data for them.
>
> **Security and compliance:** AES-256-GCM encryption of journal text and chat
> messages before they reach Firestore; Firebase JWT verification on every
> protected route; no raw GPS coordinates stored; DPDP Act 2023 data export and
> deletion; crisis routing to Tele-MANAS 14416 and NIMHANS 080-46110007.
>
> ### Chapter structure to produce
>
> 1. **INTRODUCTION** — 1.1 General · 1.2 The continuity gap in mental health care
>    · 1.3 Problem statement · 1.4 Objectives · 1.5 Scope · 1.6 Organisation of the report
> 2. **LITERATURE REVIEW** — 2.1 General · 2.2 Digital mental-health interventions
>    · 2.3 Passive sensing and digital phenotyping · 2.4 NLP for crisis detection
>    · 2.5 Just-in-time adaptive interventions · 2.6 Explainable ML in clinical
>    decision support · 2.7 Research gap identified
> 3. **SYSTEM ANALYSIS** — 3.1 Existing system and its limitations · 3.2 Proposed
>    system · 3.3 Feasibility study (technical, economic, operational)
>    · 3.4 Requirement specification (functional, non-functional, hardware, software)
> 4. **SYSTEM DESIGN** — 4.1 Architectural design · 4.2 Data-flow diagrams
>    (Level 0 and Level 1) · 4.3 Use-case diagram · 4.4 Sequence diagrams for both
>    pipelines · 4.5 Database schema (Firestore collections) · 4.6 User-interface design
> 5. **MACHINE LEARNING METHODOLOGY** — 5.1 Feature engineering · 5.2 XGBoost risk
>    model **(state explicitly: trained on a 600-row synthetic dataset; the
>    section must not report accuracy as clinical performance)** · 5.3 SHAP
>    explainability · 5.4 NLP pipeline · 5.5 Personalised LSTM models
>    · 5.6 Model-chain fallback strategy · **5.7 Outcome learning: shrunk
>    per-intervention effectiveness (n·patient + 3·population)/(n+3), the n≥4
>    reporting threshold, and bounded exploration under two hard safety floors —
>    explicitly NOT reinforcement learning, and explicitly not claiming to be
>    exploration-free**
> 6. **IMPLEMENTATION** — 6.1 Development environment · 6.2 Mobile application
>    · 6.3 Backend orchestration · 6.4 AI service · 6.5 Clinician dashboard
>    · 6.6 Wearable integration via the Google Health API **(two ingest paths, one
>    pipeline; per-signal time windows; multi-source step deduplication; absent
>    signals stored as null, never zero)** · 6.7 Security implementation
>    · **6.8 The Recovery Engine — recovery score as a labelled weighted
>    composite with every component exposed and weights renormalised over present
>    signals, residual-symptom detection at PHQ-9 item level, plateau detection
>    from an OLS slope, and the daily plan derived from both**
> 7. **RESULTS AND DISCUSSION** — 7.1 Functional outcomes · 7.2 Model behaviour and
>    measured latency · 7.3 Crisis-classifier validation **(include the four-input
>    probe method and why it matters: two models in this project were found
>    returning a near-constant score because the checkpoint had no trained
>    classification head)** · 7.4 Screenshots with discussion · **7.5 End-to-end
>    verification — the 44-assertion `verifyLoop.js` guard and what each named
>    regression test protects** · 7.6 Limitations **(synthetic training data,
>    confounded effect estimates, no guaranteed human response to a crisis alert,
>    PHI reaching the LLM vendor in plaintext)**
> 8. **CONCLUSION AND FUTURE WORK** — 8.1 Conclusion · 8.2 Contributions
>    · 8.3 Future enhancements
>
> ### Appendices
> - **Appendix 1** — Sample source code (key modules, clearly excerpted)
> - **Appendix 2** — API endpoint specification
> - **Appendix 3** — PHQ-9 and GAD-7 instruments as administered
> - **Appendix 4** — Budget and grant utilisation plan (I will supply this; leave a
>   clearly-marked placeholder section with the table structure ready)
>
> ### Writing instructions
> - Write **real technical prose**, not placeholders or lorem ipsum. Where a number
>   would be invented, write `[MEASURED VALUE]` in square brackets so I can fill it
>   in — **never fabricate an accuracy, F1 score, user count, or trial result.**
> - Number every table and figure (Table 4.1, Figure 4.2, …) and produce the List of
>   Tables and List of Figures with captions matching the body **exactly**.
> - Populate the List of Symbols, Abbreviations and Nomenclature with the real ones:
>   JITAI, SHAP, LSTM, NLP, PHQ-9, GAD-7, HRV, RMSSD, AES-GCM, JWT, DPDP, API, REST.
> - Include at least **20 references** in the exact style shown above, alphabetical
>   by first author. Prefer genuine, well-known works in digital phenotyping, JITAI,
>   PHQ-9 validation, XGBoost, SHAP, and clinical NLP. **Mark any reference you are
>   not fully certain of with `[VERIFY]`** so I can check it before submission.
> - Describe diagrams precisely enough that I can draw them, and supply each as a
>   Mermaid code block I can render.
> - Target 60–80 pages of body content.
>
> Produce the report as a single Markdown document with clear page-break markers,
> so I can paste it into Word and apply the Times New Roman 14 / 1.5-spacing styles.

---

## After generating

1. Paste into Word, then apply: Times New Roman 14, line spacing 1.5 for general
   text; double spacing for Abstract and Bonafide Certificate; single spacing for
   References.
2. Set front matter to lower-case Roman page numbers, main body to Arabic.
3. Replace every `[MEASURED VALUE]` and check every `[VERIFY]` reference.
4. Insert real screenshots as numbered Figures with captions **below** them.
5. Paste the budget table into Appendix 4.
