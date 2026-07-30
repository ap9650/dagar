-- 0013_quiz_fixed_set.sql — the quiz's question set becomes a stored fact
-- Spec: docs/specs/chapter-quiz.md §6 · DECISIONS D5
--
-- ── WHY THE SET IS STORED RATHER THAN RE-DERIVED ────────────────────────────
-- chapter-quiz.md §6 requires that a learner who abandons a quiz and comes back
-- resumes "the **same** question set — never a fresh one, which would let a
-- learner reroll for easier questions".
--
-- Re-deriving the set on each visit *happens* to satisfy that today, because the
-- set is currently every `kind = 'quiz'` question in the chapter in slug order,
-- and that is stable. It stops being true the moment anyone seeds a ninth quiz
-- question, samples a subset, or edits a slug — and it would stop being true
-- silently, mid-quiz, for a learner already halfway through.
--
-- So the set is written down when the session starts. A guarantee that depends
-- on nobody ever changing the content is not a guarantee.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.quiz_sessions
  add column if not exists question_ids uuid[];

comment on column public.quiz_sessions.question_ids is
  'The fixed question set, in the order served. Written at start and never '
  'changed — resuming an abandoned quiz replays exactly this list (chapter-quiz.md §6).';

-- One open quiz per learner per chapter.
--
-- The start route looks for an unsubmitted session before creating one, so this
-- index is the backstop for two taps racing on a slow connection — a real event
-- for this audience, and it would otherwise leave two half-answered sessions and
-- a learner wondering which one their answers went into.
create unique index if not exists quiz_sessions_one_open_idx
  on public.quiz_sessions (student_id, chapter_id)
  where submitted_at is null;
