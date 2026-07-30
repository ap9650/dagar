---
name: saathi-feature
description: Build a Saathi feature slice end to end — schema, server logic, route handler, UI, analytics event, and accessibility pass. Use whenever implementing or extending a learner- or parent-facing feature (curriculum dashboard, micro-lesson, AI tutor, guided practice, chapter quiz, progress, streaks, parent view, mentor request). Trigger on "build the X feature", "add X screen", "implement guided practice", or any request to ship a vertical slice of Saathi.
---

# Build a Saathi feature slice

A feature is not done when it renders. It is done when it is persisted, tracked,
accessible, and safe. Work the checklist in order — each step depends on the one above.

## 0. Orient

Read `docs/DECISIONS.md` and `docs/DATA_MODEL.md` first. Most "missing" specs are
already decided there. If the feature genuinely isn't covered, decide the smallest
reasonable thing, **write it into DECISIONS.md**, and continue — do not stall.

Confirm which PRD feature row you're building (`docs/PRD.md` §9) so the acceptance
criteria and success metric are explicit before you write code.

## 1. Data

Does the schema in `DATA_MODEL.md` already support this? If yes, use it as-is.
If no, add a numbered forward-only migration in `supabase/migrations/` and update
`DATA_MODEL.md` in the same change. Every new table gets RLS enabled and a policy
matching the table in `DATA_MODEL.md` — students own their rows, parents read only
through `parent_links`.

## 2. Server logic

Pure, testable functions in `lib/learning/`. Mastery, adaptivity, grading, streaks,
and struggle detection all live here and take plain data in, return plain data out.
No Supabase client inside them. This is what makes them verifiable without a DB.

## 3. Route handler

`app/api/<thing>/route.ts`. Validate the body with zod. Get the user from the
server Supabase client — **never trust a user id from the request body**. Anything
touching answer keys or another user's data uses `lib/supabase/admin.ts` behind an
explicit ownership check.

## 4. UI

Server Component unless it needs interaction. Mobile-first at 360px. Loading and
error states are required, not optional — a learner on 4G will see them.

Empty states carry the product's tone: encouraging, never punitive.

## 5. Analytics

Emit the canonical event from `DATA_MODEL.md` via `track()`. If your feature maps
to a PRD success metric, the event that measures it must fire before you call the
feature done.

## 6. Accessibility pass

Run the checklist in `.claude/skills/saathi-ship/SKILL.md`. At minimum for a new
screen: reachable and operable by keyboard, visible focus, accessible names on
every control, AA contrast, 44px touch targets.

## 7. Verify

Typecheck, lint, then exercise the actual flow in the browser — click through it as
a learner would. Report what you verified and what you didn't.

## Feature-specific traps

**Curriculum dashboard** — the "continue learning" recommendation is the highest-
leverage element on the screen. It comes from `lib/learning/adaptivity.ts`, not
from "first incomplete lesson".

**Micro-lesson** — body is markdown with KaTeX. Render math server-side where you
can. Completion fires `lesson_completed` **and** touches the streak.

**AI Tutor** — see the `saathi-ai` skill. Stream the response. Persist both turns
to `tutor_messages`. Check struggle rules (D6) after each turn.

**Guided practice** — never send `answer_value` to the client. Difficulty steps per
D3: 2 right → up, 2 wrong → down plus a worked example. Grade through
`lib/learning/grading.ts` so `2/4` matches `1/2`.

**Chapter quiz** — fixed set, no hints, no difficulty adaptation mid-quiz. On submit,
compute the mastery band (D5), write `quiz_sessions`, recompute `concept_mastery`.

**Progress & streaks** — recompute server-side on write (D7). Asia/Kolkata day
boundary. One grace day per rolling 7.

**Milestones** — awarded server-side on the write that triggers them, idempotent via
unique(`student_id`,`code`) (D7b). Show unearned ones too, so there's always a visible
next goal. Feed earned milestones into the parent summary; that's what delivers the
PRD's "celebrate milestones" job.

**Habit mechanics (D17)** — build the daily goal ring, in-lesson progress and journey
layout. Do **not** build leaderboards, hearts/lives, XP or guilt notifications, even
if asked casually: they motivate by loss and comparison, which inverts for a learner
who is already behind. The daily goal uses the **same completion rule as the streak**
(D7) so the two never disagree, and emits no new event — `streak_extended` covers it.

**Parent view** — read-only, always. If a parent write path exists, that's a bug.
Verify the RLS boundary by trying to read an unlinked student.

**Mentor request** — capture full context (concept, recent attempts, tutor excerpt).
The CTA is a suggestion, never a blocking modal.
