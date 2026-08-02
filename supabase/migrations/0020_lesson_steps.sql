-- 0020_lesson_steps.sql — lessons become a sequence of screens
-- Spec: docs/specs/interactive-lessons.md · Decision: D18
--
-- A teacher of Classes 6–8 used Dagar on 2 Aug 2026 and said her students
-- cannot hold two paragraphs. Fifteen lessons, 215 words each, and not one
-- image, diagram or sound between them. Lesson 1 says "cut one roti into 4
-- equal pieces" and shows nothing.
--
-- ── WHY THIS IS ADDITIVE AND NULLABLE ───────────────────────────────────────
-- One nullable column, and no data moves:
--
--     steps present → the step player
--     steps null    → body_md, rendered exactly as it is today
--
-- That is deliberate and it is what de-risks the whole slice. Class 6 can be
-- interactive while Classes 7 and 8 are untouched, with no broken state in
-- between — so authoring can stop at any hour and ship what is finished, while
-- real learners are using the deployed app.
--
-- `body_md` is NOT dropped and is not deprecated. It stays the fallback for any
-- lesson without steps, and the zod parser falls back to it when a `steps` blob
-- fails to validate. A content mistake must never blank a lesson.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.lessons
  add column if not exists steps jsonb;

comment on column public.lessons.steps is
  'Ordered array of lesson steps (D18). NULL means render body_md instead — '
  'both are supported indefinitely. Shape is validated in lib/learning/'
  'lessonSteps.ts, not here: a CHECK constraint would make a content fix a '
  'migration. Hindi step prose lives in lessons.i18n alongside title and '
  'body_md; diagram props are never translated.';

-- No RLS change. `lessons` is curriculum, already readable by every
-- authenticated user, and steps carry no learner data — only content.
