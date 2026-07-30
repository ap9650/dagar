-- 0011_attempt_idempotency.sql — one submission, one attempt row
--
-- WHY: guided-practice.md §8 requires two things that need a key the CLIENT owns:
--
--   "Double-submit → idempotent per (question_id, submission). One attempt row,
--    one mastery recompute."
--   "Network fails after grading, before response → on retry, the server must not
--    write a second attempt."
--
-- The second is the real one. On a shared Android phone over patchy 4G, a POST
-- that grades successfully and then loses the response on the way back is normal,
-- not exceptional. The learner taps Check again. Without a key, that writes a
-- second attempt — and since D5 computes mastery over the last FIVE attempts, one
-- dropped packet silently spends two of the learner's five slots on one question.
-- A wrong answer submitted twice costs 40% of the mastery window.
--
-- Nothing derivable server-side identifies "the same submission": the same learner
-- answering the same question with the same text is a legitimate second attempt
-- after a hint. So the client mints a uuid per SUBMISSION (not per question, not
-- per session) and sends it. It is not a security token — it only ever collapses a
-- learner's own duplicate write, and the row it matches is already scoped to
-- student_id.

alter table public.attempts add column if not exists submission_id uuid;

-- Partial and scoped to the student: two learners cannot collide, and rows written
-- before this column existed (submission_id null) are all still distinct.
create unique index if not exists attempts_submission_key
  on public.attempts (student_id, submission_id)
  where submission_id is not null;

comment on column public.attempts.submission_id is
  'Client-minted idempotency key, one per submission. Collapses a retry after a '
  'dropped response into the same row. Null for attempts written before 0011.';
