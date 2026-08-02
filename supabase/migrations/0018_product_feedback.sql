-- 0018_product_feedback.sql — what real users think of Dagar
--
-- Collected for the buildathon submission ("working product with real user
-- feedback attached") and, more usefully, to find out what actually confuses a
-- learner. Distinct from `tutor_feedback`, which is a thumbs up/down on ONE
-- model response; this is about the product.
--
-- ── the questions, and why these five ───────────────────────────────────────
-- Every extra field costs responses, and the respondents include 11–14 year
-- olds on phones. Five questions, two of them optional text, is about 60
-- seconds — past roughly 90 you get abandonment or garbage.
--
-- Deliberately NOT a 1–5 star rating. For a learning product "did you
-- understand something" is the claim being tested; "4.2 out of 5" is a number
-- nobody can act on and a judge discounts on sight.
--
-- ── one row per person ──────────────────────────────────────────────────────
-- A unique index rather than an append-only log: someone who answers twice has
-- changed their mind, not given two opinions. Counting rows then counts PEOPLE,
-- which is the claim the submission makes.
--
-- ── no email here, and none in the export ───────────────────────────────────
-- `user_id` proves the responses came from distinct real accounts. The address
-- itself lives in auth.users because signup needs it — but under India's DPDP
-- Act an under-18 is a child, and copying children's email addresses into a file
-- handed to a third party is a disclosure with no necessity behind it.
-- `scripts/export-feedback.ts` never selects the column.

create table if not exists public.product_feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,

  -- Segments everything. A teacher saying "the explanation is wrong" and a
  -- learner saying "it was boring" are not the same signal.
  respondent_role text not null
    check (respondent_role in ('student', 'parent', 'teacher', 'other')),

  -- The headline measure: did it teach anybody anything.
  understood text not null check (understood in ('yes', 'a_bit', 'no')),

  -- Optional on purpose: a shy 12-year-old who taps three buttons still counts,
  -- and a motivated teacher can write three paragraphs.
  worked_well text check (char_length(worked_well) <= 1000),
  confusing   text check (char_length(confusing)   <= 1000),

  -- Behavioural intent, which beats satisfaction.
  would_return text not null check (would_return in ('yes', 'maybe', 'no')),

  -- Which language they actually used it in — worth knowing whether the Hindi
  -- build got real use or only the English one did.
  locale     text not null default 'en',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_feedback_one_per_user
  on public.product_feedback(user_id);

alter table public.product_feedback enable row level security;

-- Own row only, read and write. Nobody reads anyone else's: this table holds
-- free text a learner typed, and "what confused me" is not for other learners.
-- The export reads with the service role.
create policy "users manage own feedback"
  on public.product_feedback for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.product_feedback is
  'Product feedback from real users. One row per person (unique on user_id), so a '
  'row count is a PEOPLE count. No email column by design — see 0018 and '
  'scripts/export-feedback.ts.';
