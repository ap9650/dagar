-- 0022_question_stem_viz.sql — a diagram in the QUESTION (D18, slice 5.2c)
--
-- All four input kinds from 0021 put diagrams in the ANSWER: pick a picture,
-- shade a shape, point at a line, build from tiles. That covered Classes 6 and 7
-- and left Class 8 with nothing pictorial at all, because its natural form runs
-- the other way round:
--
--     "The balance is level. What is x?"
--
-- The balance IS the equation. It belongs beside the question, not among the
-- options — a learner cannot answer without seeing it, and offering four
-- balances to choose between would be asking a different, weaker question.
--
-- So this is a missing CAPABILITY rather than missing content, which is why it
-- comes before authoring more questions.
--
-- Same shape as `steps` and `input` before it: additive, nullable, and validated
-- at read time by the shared viz schema. A question without one renders exactly
-- as it does today.

alter table public.questions add column if not exists stem_viz jsonb;

comment on column public.questions.stem_viz is
  'A diagram shown WITH the question stem — a balance, a number line, a shaded '
  'shape. Uses the same VizSpec union as lesson steps, so a diagram cannot be '
  'valid in one surface and invalid in another. Safe to expose: it is part of '
  'the question, not the key. Null renders no diagram.';

-- ─── questions_public ────────────────────────────────────────────────────────
-- Rebuilt to carry `stem_viz`. The i18n rebuild from 0012 is preserved verbatim:
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
    -- The diagram that belongs to the question. Not translated (D18 §6): a
    -- balance holding three x-boxes is the same balance in every language.
    q.stem_viz,
    q.answer_type,
    q.choices,
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
