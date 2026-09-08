-- 0010_seed_slugs.sql — stable seed keys on lessons and questions
--
-- WHY: `npm run seed` must be idempotent (dagar-content). `chapters` and
-- `concepts` already have unique slugs to upsert on; `lessons` and `questions`
-- had nothing, so a second seed run would have inserted a duplicate set of every
-- lesson and question in the chapter.
--
-- Not a delete-and-reinsert instead: `attempts.question_id` and
-- `lesson_progress.lesson_id` reference these rows, so wiping them on every seed
-- would take real learner history with it.
--
-- Nullable on purpose. It is a seed key, not a user-facing identifier: content
-- created any other way has no slug, and unique treats NULLs as distinct.

alter table public.lessons   add column if not exists slug text;
alter table public.questions add column if not exists slug text;

create unique index if not exists lessons_slug_key   on public.lessons(slug);
create unique index if not exists questions_slug_key on public.questions(slug);

comment on column public.lessons.slug is
  'Stable seed key, e.g. "c6-fractions-l1". Upsert target for npm run seed.';
comment on column public.questions.slug is
  'Stable seed key, e.g. "c6-eqf-d1-q1". Upsert target for npm run seed.';

-- The questions_public view is recreated so learners can read the slug too: the
-- practice UI needs a stable key for React list rendering, and a slug leaks
-- nothing (answer_value and solution_md remain absent, which is the point).
--
-- DROP then CREATE, not CREATE OR REPLACE: replace can only APPEND columns to a
-- view, so inserting `slug` as the second column fails with a bare replace.
drop view if exists public.questions_public;

create view public.questions_public
  with (security_invoker = false) as
  select id, slug, concept_id, chapter_id, kind, difficulty, stem_md, answer_type,
         choices, i18n, created_at
  from public.questions;

revoke all on public.questions_public from anon, authenticated;
grant select on public.questions_public to authenticated;
