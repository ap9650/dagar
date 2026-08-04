-- 0024_events_before_profile.sql
-- Let `events` record the window between having an account and having a profile.
--
-- ── THE BUG THIS FIXES ──────────────────────────────────────────────────────
-- `events.student_id` referenced `public.profiles(id)`. A learner who has
-- authenticated but not yet picked a class has a row in `auth.users` and NO row
-- in `profiles` — so every event emitted during onboarding failed the foreign
-- key and was thrown away.
--
-- `track()` fails open on purpose (analytics must never break a lesson), so this
-- lost data in total silence. It was found by counting rows after an end-to-end
-- run, not by a test and not by an error anyone saw:
--
--   [track] onboarding_started failed: insert or update on table "events"
--           violates foreign key constraint "events_student_id_fkey"
--
-- `onboarding_started` is precisely the event that measures that window, so the
-- one funnel step we added it for was the one step it could never record.
--
-- ── WHY auth.users IS THE RIGHT TARGET ──────────────────────────────────────
-- `profiles.id` already references `auth.users(id)`, so this widens the allowed
-- set rather than changing its meaning: every id that was valid before is still
-- valid. It is also the truer statement — an event belongs to whoever was
-- signed in, and being signed in is an `auth.users` fact.
--
-- `on delete set null` is kept exactly as it was. Deleting an account still
-- leaves its events behind with no owner, which is what makes historical counts
-- survive a deletion without keeping anything attached to the person (D11).
-- `DELETE /api/account` removes the rows outright first; this is the backstop.
--
-- RLS is untouched: `auth.uid() = student_id` still holds, and it now holds for
-- the onboarding window too.

alter table public.events
  drop constraint if exists events_student_id_fkey;

alter table public.events
  add constraint events_student_id_fkey
  foreign key (student_id) references auth.users(id) on delete set null;

comment on column public.events.student_id is
  'auth.users, NOT profiles — an event can precede the profile row (onboarding), '
  'and null means either an anonymous pre-account event or a deleted account.';
