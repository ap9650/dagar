-- 0016_summaries_for_links.sql — a weekly summary can belong to a LINK
-- Spec: D4 as amended 1 Aug 2026
--
-- `parent_summaries` was keyed on `parent_link_id`, which assumed every summary
-- had a registered parent behind it. D4's amendment made the link the primary
-- path, so a summary now belongs to EITHER:
--
--   parent_link_id   an adult who created an account and redeemed a code
--   summary_link_id  an adult holding a /s/[token] link and nothing else
--
-- Exactly one, enforced below. A row with both would be two delivery
-- relationships wearing one hat, and the "have we already sent this week?"
-- question would have two answers.

alter table public.parent_summaries
  alter column parent_link_id drop not null;

alter table public.parent_summaries
  add column if not exists summary_link_id uuid
    references public.summary_links(id) on delete cascade;

-- Named so a violation says what it means in the error text.
alter table public.parent_summaries
  drop constraint if exists parent_summaries_one_owner;

alter table public.parent_summaries
  add constraint parent_summaries_one_owner check (
    (parent_link_id is not null and summary_link_id is null) or
    (parent_link_id is null and summary_link_id is not null)
  );

-- The weekly idempotency guard, for the link path. The account path already has
-- unique (parent_link_id, week_start); this is its counterpart, and it is what
-- stops a cron re-run sending the same week twice.
create unique index if not exists parent_summaries_link_week_idx
  on public.parent_summaries (summary_link_id, week_start)
  where summary_link_id is not null;

-- `sms` was missing from the channel list: the notify layer has had an SMS
-- adapter since 3.2 (written, wired, off pending DLT registration), and a
-- delivery it cannot record is a delivery we cannot count.
alter table public.parent_summaries
  drop constraint if exists parent_summaries_channel_check;

alter table public.parent_summaries
  add constraint parent_summaries_channel_check
    check (channel in ('whatsapp', 'sms', 'in_app'));

-- Summaries on the link path are read through the token by the service role, so
-- they need no new RLS policy. The existing parent policy still covers the
-- account path, and students still have no policy here at all — the summary is
-- the supporting adult's surface, not the learner's.

comment on column public.parent_summaries.summary_link_id is
  'Set when the summary belongs to a token link rather than a registered parent '
  '(D4 amended). Exactly one of this and parent_link_id is non-null.';
