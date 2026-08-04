-- Why a learner deleted their account.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- THERE IS NO student_id HERE, AND THERE NEVER CAN BE.
--
-- This row is written AFTER the account is gone. That ordering is the whole
-- design: a child is never asked to answer questions in order to leave, and
-- what they say cannot be joined back to the person who said it, because the
-- person no longer exists in this database.
--
-- Do not add a student_id, a session id, or an IP column. Any of them turns an
-- anonymous exit note into a record about a named child who has just asked to
-- stop being one.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `reason` is a fixed enum, not free text. A learner leaving in frustration is
-- exactly who might type something identifying about themselves or their
-- school, and a text box we then keep would undo the paragraph above.
create table if not exists public.exit_reasons (
  id         uuid primary key default gen_random_uuid(),
  reason     text not null check (reason in (
               'too_hard', 'too_easy', 'confusing', 'not_useful', 'duplicate', 'other'
             )),
  -- Which language they were learning in. Aggregate only, and genuinely useful:
  -- "confusing" concentrated in one locale is a translation problem, not a
  -- product one.
  locale     text check (locale in ('en', 'hi')),
  created_at timestamptz not null default now()
);

create index if not exists exit_reasons_created_idx on public.exit_reasons(created_at desc);

alter table public.exit_reasons enable row level security;

-- No policies at all: nobody reads or writes this through the anon key. The
-- route handler writes it with the service role after checking a one-time
-- cookie, and it is read in SQL by a human looking at aggregates.
--
-- An empty policy set on an RLS-enabled table denies everything, which is the
-- correct default here and is why this comment exists rather than a policy.
