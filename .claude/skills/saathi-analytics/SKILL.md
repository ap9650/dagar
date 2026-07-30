---
name: saathi-analytics
description: Instrument and verify Saathi product events and MVP success metrics. Use when adding event tracking to a feature, wiring a metric from the PRD success criteria, building the analytics/validation view, or checking whether a hypothesis is actually measurable. Trigger on "track this", "add an event", "analytics", "metric", "are we measuring X", "validation plan".
---

# Saathi analytics

The PRD's validation plan (§12) is a stated differentiator. It is worth nothing if
the events don't fire. Instrumentation is part of the feature, not a follow-up.

## Event names are a closed list

Use only the canonical names in `docs/DATA_MODEL.md`:

```
learner_registered   lesson_started      lesson_completed
ai_question_asked    practice_started    practice_completed
quiz_submitted       recommendation_clicked
parent_linked        parent_summary_sent  parent_summary_viewed
mentor_request_submitted  streak_extended
```

Inventing a name off this list silently breaks a metric — the dashboard keeps
rendering, it just stops counting. If a genuinely new event is needed, add it to
`DATA_MODEL.md` **and** map it to a metric or hypothesis in the same change. An
event nobody reads is noise.

## How to emit

```ts
import { track } from "@/lib/analytics/track";
await track("lesson_completed", { lesson_id, chapter_id, concept_id, ms_spent });
```

- Emit **server-side** where the state change happens, not from a click handler.
  A client emit measures intent; a server emit measures what occurred.
- `student_id` comes from the session, never from props.
- Props are flat and typed. No nested objects, no PII, no free text a learner typed.
- Tracking never blocks or breaks the user flow. A failed `track()` is logged and swallowed.

## Metric → event mapping

| PRD metric | Computed from | Target |
|---|---|---|
| First lesson completion | `lesson_completed` where first for learner ÷ `learner_registered` | ≥ 60% |
| Lesson completion rate | `lesson_completed` ÷ `lesson_started` | ≥ 50% |
| AI Tutor adoption | distinct learners with `ai_question_asked` ÷ active learners | ≥ 50% |
| Practice completion | `practice_completed` ÷ `practice_started` | ≥ 60% |
| Recommendation acceptance | `recommendation_clicked` ÷ dashboard views | ≥ 30% |
| Day-7 retention | learners active on day 0 and day 7 | ≥ 25% |
| Parent Summary Engagement | `parent_summary_viewed` ÷ `parent_summary_sent` | ≥ 40% |
| Quiz mastery rate | `quiz_submitted` with band `mastered` ÷ all | — |
| Mentor request rate | `mentor_request_submitted` ÷ active learners | — |

**North Star: Weekly Learning Minutes per Active Learner.** Derived from lesson
start→complete deltas plus practice/quiz session durations. Every one of those
events therefore needs a duration prop — an event without it can't feed the NSM.

## Two storage layers

- **Supabase `events` table** — source of truth, queryable in SQL, ships with the app.
- **PostHog free tier** — exploration and funnels. Optional; the product must work
  and measure correctly without it.

## Before calling a feature done

Trigger the flow yourself and confirm the row lands:

```sql
select name, props, created_at from events
where student_id = '<uuid>' order by created_at desc limit 20;
```

A feature whose event you have not seen in the table is not instrumented, however
correct the code looks.

## Demo asset

A simple `/admin/metrics` page reading these events straight from Postgres is a
disproportionately strong demo moment — it shows judges you built the validation
plan you wrote about, not just the features. Cheap to build, hard to fake.
