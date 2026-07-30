-- 0012_questions_public_strip_i18n_solution.sql
--
-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY FIX: questions_public was leaking the worked solution — and with it,
-- the answer — to any learner who opened the network tab, or who simply read the
-- RSC payload of the practice page.
--
-- The view was written to exclude the `answer_value` and `solution_md` COLUMNS,
-- and it does. What it did not account for is that D16 stores every translation
-- in the `i18n` jsonb column, and the Hindi translation of a question includes
-- its `solution_md`. So the key travelled inside the blob that was still selected:
--
--   GET /api/practice/<concept>/next  →
--     "i18n": { "hi": { "stem_md": "…", "solution_md": "…अंश के साथ भी यही करो:
--                $1 \\times 3 = 3$… $$\\frac{1}{3} = \\frac{3}{9}$$" } }
--
-- That question asks what goes in the box. The answer is 3, and the response said
-- so before the learner had answered.
--
-- Found by inspecting a real response body, which is exactly why
-- guided-practice.md §7 requires that check "by inspecting the actual network
-- response, not by reading the code". Reading the code was reassuring and wrong:
-- the column list is clean, and the leak is one level down inside a jsonb value.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The fix rebuilds `i18n` per locale with `solution_md` removed, so the view is
-- structurally incapable of carrying it however many locales are added later. A
-- filter in application code was rejected as the primary fix: this view is the
-- boundary, and a boundary that depends on every future caller remembering to
-- strip a field is not a boundary.

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
    -- Per-locale rebuild, minus solution_md. `stem_md` and the translated choice
    -- LABELS stay — a Hindi learner needs both, and neither reveals an answer
    -- (the graded value is the choice ID, which is never translated).
    --
    -- jsonb_typeof guards a malformed row: if some locale value is not an object,
    -- it is dropped entirely rather than erroring or passing through unfiltered.
    -- Failing closed is the only acceptable direction here.
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
