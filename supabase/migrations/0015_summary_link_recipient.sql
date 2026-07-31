-- 0015_summary_link_recipient.sql — where the weekly summary gets sent
-- Spec: D4 as amended 1 Aug 2026
--
-- The recipient now comes from the LEARNER, not from a parent account. D4's
-- original shape hung delivery off `parent_links.whatsapp_e164`, which meant the
-- weekly message could only reach an adult who had registered and redeemed a
-- code — friction that the common case does not justify (see D4's amendment).
--
-- So the number lives beside the link it is going to be sent with. One row now
-- carries the whole delivery relationship: who to reach, and what to show them.
--
-- ── THIS IS AN ADULT'S PHONE NUMBER, TYPED BY A CHILD ───────────────────────
-- Two rules follow, and they are not optional:
--
--   1. It never enters `events`, a prompt, or any log. It is PII, and it is not
--      even the PII of the account holder.
--   2. A number a learner typed is an INTENTION, not a permission. The Twilio
--      sandbox requires the recipient to send a join code from their own
--      WhatsApp before anything reaches them — `recipient_opted_in_at` records
--      that, and delivery checks it. The adult consents from their own phone.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.summary_links
  add column if not exists recipient_e164 text
    check (recipient_e164 is null or recipient_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  add column if not exists recipient_opted_in_at timestamptz,
  add column if not exists last_sent_at timestamptz;

comment on column public.summary_links.recipient_e164 is
  'WhatsApp number for the weekly summary, entered by the LEARNER (D4 amended). '
  'E.164. An adult''s PII: never in events, never in a prompt, never logged.';

comment on column public.summary_links.recipient_opted_in_at is
  'When the recipient joined from their own WhatsApp. Null means not opted in, '
  'and delivery must not proceed — a number a child typed is an intention, not '
  'a permission.';

-- Delivery reads "who is due a summary" across all learners, so it wants an
-- index that is not per-student.
create index if not exists summary_links_delivery_idx
  on public.summary_links (recipient_opted_in_at, last_sent_at)
  where revoked_at is null and recipient_e164 is not null;
