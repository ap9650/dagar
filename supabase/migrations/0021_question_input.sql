-- 0021_question_input.sql — how a practice answer is ENTERED (D18, slice 5.2)
--
-- A teacher of Classes 6–8 said the practice should be pictorial. The mechanic
-- worth taking from Duolingo is not that it has pictures — it is that **you never
-- type**. Typing is where a learner's understanding gets lost in transit: into a
-- keyboard they are fighting, and into a rounding decision nobody taught them.
--
-- Two real defects reported from a phone close on this:
--   • Android's number pad has no `/`, so a fraction answer needed a bespoke
--     slash key bolted onto the input (see AnswerInput).
--   • `5/12` typed as `0.42` grades wrong, because nothing told the learner how
--     many decimal places to give (backlog 0b).
-- A learner who assembles `5/12` from tiles meets neither.
--
-- ─── this changes HOW an answer is entered, never how it is judged ───────────
--
-- Every input kind assembles a plain string and submits it to the SAME grader,
-- through the same route, unchanged. `lib/learning/grading.ts` is not touched by
-- this slice; it is the highest-harm file in the product (D3).
--
-- ─── additive and optional, exactly like lessons.steps ──────────────────────
--
--   question.input present → render the pictorial control
--   question.input null    → render today's text field or MCQ radios
--
-- So questions can be converted a few at a time and there is no broken state in
-- between, while real testers use the deployed app.

alter table public.questions add column if not exists input jsonb;

comment on column public.questions.input is
  'How the answer is ENTERED (tiles, choiceViz, shade, place). Null = the '
  'existing text input or MCQ radios. Never contains answer_value: a tile bank '
  'carries distractors, and choiceViz option values are as visible as todays '
  'MCQ choices — the client learns the options, never which one is right. '
  'Grading is unchanged and stays server-side (D3).';

-- ─── questions_public ────────────────────────────────────────────────────────
-- Rebuilt to carry `input`. The i18n rebuild from 0012 is preserved verbatim:
-- that is the boundary that stops the worked solution reaching the learner, and
-- it must survive every future edit to this view.

drop view if exists public.questions_public;

create view public.questions_public
  with (security_invoker = false) as
  select
    q.id,
    q.slug,
    q.concept_id,
    q.chapter_id,
    q.kind,
    q.difficulty,
    q.stem_md,
    q.answer_type,
    q.choices,
    -- How to answer. Safe to expose for the same reason `choices` is: it
    -- describes the CONTROL, not the key. See the column comment above.
    q.input,
    -- Per-locale rebuild, minus solution_md — unchanged from 0012, where the
    -- answer was found leaking inside the Hindi translation blob.
    coalesce(
      (
        select jsonb_object_agg(loc.key, loc.value - 'solution_md')
        from jsonb_each(q.i18n) as loc(key, value)
        where jsonb_typeof(loc.value) = 'object'
      ),
      '{}'::jsonb
    ) as i18n,
    q.created_at
  from public.questions q;

revoke all on public.questions_public from anon, authenticated;
grant select on public.questions_public to authenticated;

comment on view public.questions_public is
  'Answer-key-free projection of questions. The ONLY question source for client '
  'reads (D3). Excludes the answer_value and solution_md COLUMNS, and also strips '
  'solution_md out of every locale inside the i18n jsonb — see 0012, where that '
  'second path was found leaking the answer. Adding either back is a security bug.';
