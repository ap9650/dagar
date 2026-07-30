-- 0005_support.sql — mentor_requests, parent_summaries
-- Spec: docs/DATA_MODEL.md § Support & engagement · DECISIONS D6, D8, D4

-- ─── mentor_requests (D6 triggers, D8 capture-only) ──────────────────────────
-- No mentor-side UI in MVP. Status is moved by hand.

create table if not exists public.mentor_requests (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  concept_id   uuid references public.concepts(id) on delete set null,
  trigger      text not null check (trigger in (
                 'three_consecutive_incorrect',   -- D6 rule 1
                 'hints_exhausted_twice',         -- D6 rule 2
                 'tutor_turns_no_practice')),     -- D6 rule 3
  learner_note text,
  context      jsonb not null default '{}'::jsonb,  -- recent attempts + tutor excerpt
  status       text not null default 'open'
               check (status in ('open','acknowledged','resolved')),
  created_at   timestamptz not null default now()
);

create index if not exists mentor_requests_student_idx
  on public.mentor_requests(student_id, created_at desc);
-- Clustering by concept is the product signal: a cluster usually means a bad lesson.
create index if not exists mentor_requests_concept_idx
  on public.mentor_requests(concept_id, created_at desc);

alter table public.mentor_requests enable row level security;

create policy "students manage own mentor_requests"
  on public.mentor_requests for all
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

create policy "parents read linked student mentor_requests"
  on public.mentor_requests for select
  using (exists (
    select 1 from public.parent_links pl
    where pl.student_id = mentor_requests.student_id
      and pl.parent_id  = auth.uid()
      and pl.status     = 'active'
  ));

-- ─── parent_summaries (D4) ───────────────────────────────────────────────────
-- Keyed on the LINK, not the student: a parent reads only their own link's rows.

create table if not exists public.parent_summaries (
  id              uuid primary key default gen_random_uuid(),
  parent_link_id  uuid not null references public.parent_links(id) on delete cascade,
  week_start      date not null,
  payload         jsonb not null default '{}'::jsonb,
  channel         text not null check (channel in ('whatsapp','in_app')),
  delivered_at    timestamptz,
  delivery_status text,
  tracking_token  text unique,      -- powers Parent Summary Engagement (D4)
  opened_at       timestamptz,
  created_at      timestamptz not null default now(),
  unique (parent_link_id, week_start)
);

create index if not exists parent_summaries_link_idx
  on public.parent_summaries(parent_link_id, week_start desc);

alter table public.parent_summaries enable row level security;

create policy "parents read own link summaries"
  on public.parent_summaries for select
  using (exists (
    select 1 from public.parent_links pl
    where pl.id        = parent_summaries.parent_link_id
      and pl.parent_id = auth.uid()
      and pl.status    = 'active'
  ));

-- Summaries are written by the Vercel cron via the service role. Students have no
-- policy here at all — the summary is the parent's surface, not the learner's.

comment on table public.parent_summaries is
  'Written by the weekly cron with the service role. tracking_token backs the '
  'Parent Summary Engagement metric that replaced "open rate" (D4).';
