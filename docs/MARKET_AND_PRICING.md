# Dagar — Market Sizing & Monetisation

Fills the two gaps in PRD v1.0: §4 had TAM/SAM/SOM with no numbers, and no
monetisation model appeared anywhere.

> **Read this before quoting any figure.** These are *derived estimates* built from
> public Indian education data, not commissioned research. Every input is listed in
> the assumptions table with its confidence level. Verify the starred inputs against
> current UDISE+ / ASER releases before putting these in front of an investor or a
> CSR partner. The derivation chain matters more than the totals — if you swap one
> input, the arithmetic still holds.

Geography: **India only.** Currency: ₹, converted at **₹85 = $1**.

---

## 1. Market sizing

### TAM — all K-12 learners in India

Every school-going learner who could use personalised digital learning support.

| Input | Value |
|---|---|
| Students enrolled, Classes 1–12 (UDISE+, latest) * | ~248 million |
| Monetisable ARPU ceiling (see §2) | ₹500 / learner / year |
| **TAM** | **~248M learners · ₹12,400 Cr (~$1.46B)** |

### SAM — the curriculum and grades Dagar actually serves

Narrowed by the three constraints that genuinely gate the product: grade band,
curriculum alignment, and device access.

| Step | Filter | Learners |
|---|---|---|
| 1 | Upper-primary enrolment, Classes 6–8 * | ~65 million |
| 2 | × ~62% following NCERT or NCERT-aligned state curricula * | ~40 million |
| 3 | × ~75% with household smartphone access * | **~30 million** |
| | **SAM** | **~30M learners · ₹1,500 Cr (~$176M)** |

Step 2 matters because NCERT textbooks are used by CBSE and adopted or adapted by
a majority of state boards — the content asset is reusable well beyond CBSE.

Step 3 is the input most likely to be wrong in Dagar's favour. ASER has reported
household smartphone availability well above 85% for older school-age children;
75% is deliberately conservative, and *shared* device access is not the same as
usable access.

### SOM — realistically obtainable in 3 years

Dagar reaches underserved learners through institutions, not consumer marketing.
Direct-to-consumer acquisition spend is not available to a product whose users are
selected for being unable to afford tuition.

| Channel | Year 3 learners | Basis |
|---|---|---|
| NGO / CSR education programmes | ~150,000 | 15–25 partner orgs, 6–10k learners each |
| Government school pilots | ~75,000 | 2–3 district-level pilots |
| Direct to consumer | ~275,000 | Organic plus modest paid acquisition, aimed at parents in tier 2 and tier 3 cities |
| **SOM** | **~500,000 learners** | **≈ 1.7% of SAM** |

**Year-3 revenue at SOM:** ~₹11.6 Cr (~$1.36M ARR) — see §2.

### Why direct-to-consumer runs in parallel, not after

Institutional sales cycles run 6 to 18 months. A model with only that line has
a long silence before any revenue arrives, and no way to learn what a family
will actually pay. The consumer channel pays earlier, and it tests willingness
to pay against real money rather than a survey.

The two segments are genuinely different people. The institutional cohort is
reached *because* they cannot pay. The consumer cohort is a family in a tier 2
city who can find ₹99 a month but not ₹5,000 for a tutor. Selling to the second
funds the first, and the core lessons stay free for both.

**Marketing speaks to parents, never to children.** DPDP §9(3) forbids targeted
advertising directed at under-18s, and the entire user base is 11 to 14. This is
a constraint on the channel, not a reason to avoid it.

For a social-impact product, **learners reached is the honest headline metric** and
revenue is the sustainability constraint. Lead with 250,000 learners, not $1M ARR.

### Assumptions to verify

| # | Assumption | Confidence | Verify against |
|---|---|---|---|
| A1 | ~248M students enrolled Classes 1–12 | Medium-high | UDISE+ latest report |
| A2 | ~65M in Classes 6–8 | Medium | UDISE+ stage-wise enrolment |
| A3 | ~62% NCERT-aligned | **Low — weakest input** | State-board textbook adoption |
| A4 | ~75% household smartphone access, ages 11–14 | Medium | ASER latest |
| A5 | ₹500 blended ARPU ceiling | Medium | §2 pricing, once tested |
| A6 | 0.8% of SAM reachable in 3 years | Low | Partner pipeline |

A3 is the number to fix first — it swings SAM by roughly ±10 million learners.

---

## 2. Monetisation

### MVP: free, deliberately

The Buildathon MVP charges nothing. The objective is validating the hypotheses in
PRD §12 — no pricing experiment runs until H1–H7 have data. Charging now would
contaminate the activation and retention metrics that decide whether the product
works at all.

This is a **stated stage**, not an absence of a model.

### The constraint that shapes everything

Dagar's users are defined by inability to afford tuition. A consumer subscription
as the primary revenue engine contradicts the product's own targeting. So:

> **Learners never pay for the core learning loop. Institutions pay for reach;
> families pay only for depth.**

The free tier must stay genuinely useful — curriculum, lessons, practice, quizzes,
progress, streaks and parent summaries. Crippling it to drive conversion would
break the mission and the retention metrics simultaneously.

### Unit economics first

Pricing is bounded below by cost. From `DECISIONS.md` D11:

| Cost line | Per active learner / year |
|---|---|
| AI inference (verified: ~₹6.4/week at standard pricing, cached grounding, Haiku for batch) | ~₹330 |
| Infrastructure (Vercel, Supabase, messaging) at scale | ~₹40 |
| **Variable cost, fully active learner** | **~₹370** |
| Free-tier learner (AI capped at 10 tutor questions/day) | ~₹120 |

Any institutional price below **₹370/learner/year loses money** on active learners.
That floor is the single most important number in this document.

### Tiers (post-MVP)

| Tier | Price | Includes |
|---|---|---|
| **Dagar Free** | ₹0 | Full curriculum, micro-lessons, practice, quizzes, progress, streaks, milestones, parent summary. AI Tutor capped at 10 questions/day. |
| **Dagar Plus** | ₹99/mo · ₹799/yr | Unlimited AI Tutor, adaptive practice depth, revision plans, detailed parent insights. |
| **Dagar Mentor** | +₹299/mo | Plus 2 human mentor sessions/month. Gated on mentor supply — do not sell ahead of capacity. |
| **Dagar for Institutions** | ₹450–600/learner/yr | NGO, CSR and government licences. Cohort dashboards, reporting, bulk onboarding. **The scalable revenue engine.** |

Institutional volume pricing:

| Volume | Price / learner / year | Margin over ₹370 floor |
|---|---|---|
| < 5,000 | ₹600 | ₹230 |
| 5,000–25,000 | ₹450 | ₹80 |
| 25,000+ | ₹450 | ₹80 |

### Why the weight sits on institutions

Indian consumer edtech free→paid conversion runs roughly 2–5%; for an explicitly
underserved segment, assume **1–2%**. A model depending on consumer conversion
would need ~20× the user base for the same revenue. CSR is also structurally
favourable in India — Section 135 of the Companies Act mandates qualifying
companies to spend 2% of net profit on CSR, and education is the most common
category. Dagar is buying-ready for that budget in a way a consumer subscription
is not.

### Year-3 revenue model at SOM

| Segment | Learners | Rate | Revenue |
|---|---|---|---|
| Institutional (NGO/CSR/gov) | 225,000 | ₹450/yr | ₹10.1 Cr |
| Consumer, free tier | 264,000 | ₹0 | ₹0 |
| Consumer Plus (4% of 275,000) | 11,000 | ₹799/yr | ₹0.9 Cr |
| Mentor add-on (15% of Plus) | 1,650 | ₹3,588/yr | ₹0.6 Cr |
| **Total** | **~500,000 learners** | | **~₹11.6 Cr (~$1.36M ARR)** |

### Where the 4% comes from

| Benchmark | Conversion |
|---|---|
| Consumer freemium generally (Evernote, Dropbox, Typeform) | 2–4% |
| Indian edtech, general learning | 2–5% |
| Indian edtech, exam preparation | 8–15% |
| Duolingo, whose daily habit loop Dagar copies (D17) | 8.9% |

Dagar is general learning, not exam preparation, so the honest band is 2–5%.
**We model 4%:** the top of that band, because the streak, the daily goal and
the parent summary are the mechanics that drive Duolingo's number, and well
below the 8.9% of the product we learned them from.

The upside case is real and deliberately not modelled: framing the same content
around board exams moves a product into the 8–15% band. That is a Phase 3
question, and claiming it now would be assuming the answer.

Gross margin at that mix ≈ ₹450 − ₹370 = **₹80/learner institutional**, thin by
design, subsidised by Plus. Margin improves as inference costs fall and caching
matures — it does not improve by raising institutional price, which is capped by
what CSR budgets pay per beneficiary.

### Sequencing

| Phase | Money |
|---|---|
| Phase 1 — MVP | **Free.** Validate H1–H7. No pricing experiments. |
| Phase 2 | First 2–3 paid CSR/NGO pilots. Test whether institutions pay for outcomes. |
| Phase 3 | Consumer Plus launch, institutional volume tiers, mentor network. |

### What would break this model

- **A3 is wrong** and NCERT alignment is far below 62% → SAM shrinks materially.
- **Institutions buy on cost-per-beneficiary, not outcomes** → ₹450 becomes a ceiling, not a floor, and margin goes negative.
- **AI costs don't fall** → the ₹370 floor holds and institutional tiers never clear margin.
- **Free tier is too good** → no Plus conversion. This is an acceptable failure; the mission tier is the point.
