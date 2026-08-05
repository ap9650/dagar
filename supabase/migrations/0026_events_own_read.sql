-- 0026_events_own_read.sql
-- Let a learner read their OWN events, so the diary on /progress has a source.
--
-- ── WHY THIS WAS NOT THERE ──────────────────────────────────────────────────
-- 0006 created `events` with an insert-only policy and this comment:
--
--   "Insert-only for learners. Nobody reads events through the client —
--    /admin/metrics aggregates with the service role. An events table a
--    learner can read is a cross-learner leak waiting to happen."
--
-- The instinct was right and the conclusion was one step too far. A table with
-- NO select policy is safe; so is a table whose select policy is scoped to
-- `auth.uid() = student_id`. The leak being guarded against is a policy that
-- lets one learner read ANOTHER's rows — which is what `lesson_progress`,
-- `attempts` and `concept_mastery` all already avoid, in exactly this shape.
--
-- Without this the "what moved this week" list queries under the learner's own
-- session and gets zero rows back — silently, because RLS filters rather than
-- errors. The screen would have shipped showing an empty diary forever.
--
-- ── WHY NOT JUST USE THE SERVICE ROLE ON THE PAGE ───────────────────────────
-- Because it would work, and that is the problem. `/progress` is a
-- learner-facing screen; reading it with a client that bypasses every policy
-- means the boundary protecting one child's history from another's is a
-- `.eq("student_id", …)` somebody has to remember to write. RLS should be what
-- stops that, on a screen where a mistake costs a child's privacy.
--
-- Anonymous rows (student_id null — the pre-account counters) match no
-- learner's `auth.uid()`, so they stay unreadable by anybody but the service
-- role. Orphaned rows from deleted accounts are null too, and likewise stay out.

create policy "students read own events"
  on public.events for select to authenticated
  using (auth.uid() = student_id);

comment on table public.events is
  'Canonical names only — see DATA_MODEL.md. Learners may insert and read their '
  'OWN rows; cross-learner aggregation is service-role only (/admin/metrics).';
