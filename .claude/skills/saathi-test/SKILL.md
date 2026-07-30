---
name: saathi-test
description: Write and run tests for Saathi — Vitest unit tests for the learning engine, integration tests for route handlers and RLS, and Playwright end-to-end tests for the demo path. Use when adding tests, when a bug needs a regression test, before deploying, or when asked to verify, test, or check that something works. Trigger on "test", "write tests", "does this work", "verify", "regression", "playwright", "vitest".
---

# Testing Saathi

With three days and nine features, you cannot test everything. Test the things
where **a bug is silent** — where the app keeps working and quietly does the wrong
thing to a learner.

## The priority order

**1. `lib/learning/grading.ts` — test this first, always.**
A grading bug marks correct learners wrong. Nothing errors, nothing looks broken,
and the learner concludes they are bad at maths. This is the highest-harm, lowest-
visibility bug in the product.

**2. The rest of `lib/learning/`** — mastery, streaks, adaptivity, milestones,
struggle detection. Pure functions, plain data in and out, no database. Fast to
test and full of arithmetic and off-by-one edges.

**3. RLS boundaries** — integration tests that *attempt the violation*.

**4. The demo path** — one Playwright test that walks the whole journey.

Everything below that is optional in a buildathon. Do not write component tests for
buttons while grading is untested.

## Setup

```bash
npm i -D vitest @vitejs/plugin-react @testing-library/react jsdom
npm i -D @playwright/test && npx playwright install chromium
```

```
tests/unit/          pure logic — grading, mastery, streaks, adaptivity, milestones
tests/integration/   route handlers, RLS boundaries (needs a test Supabase project)
e2e/                 Playwright, the demo journey
```

Scripts: `npm run test` (vitest), `npm run test:e2e` (playwright).

## Unit tests — what to actually assert

**Grading** (D3) — the equivalence cases are the whole point:

```ts
expect(grade("1/2", "fraction", "2/4")).toBe(true)   // unreduced
expect(grade("1/2", "fraction", "0.5")).toBe(true)   // decimal form
expect(grade("1/2", "fraction", " 1/2 ")).toBe(true) // whitespace
expect(grade("-7", "integer", "- 7")).toBe(true)
expect(grade("-7", "integer", "7")).toBe(false)      // sign errors stay wrong
expect(grade("x=4", "expression", "x = 4")).toBe(true)
```

Also test what must **not** pass: an empty answer, `NaN`, a divide-by-zero
fraction, and a wildly long input string.

**Mastery** (D5) — boundary at exactly 0.8, fewer than 3 attempts is never
mastered, and only the last 5 attempts count.

**Streaks** (D7) — consecutive days increment; one missed day consumes the grace
and the streak survives; two missed days reset; the Asia/Kolkata boundary is
respected (a lesson at 23:50 IST and one at 00:10 IST are different days); the
grace resets on a rolling 7-day window.

**Milestones** (D7b) — awarding twice produces one row, not two.

**Adaptivity** (D3) — 2 correct steps difficulty up, 2 wrong steps down, and
neither runs past the ends of the 1–3 range.

## Integration tests — prove the RLS boundary

These are worth more than any other integration test in this product:

- Student A cannot read student B's `attempts` → returns empty.
- A parent cannot write any learner row → fails.
- A parent not linked to student A cannot read A's progress → returns empty.
- An authenticated learner querying `questions` cannot see `answer_value`.
- Posting an attempt with someone else's `student_id` in the body does not write.

Each must assert the *failure*. A test that only proves the happy path proves
nothing about a security boundary.

## E2E — one test that matters

Walk the demo path in Playwright: sign up → dashboard → open a lesson → complete it
→ ask the tutor a question → practice with one wrong then one right answer → submit
the quiz → see progress and streak.

If that test is green, your demo works. Run it before deploying. Stub the Anthropic
call in CI so tests are not billed and not flaky.

## When you find a bug

Write the failing test **first**, then fix it. In a four-day build the temptation
is to patch and move on — but a grading bug that reappears on demo day costs far
more than the ten minutes the test took.

## Honest reporting

Report what you actually ran. If integration tests were skipped because no test
Supabase project exists, say that — do not describe a suite as passing when part of
it never executed.
