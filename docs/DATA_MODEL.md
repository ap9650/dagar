# Saathi — Data Model

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

**`lessons`** — `id` · `slug` (unique, nullable — seed key) · `chapter_id` (FK) · `concept_id` (FK) · `order_index` · `title` · `body_md` (KaTeX allowed) · `est_minutes` · `i18n` (jsonb)

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

**`quiz_sessions`** — `id` · `student_id` · `chapter_id` · `score` · `total` · `mastery_band` (`needs_revision`|`developing`|`mastered`) · `started_at` · `submitted_at`

**`concept_mastery`** — derived, recomputed on attempt write
`student_id` · `concept_id` · `score` (numeric 0–1) · `attempts_count` · `is_mastered` (bool) · `updated_at` — PK(`student_id`,`concept_id`)

**`streaks`** — `student_id` (PK) · `current` · `longest` · `last_active_date` (date) · `grace_used_on` (date, nullable)

**`milestones`** — `id` · `student_id` · `code` (see D7b) · `context` (jsonb: which chapter/concept earned it) · `earned_at` — **unique(`student_id`,`code`)** so re-running an award is a no-op

**`tutor_messages`** — `id` · `student_id` · `lesson_id` (nullable) · `role` (`user`|`assistant`) · `content` · `created_at`
Retention: 90 days (D11).

## Support & engagement

**`mentor_requests`** — `id` · `student_id` · `concept_id` · `trigger` (which D6 rule fired) · `learner_note` · `context` (jsonb: recent attempts + tutor excerpt) · `status` (`open`|`acknowledged`|`resolved`) · `created_at`

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
learner_registered   lesson_started      lesson_completed
ai_question_asked    practice_started    practice_completed
quiz_submitted       recommendation_clicked
parent_linked        parent_summary_sent  parent_summary_viewed
mentor_request_submitted  streak_extended  milestone_earned
tutor_feedback_given
```

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
```

**Applied to the remote database 2026-07-30.** Filenames must be `NNNN_name.sql` with
**digits only** — the Supabase CLI silently *skips* a file with a letter in the number
(an early `0006b_observability.sql` was skipped without failing the push, which then
broke the migration that depended on it).
