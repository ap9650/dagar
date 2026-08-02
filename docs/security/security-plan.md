# Dagar — Security Plan

Dagar stores learning data about **children aged 11–14**. A leak here is not an
inconvenience, it is harm to a minor. This document is the standing record of what
protects that data and what does not.

Written 2026-07-30, Day 0 — before feature work, deliberately.

---

## 1. RLS matrix

RLS is enabled on **every** table, in the same migration that creates it. A Supabase
table without RLS is readable by anyone holding the anon key, and the anon key ships
in the browser.

| Table | Student | Parent (linked, active) | Anon |
|---|---|---|---|
| `profiles` | own row: read/write | linked student's row: **read** | ✖ |
| `parent_links` | own rows: read/write | own links: read | ✖ |
| `chapters` `concepts` `lessons` | read all | read all | ✖ |
| **`questions`** | **✖ nothing** | ✖ | ✖ |
| `questions_public` (view) | read | ✖ | ✖ |
| `lesson_progress` `attempts` `quiz_sessions` `concept_mastery` `streaks` `milestones` | own rows: read/write | **read only** | ✖ |
| **`tutor_messages`** | own rows: read/write | **✖ NOTHING** — see below | ✖ |
| `mentor_requests` | own rows: read/write | **read only** | ✖ |
| `parent_summaries` | ✖ | own link's rows: read | ✖ |
| `summary_links` | own rows: read/write | ✖ | **✖ — token resolved by service role only** |
| `events` | **insert only** | ✖ | ✖ |
| `ai_calls` `tutor_feedback` | ✖ / own rows | ✖ | ✖ |

**There is no parent write policy on any table.** If you find yourself writing one,
re-read D2.

### `tutor_messages` — closed 31 Jul, migration 0017

`0004_tutor.sql` gave a linked parent SELECT on this table. `/for-parents` promised,
in both languages, that the questions a learner asks the tutor stay private. The two
disagreed for a week.

The parent UI never rendered those rows, which is exactly why it survived review —
**the screen is not the boundary, the policy is.** The anon key ships in the browser,
so a linked adult could read the whole conversation from devtools.

Proved by attempting it (`tests/integration/privacy-promise.test.ts`) before the
policy was dropped: a real linked parent read back both of a child's messages,
including "i dont understand any of this".

**`attempts` is deliberately still parent-readable.** A supporting adult may in
future see the questions practised and the answers given — a product decision, not
an oversight, and the test documents it so that reversing it forces the copy to
change in the same commit. The tutor conversation is different in kind: it is where
a learner admits they are stuck, and one who believes an adult is reading it stops
saying so.

### Reading a negative test

Every RLS test asserts a read returns **nothing** — which is also what a broken
fixture produces. The first version of `privacy-promise.test.ts` passed 9/9 while
proving nothing: it inserted `code` where `parent_links` wants `link_code`, so the
parent was never linked and every assertion passed against someone who could read
nothing at all.

**Every negative-boundary test in this repo must open with controls** that prove the
fixture is real — the link is active, the private rows exist, the attacker genuinely
holds the privilege being tested — and must throw on fixture errors rather than
ignore them. A green security test that passes for the wrong reason is worse than no
test, because it stops people looking.

### The answer-key boundary

`questions` has RLS enabled and **no select policy at all**, so every client read
returns zero rows even when data exists. Learners read `questions_public`, which
omits `answer_value` and `solution_md`. Grading reads the base table through the
service role in a route handler.

**Verified 2026-07-30 by attempting the violation** with a real signed-in learner
JWT, not by re-reading the policy:

| As a signed-in learner | Result |
|---|---|
| `select * from questions` | 200, **0 rows** (row existed) |
| `select answer_value from questions` | 200, **0 rows** |
| `select * from questions_public` | 200, 1 row, **no `answer_value`, no `solution_md`** |
| service role → `answer_value` | `"3/4"` — grading path intact |

Re-run this check after any change to `0002_curriculum.sql`. A policy that has not
been exercised is untested.

---

## 2. Auth boundaries

**Identity comes from the server session, never from the request body.** No route
schema in `lib/security/validation.ts` accepts a `student_id` — that would be an
impersonation vector.

Three layers, and only two of them enforce:

| Layer | File | Enforces? |
|---|---|---|
| `proxy.ts` (Next 16's renamed middleware) | `proxy.ts` | **No** — refreshes the session cookie and redirects signed-out users for UX |
| Route-group layout server component | `app/(learn)/layout.tsx`, `app/(parent)/layout.tsx` | **Yes** — reads the session, redirects before rendering |
| `requireAuth()` / `requireRole()` | `lib/security/authGuard.ts` | **Yes** — every route handler |
| RLS | Postgres | **Yes** — the backstop that holds even if the above are wrong |

> Next 16's docs state plainly that proxy "should not be used as a full session
> management or authorization solution." It is a convenience, not a gate.

**Cookie caching:** `proxy.ts` sets the no-cache headers the Supabase SSR library
supplies alongside auth cookies. Without them a CDN can serve one user's session
token to a different user.

**Parent link codes:** 6 characters, redemption rate-limited to 5 per 10 minutes
(`LIMITS.parentLinkClaim`). Claiming runs through a service-role route handler — a
client must never be able to set `parent_id` to itself on an arbitrary row.

---

## 3. Secret inventory

| Secret | Where it lives | Reaches the browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, Vercel | **Yes, by design** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local`, Vercel | **Yes, by design** — RLS is what makes this safe |
| `NEXT_PUBLIC_SITE_URL` | `.env.local`, Vercel | Yes, by design |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local`, Vercel | **Never** |
| `ANTHROPIC_API_KEY` | `.env.local`, Vercel | **Never** |
| `CRON_SECRET` | `.env.local`, Vercel | **Never** |
| `TWILIO_*` | Vercel (Day 3) | **Never** |

`NEXT_PUBLIC_` is a *publication instruction*, not a naming convention. Anything
carrying that prefix is in the browser bundle permanently.

`lib/supabase/admin.ts` throws at import time if it is ever pulled into a client
bundle, and throws a named error if `SUPABASE_SERVICE_ROLE_KEY` is missing — so a
misconfigured Vercel deploy says so instead of failing mysteriously.

`.env.local` is gitignored; `.env.example` is committed and holds no values.
**If a key is ever committed, rotate it.** Deleting the commit does not un-leak it.

### Review commands

```bash
grep -rn "NEXT_PUBLIC_" --include="*.ts" --include="*.tsx" app lib components
grep -rn "supabase/admin" --include="*.tsx" app components
grep -rn "service_role\|SERVICE_ROLE" --include="*.tsx" app components
```

Any hit in a client file is a stop-everything finding.

---

## 4. Rate limits

Two mechanisms, chosen by consequence (`lib/security/rateLimiter.ts`):

- **`memoryLimit`** — in-process. **Known limitation:** Vercel runs many instances,
  each with its own memory, so the real limit is roughly (limit × instances). Fine
  for slowing a password guesser; never for anything that costs money.
- **`dbLimit` / `checkAiBudget`** — counts rows in Postgres. Exact across instances.

**The rule: if exceeding the limit spends rupees, it must be database-backed.**

| Route | Limit | Mechanism |
|---|---|---|
| `POST /api/auth/signup` `login` | 10/min per lowercased email | memory |
| `POST /api/parent/claim` | 5 per 10 min | memory |
| `POST /api/attempts` | 120/min per learner | memory |
| `POST /api/quiz/[id]/start` `submit` | per learner | memory |
| `POST /api/summary-links` `parent-links` | per learner | memory |
| `POST /api/mentor-requests` `events` | per learner | memory |
| **`POST /api/tutor`** | **30/hour per learner** (D11) | **database** (`ai_calls`) |
| **`POST /api/hints`** | **60/hour per learner** | **database** (`ai_calls`) |
| **Global AI spend** | **₹150/day, Asia/Kolkata** (D11) | **database** (`ai_spend_today()`) |

**The hint ceiling was added 1 Aug, and its absence is worth recording.**
`checkAiBudget` was called by both AI routes but counted only `kind = 'tutor'`, so
`/api/hints` appeared guarded and was not: a learner with no tutor messages had an
unbounded hint allowance.

The cost of one hint is trivial — the problem is that the daily ceiling above is
**shared**. One learner leaning on the hint button drains it, and the tutor then
degrades for everyone else. A per-learner limit covering one of two paid routes
protects nobody.

The two ceilings are independent by design: burning the hint allowance during
practice must not silence the tutor, which is what a stuck learner needs most.
60/hour is deliberately generous — four tiers across fifteen questions is a good
hour of practice, not an attack, and a limit that fires on correct use gets removed
rather than tuned.

The daily ceiling degrades **the tutor only**. Lessons, practice and the quiz keep
working — a cost control that takes down the whole app is worse than the overspend.

---

## 5. Minors' data

**Collected:** display name, grade, locale, and learning activity. That is all.
**Never collected:** date of birth, address, photograph, precise location, phone
number for the learner.

What is never collected cannot leak.

| Data | Retention |
|---|---|
| Tutor transcripts (`tutor_messages`) | **90 days**, then aggregate-only (D11) |
| `attempts`, `lesson_progress`, mastery | Life of the account |
| `events` | Life of the account — **no PII, no learner free text** |
| `ai_calls` | Life of the account — token counts and cost, never content |

**`events.props` must never contain free text a learner typed.** A learner's
question can contain anything, and it does not belong in an analytics table.

**The AI tutor must never request personal information from a learner** and must
never direct them off-platform. Enforced in the system prompt and checked in the
golden set (`docs/specs/ai-tutor.md`).

**No third-party analytics that fingerprints or tracks children across sites.**
PostHog, if used, is exploration only; Supabase `events` is the source of truth.

Parent access is scoped to their own linked child via an `active` `parent_links`
row, and is revocable by setting that row to `revoked`.

---

## 6. Deliberately out of scope for the MVP

Named rather than left unmentioned — an honest gap list is a stronger artefact than
a silent one:

- Penetration testing
- SOC 2 or equivalent
- A formal DPIA
- **COPPA / India DPDP Act legal review** — Dagar processes children's data and a
  real deployment needs this. The MVP is a buildathon prototype, not a launch.
- Automated secret scanning in CI
- Distributed (Redis-backed) rate limiting — see the `memoryLimit` caveat above
- Account deletion / data export self-service

---

## 7. Standing questions for any new route

1. Whose data can this reach?
2. Who proved it — which test attempted the violation?
3. Does identity come from the session, or did it arrive in the body?
4. If this is called in a loop, what does it cost?
