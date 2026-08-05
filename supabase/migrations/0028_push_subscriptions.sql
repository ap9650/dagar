-- 0028_push_subscriptions.sql — where a learner's browser can be reached.
--
-- ── D17b WAS DECIDED IN JULY AND NEVER BUILT ────────────────────────────────
-- "Dagar sends a daily reminder notification, opt-in, worded as an invitation."
-- Nothing existed: no permission prompt, no subscription storage, no push
-- handler in the service worker, no cron. This is the storage half.
--
-- ── ONE ROW PER BROWSER, NOT PER LEARNER ────────────────────────────────────
-- A learner may use the family phone and a school tablet, and each browser
-- issues its own endpoint. `unique(endpoint)` rather than `unique(student_id)`:
-- the endpoint IS the identity of a subscription, and the same browser
-- re-subscribing must update rather than duplicate.
--
-- ── WHAT THE COLUMNS ARE ────────────────────────────────────────────────────
-- `endpoint` is a URL at the browser vendor's push service. `p256dh` and `auth`
-- are the keys that service uses to encrypt the payload — without them a push
-- cannot be delivered, and with them nobody but that browser can read it.
--
-- They are secrets in the sense that they address a child's device, so RLS
-- scopes them to their owner and nothing in the app ever selects them into a
-- page. Only the cron reads them, with the service role.

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,

  -- The push service URL for this browser. Unique across the table: two
  -- learners cannot share one, and one browser cannot hold two rows.
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,

  created_at    timestamptz not null default now(),
  -- Set when a send succeeds. A subscription that has never worked and is weeks
  -- old is a browser that granted permission and was never opened again.
  last_sent_at  timestamptz
);

create index if not exists push_subscriptions_student_idx
  on public.push_subscriptions(student_id);

alter table public.push_subscriptions enable row level security;

-- A learner manages their own subscriptions and nobody else's. The same shape
-- as every other learner-owned table.
create policy "students manage own push subscriptions"
  on public.push_subscriptions for all to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

comment on table public.push_subscriptions is
  'One row per BROWSER, not per learner — a shared family phone and a school '
  'tablet are two subscriptions. Read only by the reminder cron, service role.';
