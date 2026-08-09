# Dagar

@AGENTS.md

AI-powered adaptive learning platform for underserved learners. Buildathon MVP:
NCERT Mathematics, Classes 6–8, one chapter per grade.

**Next.js 16.2.12** — newer than most training data. `middleware` is now **`proxy`**
(`proxy.ts` at the root), Turbopack is the default, and `next lint` is gone in favour
of the ESLint CLI. Read `node_modules/next/dist/docs/` before writing app code.

**Read before any non-trivial change:**
- `docs/DECISIONS.md` — implementation decisions the PRD left open. Source of truth.
- `docs/DATA_MODEL.md` — schema, RLS shape, canonical event names.
- `docs/SCREENS.md` — every screen and flow. **Load before building any screen.**
- `docs/ANALYTICS.md` — the event catalogue and the metrics dashboard spec, in one
  place because they fail as two. **Load before touching an event or `/admin/metrics`.**
- `docs/specs/<slice>.md` — per-slice API contract, acceptance criteria, edge cases.
  **If a spec exists for the slice you're building, it is the brief.** Specs reference
  the docs above and never restate them; see `docs/specs/README.md`.
- `docs/BUILD_PLAN.md` — what we're building, in what order.
- `docs/PRD.md` — product strategy, personas, metrics.
- `docs/HINDI_STYLE.md` — **load before any Hindi copy or translation.**
- `docs/EVALS.md` — the tutor golden set, its criteria and how to add a case.
  **Load before editing `lib/ai/prompts/tutor.ts`.**

If `DECISIONS.md` and the PRD disagree, `DECISIONS.md` wins and the PRD gets a follow-up edit.

## Stack

Next.js App Router (TypeScript) · Supabase (Postgres + Auth + RLS) · Vercel ·
Claude Sonnet 5 for tutoring, Haiku 4.5 for batch/summaries · KaTeX · Tailwind ·
Twilio WhatsApp (sandbox in MVP)

## Layout

```
app/                 routes; (learn)/ student, (parent)/ parent, api/ route handlers
components/          ui/ primitives, learn/ feature components
lib/
  supabase/          server.ts (RSC/route), client.ts (browser), admin.ts (service role)
  ai/                tutor.ts, hints.ts, summaries.ts, prompts/
  learning/          mastery.ts, adaptivity.ts, grading.ts, streaks.ts, milestones.ts, struggle.ts
  notify/            index.ts (interface), whatsapp.ts, in-app.ts
  analytics/         track.ts, ai-log.ts
  security/          rate limiting, input validation
supabase/migrations/ numbered SQL, forward-only
supabase/seed/       curriculum content as TS/JSON, one file per chapter
tests/unit/          pure logic — grading, mastery, streaks, milestones
tests/integration/   route handlers + RLS boundary tests
e2e/                 Playwright, the demo journey
evals/golden/        tutor eval cases (JSONL) + judge rubric
docs/
```

## Rules that matter

**Secrets.** `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_*` are
server-only. Never prefix with `NEXT_PUBLIC_`. Never import `lib/supabase/admin.ts`
into a client component.

**Answer keys never reach the client.** Read questions through the
`questions_public` view. Grade server-side with the service role — practice in
`app/api/attempts/route.ts`, the quiz in `lib/learning/quiz.ts`. Those two plus
`app/api/hints/route.ts` are the only readers of the base `questions` table, and
that list should stay short. A client-side `if (answer === correct)` is a bug,
not a shortcut.

**Grading is deterministic code, not AI.** `lib/learning/grading.ts` owns it.
`1/2`, `2/4` and `0.5` must all grade correct against `1/2`. AI writes hints and
explanations only.

**AI is grounded.** Every tutor call includes the current lesson's `body_md` and
the learner's concept mastery. The tutor explains within the curriculum and hints
before answering. It never asks a minor for personal information.

**Every meaningful action emits an event.** Use `track()` from
`lib/analytics/track.ts` with a name from the canonical list in `DATA_MODEL.md`.
Inventing a new event name off-list breaks the metrics.

**Accessibility is in scope now, not Phase 3.** WCAG AA contrast, keyboard nav,
visible focus, 44px touch targets, `prefers-reduced-motion`. See `DECISIONS.md` D10.

**Mobile-first.** Design at 360px, then scale up. Learners are on shared Android phones.
Colours, type scale, spacing and component specs are in the `saathi-design` skill —
load it before writing any UI. Never invent a colour or a font size.

**Wrong answers are amber, not red.** Red is for system errors only. A learner who
is already behind must never see the colour of danger for a sign error.

**Server-side truth.** Streaks, mastery, and progress are computed on write in the
database or a route handler. Never trust a client-supplied score or streak.

## Conventions

- Server Components by default; `"use client"` only where interaction demands it.
- Route handlers validate input with zod before touching the DB.
- Migrations are forward-only and numbered. Never edit an applied migration.
- Copy is warm and encouraging, never punitive. A wrong answer is "not quite — try this" and never a red X alone.

## Commands

```
npm run dev            # local
npm run typecheck
npm run lint
npx supabase db push   # apply migrations
npm run seed           # load curriculum
npm run test           # vitest — unit + integration
npm run test:e2e       # playwright — demo path
npm run eval           # tutor golden set + LLM judge
```

## Skills

`saathi-design` **load before any UI work** · `saathi-feature` build a vertical slice ·
`saathi-db` migrations + RLS ·
`saathi-content` curriculum authoring · `saathi-ai` tutor and prompts ·
`saathi-security` RLS, secrets, minors' data · `saathi-test` vitest + playwright ·
`saathi-analytics` events and metrics · `saathi-observe` post-deploy + AI evals ·
`saathi-ship` pre-deploy gates + Vercel
