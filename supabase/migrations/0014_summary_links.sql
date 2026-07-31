-- 0014_summary_links.sql — the no-account way to see a learner's week
-- Spec: D2 (linking), D4 (parent summaries) · decided 1 Aug 2026
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY A LINK THAT NEEDS NO PASSWORD, FOR A PRODUCT SERVING MINORS.
--
-- The account-plus-code path (parent_links) asks a supporting adult to create an
-- account and type a 6-character code. For a tutor or a parent in another city
-- that is worth it. For the most common case in this demographic it is not:
--
--   * the child is usually on the PARENT'S phone, so that parent can already see
--     everything by opening the app — a second account shows them strictly less
--   * the person who actually reads it is often the most literate person in the
--     household, frequently an older sibling, not the account holder
--   * a tutor sitting beside a parent should not have to make an account to
--     look at a summary WITH them
--
-- A link removes all of that: the learner taps share, the adult taps the link.
--
-- WHAT IT COSTS, STATED PLAINLY: a link with no password is forwardable. Anyone
-- holding it sees the summary. That is bounded deliberately —
--
--   * the token is 32 URL-safe characters from a CSPRNG, so it cannot be guessed
--   * it EXPIRES (90 days) and is revocable from the learner's own Settings
--   * it exposes SUMMARY fields only: lesson and practice counts, concept bands,
--     streak, badges. Never an answer, never a tutor message, never anything the
--     learner typed. Those live behind the account path and RLS, and this table
--     grants no route to them.
--
-- The harm if a link leaks is that someone learns a child did three lessons and
-- is working on fractions. The harm if we do not ship it is that the parent
-- feature goes unused by the families it exists for.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.summary_links (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  -- Long enough that enumeration is not a threat model. Unique so a collision is
  -- a write error rather than one learner's link opening another's summary.
  token          text not null unique check (char_length(token) between 24 and 64),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '90 days'),
  revoked_at     timestamptz,
  -- Not analytics. This is what lets a learner see that someone is actually
  -- reading it, and decide to revoke if they are not comfortable.
  last_viewed_at timestamptz,
  view_count     int not null default 0
);

create index if not exists summary_links_student_idx
  on public.summary_links (student_id, created_at desc);

-- One LIVE link per learner. Same reasoning as one pending parent code: every
-- extra live token is another copy of the key, and the cheapest way to have
-- fewer is to not mint them.
create unique index if not exists summary_links_one_live_idx
  on public.summary_links (student_id)
  where revoked_at is null;

alter table public.summary_links enable row level security;

-- The learner owns their own links: they create, see and revoke them.
create policy "students manage own summary links"
  on public.summary_links for all
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- NO policy for anon or for other authenticated users, deliberately. Resolving a
-- token happens in a route handler with the service role, exactly like claiming
-- a parent code — a client that could select by token could enumerate the table.

comment on table public.summary_links is
  'Token-authenticated read-only access to a learner''s weekly summary, for a '
  'supporting adult with no account (D4). Summary fields only — never answers, '
  'tutor messages or learner free text. Revocable by the learner, expires in 90 days.';
