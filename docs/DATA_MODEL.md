# Dagar — Data Model

Postgres on Supabase. All tables in `public`. RLS **on** for every table.
Timestamps are `timestamptz default now()`. IDs are `uuid default gen_random_uuid()`.

## Identity

**`profiles`** — one row per `auth.users`
`id` (PK, FK→auth.users) · `role` (`student`|`parent`) · `display_name` · `grade` (6|7|8, null for parents) · `locale` (`en`|`hi`, default `en`) · `timezone` (default `Asia/Kolkata`) · `created_at`

**`parent_links`** — the only cross-user boundary
`id` · `student_id` (FK→profiles) · `parent_id` (FK→profiles, nullable until claimed) · `link_code` (unique, 6 chars) · `whatsapp_e164` (nullable) · `status` (`pending`|`active`|`revoked`) · `created_at` · `claimed_at`

## Curriculum (seeded, read-only to app users)

**Localisation (D16):** `chapters`, `concepts`, `lessons` and `questions` each carry an
`i18n` **jsonb** column: `{"hi": {"title": "...", "body_md": "..."}}`. English lives in
the base columns and is the fallback. Resolve with
`t(row, field, locale)` → `row.i18n?.[locale]?.[field] ?? row[field]`.
**`answer_value` is never localised** — it is language-independent, so Hindi never
touches the grading path.

**`chapters`** — `id` · `grade` · `number` · `title` · `slug` (unique) · `summary` · `ncert_ref` (text — citation for **both** NCERT editions, see D1) · `order_index` · `i18n` (jsonb)

**`concepts`** — `id` · `chapter_id` (FK) · `name` · `slug` · `order_index` · `i18n` (jsonb)

**`lessons`** — `id` · `slug` (unique, nullable — seed key) · `chapter_id` (FK) · `concept_id` (FK) · `order_index` · `title` · `body_md` (KaTeX allowed) · `steps` (jsonb, nullable — D18) · `est_minutes` · `i18n` (jsonb)

> `steps` and `body_md` are **both** supported, indefinitely. Steps present → the
> step player; steps null or malformed → `body_md`, exactly as before. Shape is
> validated in `lib/learning/lessonSteps.ts` rather than by a CHECK constraint, so
> a content fix is a re-seed and not a migration. Hindi step prose lives in
> `i18n` beside `title` and `body_md`; diagram props are never translated.

**`questions`** — `id` · `slug` (unique, nullable — seed key) · `concept_id` (FK) · `chapter_id` (FK) · `kind` (`practice`|`quiz`) · `difficulty` (1–3) · `stem_md` · `answer_type` (`mcq`|`integer`|`fraction`|`decimal`|`expression`) · `answer_value` (text, canonical) · `choices` (jsonb, mcq only) · `solution_md` · `i18n` (jsonb — `stem_md`/`solution_md`/`choices` only, **never `answer_value`**)

> `answer_value` is **never** sent to the client before an attempt is graded.
> Grade server-side in a route handler. See `docs/DECISIONS.md` D3.

`slug` on `lessons` and `questions` is the **upsert target for `npm run seed`** (0010).
Without it a second seed run duplicates every lesson and question, which splits one
learner's mastery across two copies of the same concept. Nullable because it is a
seed key, not a user-facing identifier — and `unique` treats NULLs as distinct, so
content created any other way is unaffected.

## Learner state

**`lesson_progress`** — `id` · `student_id` · `lesson_id` · `status` (`started`|`completed`) · `started_at` · `completed_at` — unique(`student_id`,`lesson_id`)

**`attempts`** — `id` · `student_id` · `question_id` · `concept_id` (denormalised for fast mastery queries) · `given_answer` · `is_correct` · `hints_used` · `ms_taken` · `session_kind` (`practice`|`quiz`) · `quiz_session_id` (nullable) · `created_at`

**`quiz_sessions`** — `id` · `student_id` · `chapter_id` · `question_ids` (uuid[], the fixed set in served order) · `score` · `total` · `mastery_band` (`needs_revision`|`developing`|`mastered`) · `started_at` · `submitted_at`

> `question_ids` is written when the session opens and never changed: a learner who
> abandons a quiz and returns resumes **that** set, not whatever the bank holds now
> (chapter-quiz.md §6). A partial unique index on `(student_id, chapter_id) where
> submitted_at is null` keeps at most one quiz open per chapter, and `submitted_at`
> is claimed by a conditional update, which is what makes a double submit idempotent.

**`concept_mastery`** — derived, recomputed on attempt write
`student_id` · `concept_id` · `score` (numeric 0–1) · `attempts_count` · `is_mastered` (bool) · `updated_at` — PK(`student_id`,`concept_id`)

**`streaks`** — `student_id` (PK) · `current` · `longest` · `last_active_date` (date) · `grace_used_on` (date, nullable)

**`milestones`** — `id` · `student_id` · `code` (see D7b) · `context` (jsonb: which chapter/concept earned it) · `earned_at` — **unique(`student_id`,`code`)** so re-running an award is a no-op

**`tutor_messages`** — `id` · `student_id` · `lesson_id` (nullable) · `role` (`user`|`assistant`) · `content` · `created_at`
Retention: 90 days (D11).

## Support & engagement

**`mentor_requests`** — `id` · `student_id` · `concept_id` · `trigger` (which D6 rule fired) · `learner_note` · `context` (jsonb: recent attempts + tutor excerpt) · `status` (`open`|`acknowledged`|`resolved`) · `created_at`

> `context` is assembled server-side by `lib/learning/mentorContext.ts` and holds the
> concept and chapter, the last 5 attempts **with the answers the learner gave** (plus
> the choice label for MCQ — "b" tells a mentor nothing), and up to 6 tutor turns.
> At most one **open** request exists per learner per concept; asking again refreshes
> that row rather than filing a second one.
>
> **Retention debt:** the tutor excerpt is a copy of `tutor_messages` text and would
> outlive the 90-day rule above unless the purge covers this column too. Truncated to
> 300 chars per turn to bound it. The Day 3 retention job must include it.

**`parent_summaries`** — `id` · `parent_link_id` · `week_start` (date) · `payload` (jsonb) · `channel` (`whatsapp`|`in_app`) · `delivered_at` · `delivery_status` · `tracking_token` (unique) · `opened_at`

## Observability

**`ai_calls`** — one row per model call; the single place cost, latency and product context sit together
`id` · `student_id` · `kind` (`tutor`|`hint`|`summary`) · `model` · `lesson_id` (nullable) · `concept_id` (nullable) · `input_tokens` · `output_tokens` · `cache_read_tokens` · `cost_inr` (numeric) · `latency_ms` · `ttft_ms` · `ok` (bool) · `error` (nullable) · `created_at`
Index on (`created_at`), (`student_id`,`created_at`), (`kind`,`created_at`).
Writing this row must **never** fail the user's request — log and swallow.

**`tutor_feedback`** — `id` · `student_id` · `tutor_message_id` · `helpful` (bool) · `created_at`
One tap, no dialog. The highest-value eval signal in the product.

## Analytics

**`events`** — `id` · `student_id` (nullable) · `name` · `props` (jsonb) · `created_at`
Index on (`name`,`created_at`) and (`student_id`,`created_at`).

Canonical event names — **use these exact strings**, they map to PRD §12:

```
welcome_viewed       login_viewed        onboarding_started
learner_registered   lesson_started      lesson_completed
chapter_completed    ai_question_asked   hint_requested
practice_started     practice_completed
quiz_started         quiz_submitted
dashboard_viewed     recommendation_clicked
parent_invite_created  parent_linked
parent_summary_sent  parent_summary_viewed
mentor_cta_shown     mentor_request_submitted
feedback_shown       feedback_submitted
streak_extended      milestone_earned    tutor_feedback_given
settings_changed
```

### Anonymous events

`welcome_viewed` and `login_viewed` are written with `student_id` **null**, via
the service role, from the server render of `/welcome` and `/login`. They carry a
name, a locale and a timestamp — **no session id, no cookie, no IP, no user
agent, nothing joinable to anything**. That is deliberate and is the reason they
are acceptable in a product used by children: DPDP §9(3) prohibits behavioural
monitoring of a child even with parental consent, and a counter that cannot tell
two visitors from one visitor twice does not monitor anyone.

The cost is real and must be stated wherever the number is shown: these count
**screen opens, not people**, and a reload counts twice. `ANONYMOUS_EVENTS` in
`lib/analytics/track.ts` is a separate type so `trackAnonymous` cannot be called
with a learner event, or `track` with one of these.

### Which of these a browser may send

`/api/events` accepts exactly four names — `practice_started`,
`practice_completed`, `mentor_cta_shown`, `feedback_shown`. Everything else is
emitted by the route handler that performed the write, where it cannot be faked.

### Counting rules that are not obvious

| Event | Count | Because |
|---|---|---|
| `onboarding_started` | distinct `student_id` | a reload of the grade picker emits again |
| `dashboard_viewed` | distinct learner per minute | the auth redirect and the render both land |
| `quiz_started` | distinct `session_id` | it fires on resume as well as start |
| `parent_invite_created` | distinct `student_id` | the reuse path does not emit at all |
| `welcome_viewed`, `login_viewed` | raw rows only | there is no identifier to dedupe by, on purpose |

### Deliberately not events

**Account deletion.** `exit_reasons` is anonymous by construction (0023) and an
event carrying `student_id` would undo that — and the row would be orphaned a
moment later anyway.

**Dismissing the mentor offer.** Declining help is a normal thing to do, not a
failed conversion (`docs/specs/mentor-request.md` §7). `mentor_cta_shown` sizes
the ask; it does not grade the learner who said no.

**Individual practice attempts.** Every attempt is already a row in `attempts`
with its correctness and timestamp. An event would duplicate it less well.

**Signing in.** `dashboard_viewed` already stamps a day per learner, so return
rate is computable without a second session marker.

`dashboard_viewed` was added on 31 Jul 2026. Recommendation Acceptance (PRD §12,
≥30%) is defined as `recommendation_clicked ÷ dashboard views`, but only the
numerator was ever on this list — so the metric was uncomputable by construction.
It fires server-side on every `/learn` render, which is what "a dashboard view"
means; `recommendation_clicked` fires at the *destination* of the next-action
card, not on the click, so it counts arrivals rather than intent.

## RLS policy shape

| Table | Student | Parent |
|---|---|---|
| `profiles` | own row rw | own row rw; linked student row **read** |
| `chapters` `concepts` `lessons` | read all | read all |
| `questions` | read all **except `answer_value`** (use a view) | none |
| `lesson_progress` `attempts` `quiz_sessions` `concept_mastery` `streaks` `milestones` `tutor_messages` | own rows rw | linked student rows **read only** |
| `mentor_requests` | own rows rw | linked student rows read |
| `parent_summaries` | none | own link rows read |
| `events` | insert own only | none |

`questions_public` view exposes everything except `answer_value` and `solution_md`.
Grading and solutions come from a server route using the service role.

## Migration order

```
0001_identity.sql            profiles, parent_links, RLS
0002_curriculum.sql          chapters, concepts, lessons, questions (+ i18n jsonb, ncert_ref),
                             questions_public view
0003_learner_state.sql       lesson_progress, attempts, quiz_sessions, concept_mastery,
                             streaks, milestones
0004_tutor.sql               tutor_messages
0005_support.sql             mentor_requests, parent_summaries
0006_analytics.sql           events + indexes
0007_observability.sql       ai_calls, tutor_feedback, ai_spend_today()
0008_functions.sql           recompute_concept_mastery(), extend_streak(), award_milestones()
0009_fix_award_milestones.sql  fixes 22P02 in award_milestones (array append)
0010_seed_slugs.sql          slug on lessons + questions (idempotent seed),
                             questions_public rebuilt to expose slug
0011_attempt_idempotency.sql attempts.submission_id + partial unique index
0012_questions_public_strip_i18n_solution.sql
                             SECURITY: strips solution_md out of every locale
                             inside the i18n jsonb (it was leaking the answer)
0013_quiz_fixed_set.sql      quiz_sessions.question_ids + one-open-quiz index
```

**Applied to the remote database 2026-07-31.** Filenames must be `NNNN_name.sql` with
**digits only** — the Supabase CLI silently *skips* a file with a letter in the number
(an early `0006b_observability.sql` was skipped without failing the push, which then
broke the migration that depended on it).
