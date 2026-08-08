-- Raise the free-text feedback ceiling from 1,000 to 4,000 characters.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- A LEARNER HIT THE CEILING AND WAS CUT OFF MID-SENTENCE.
--
-- 8 Aug, a Class 6 student wrote exactly 1,000 characters — an unprompted
-- product roadmap: targeted follow-up questions after a wrong answer, sub-topic
-- granularity inside Fractions, timed arithmetic practice because exam papers
-- are timed. The stored value ends "...more types of questions then msq",
-- clearly mid-thought. Everything after that is gone and cannot be recovered.
--
-- 1,000 was chosen for a form nobody had used yet, on the assumption that
-- children write little. The one child who wrote a lot is exactly the
-- respondent worth hearing, and the limit silently truncated them.
--
-- 4,000 rather than 2,000: someone who filled 1,000 and kept going will fill
-- 2,000 too. ~600 words is past what anyone writes in a feedback box, which is
-- the point — the ceiling should never be met again. Abuse is already bounded
-- elsewhere: the route requires auth, the rate limiter allows 20 posts per 10
-- minutes, and the table upserts on `user_id` so one person owns one row.
--
-- WIDENING ONLY. Every existing row satisfies the new constraint, so this
-- cannot fail on live data and needs no backfill.
-- ─────────────────────────────────────────────────────────────────────────────

-- Dropped by lookup, not by name. 0018 declared these inline on the column, so
-- their names are whatever Postgres generated — and a `drop ... if exists` on a
-- guessed name fails SILENTLY, leaving the old 1,000 ceiling in place while this
-- file claims to have raised it. The failure would surface as a learner losing
-- their answer, which is the exact thing being fixed.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'product_feedback'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%char_length%'
  loop
    execute format('alter table public.product_feedback drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.product_feedback
  add constraint product_feedback_worked_well_check
    check (char_length(worked_well) <= 4000),
  add constraint product_feedback_confusing_check
    check (char_length(confusing) <= 4000);

comment on column public.product_feedback.confusing is
  'Up to 4000 chars. In practice this is the box people use for anything they '
  'want to say, not only confusion — the longest response so far was a feature '
  'roadmap. Read it as free comment, not as a complaint field.';
