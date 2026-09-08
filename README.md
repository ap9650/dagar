# Dagar — डगर

**An AI tutor for children who cannot afford one.**

NCERT Mathematics, Classes 6 to 8, in Hindi and English. Built in four days for a
buildathon, then put in front of a real Class 6 classroom and kept running.

**[Open the app](https://dagar-ap19.vercel.app)** ·
**[Read the deck](https://dagar-ap19.vercel.app/deck)** ·
**[Watch the demo](https://dagar-ap19.vercel.app/demo-en.mp4)**
([हिंदी](https://dagar-ap19.vercel.app/demo-hi.mp4))

**[How it was built](https://dagar-ap19.vercel.app/reports/Dagar-How-We-Built-It.pdf)** ·
**[What users said](https://dagar-ap19.vercel.app/reports/Dagar-Feedback-Report.pdf)**
— the build story and all 19 feedback responses, unedited

---

## The problem

Seven in ten Class 5 children in India cannot solve a simple division problem.
The fix that works is one-to-one attention, and it costs more than the families
who need it have. A quarter of school children already pay for private tuition —
the willingness is proven; the price is the barrier.

Existing products do not close this. Video platforms deliver content but cannot
teach a particular child. General AI assistants answer questions but do not know
what she is studying, what she got wrong last week, or that she reads in Hindi.

## What Dagar does

One loop, in the order that matters:

**A lesson** — one idea per screen, opening on something from a kitchen rather
than notation. **A tutor** she can ask, grounded in the exact lesson on her
screen, in the language she typed in. **Practice** on the same concept while it
is still warm, graded by code. **A quiz** that sets her mastery. **Progress** her
parent can see through a link that needs no account, no app and no password.

Every competitor has lessons and quizzes. **The sequence is the product.**

## Where it actually is

Real numbers from the live database, not projections:

| | |
|---|---|
| Learners signed up | **52** |
| Finished at least one lesson | **38** |
| Lessons completed | **166** |
| Practice questions answered | **1,069** (687 correct) |
| Asked the tutor something | 14 learners, 36 questions |
| Feedback responses | **19** — 18 said it helped, 16 would return |

## The decisions, and the reasoning

**[`docs/DECISIONS.md`](docs/DECISIONS.md) is the most useful file in this
repository.** Twenty-eight numbered decisions, each with the reasoning, several
amended in place when evidence changed them. A few worth reading:

- **[D3] Grading is deterministic code, never AI.** `1/2`, `2/4` and `0.5` all
  mark correct. A wrong verdict is the highest-harm, lowest-visibility failure in
  the product: nothing errors, and a child who was right concludes she is bad at
  maths.
- **[D16] Hindi ships in the MVP, not Phase 2.** The learners are in
  Hindi-medium government schools. For them an English-only interface is not a
  missing feature, it is a locked door.
- **[D17] What transfers from Duolingo, and what inverts.** Streaks and a daily
  goal, yes. Hearts, lives and leaderboards, no — every one of them punishes
  exactly the child who is already behind.
- **[D26] What actually shipped, and what did not.** One table the deck and the
  PRD both defer to, written after four claims drifted in a single afternoon.
- **[D28] Discoverability beats more content.** Eleven of thirty-six messages
  sent to the tutor were about the screen, not the mathematics.

## What I got wrong

The reversals are in the decision log too, and they are the part worth reading.

- **The eval judge was weaker than the model it judged.** Haiku marking Sonnet,
  justified as "marking is a classification job" — a cost decision wearing an
  engineering argument. Swapping to a stronger judge moved the score from 36 to
  **47 of 50** and cut self-disagreement from 15 cases to 3. About ten of the
  "failures" had been the judge being wrong.
- **A tier that lost money.** One-to-one tutoring priced at ₹299/month against
  roughly ₹1,200 of teacher time. Repriced, and the annual plan withdrawn
  entirely: taking a year up front for teachers not yet hired is a refund
  liability, not revenue.
- **Four progress bugs a green test suite could not see.** Every test asserted a
  *flow*; every bug was a *relationship between two numbers on one screen*. The
  fix was a different kind of test, not more of the same.

## The AI, specifically

- **Grounded, not general.** Every tutor call carries the current lesson's text
  and the learner's concept mastery. Retrieval is a lookup driven by application
  state, not a similarity search — we always know which lesson she is on, so
  there is no wrong passage to fetch.
- **Two models by job.** Sonnet teaches, because a child reads every word. Haiku
  does the work nobody reads: summaries, translation, answer-key checks.
- **It never grades.** Hints escalate before answers. Grading lives in code.
- **[`docs/EVALS.md`](docs/EVALS.md) — a 50-case golden set**, 22 of them
  verbatim messages real learners sent. Runs before any change to the tutor's
  prompt. Currently **47 of 50**, with adversarial at 9/9 and regression at 3/3.
- **Costed before it was priced.** About ₹0.44 per tutor exchange, measured
  against a modelled ₹0.44, giving a **₹370/learner/year floor** that no
  institutional price goes below.

## Built for the phone it will be opened on

360px first. No app store and no download — a PWA that installs to the home
screen. Bilingual throughout, including the tutor's replies. WCAG AA in the MVP
rather than a later phase: contrast, keyboard, visible focus, 44px targets,
`prefers-reduced-motion`.

**Wrong answers are amber, never red.** Red is for system errors only. A learner
who is already behind should not see the colour of danger for a sign error.

## Safety, because the users are 11 to 14

Row-level security on every table, tested by *attempting* the violation.
Answer keys unreachable from the browser. The tutor never asks a child for
personal information and never sends them off-platform. Tutor transcripts are
deleted after 90 days. No advertising, ever — the DPDP Act 2023 forbids targeted
advertising to under-18s, and we would not want it open.

## Stack

Next.js 16 (App Router, TypeScript) · Supabase (Postgres, Auth, RLS) · Vercel ·
Claude Sonnet 5 and Haiku 4.5 · KaTeX · Tailwind

**1,743 tests** — concentrated where a bug would be silent: 46 on grading alone,
19 that attack the security boundary, and a set that feeds one activity log to
every element of the progress screen and asserts they agree.

## Where to look

| Path | What is in it |
|---|---|
| `docs/DECISIONS.md` | Every decision, with reasoning. **Start here.** |
| `docs/PRD.md` | Product strategy, personas, market sizing |
| `docs/EVALS.md` | The tutor golden set and how it is judged |
| `docs/MARKET_AND_PRICING.md` | Unit economics and the ₹370 floor |
| `docs/HOW_WE_BUILT_IT.md` | The build, and what I would do differently |
| `lib/learning/` | Grading, mastery, streaks, adaptivity — the pure logic |
| `lib/ai/prompts/` | The tutor's system prompt, reviewable in a diff |
| `evals/golden/tutor.jsonl` | All 50 evaluation cases |
| `supabase/migrations/` | Schema and RLS, forward-only |

## Running it locally

```bash
npm install
cp .env.example .env.local     # fill in Supabase and Anthropic keys
npx supabase db push           # apply migrations
npm run seed                   # load the curriculum
npm run dev
```

```bash
npm run test        # 1,743 unit and integration tests
npm run test:e2e    # Playwright, the demo journey
npm run eval        # the tutor golden set, ~2 minutes
npm run deck        # rebuild the pitch deck
```

---

Built by [Akriti Panwar](https://github.com/ap9650). The product is named
**डगर** — *the trail you walk*.
