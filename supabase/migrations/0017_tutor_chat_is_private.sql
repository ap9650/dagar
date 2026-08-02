-- 0017_tutor_chat_is_private.sql — the tutor conversation belongs to the learner
--
-- `/for-parents` promises, in both languages, that the questions a learner asks
-- the Dagar tutor stay private. The database did not enforce it: 0004_tutor.sql
-- gave any linked parent SELECT on tutor_messages.
--
-- The parent UI never rendered those rows, which is why this survived review —
-- but the anon key ships in the browser, so anything RLS permits is a few lines
-- away in devtools. The screen is not the boundary; the policy is.
--
-- Proved before removing, in tests/integration/privacy-promise.test.ts: a real
-- linked parent read back both of a child's tutor messages, including
-- "i dont understand any of this".
--
-- ── why this one and not the answers ────────────────────────────────────────
-- Product decision, 31 Jul 2026: a supporting adult MAY in future see the
-- questions a learner practised and the answers they gave — that is being kept
-- open deliberately. The tutor conversation is different in kind. It is where a
-- learner admits they do not understand something, and a learner who believes a
-- parent is reading it will stop saying so. Losing that costs more than the
-- transparency gains.
--
-- Nothing reads tutor_messages on the parent side, so this has no product
-- impact today. It is a door being locked before anyone walks through it.

drop policy if exists "parents read linked student tutor_messages"
  on public.tutor_messages;

comment on table public.tutor_messages is
  'The learner''s own conversation. NO parent policy, by design — see 0017. '
  'A learner must be able to type "I don''t understand" without an adult reading it. '
  'Parent-facing summaries are assembled from counts and mastery, never from this table.';
