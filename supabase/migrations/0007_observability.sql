-- 0006b_observability.sql — ai_calls, tutor_feedback
-- Spec: docs/DATA_MODEL.md § Observability · DECISIONS D11 (cost, daily ceiling)

-- ─── ai_calls ────────────────────────────────────────────────────────────────
-- One row per model call. The only place product context (which lesson, which
-- concept) sits next to cost context. Also backs the D11 daily spend ceiling.

create table if not exists public.ai_calls (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid references public.profiles(id) on delete set null,
  kind              text not null check (kind in ('tutor','hint','summary')),
  model             text not null,
  lesson_id         uuid references public.lessons(id)  on delete set null,
  concept_id        uuid references public.concepts(id) on delete set null,
  input_tokens      int  not null default 0,
  output_tokens     int  not null default 0,
  cache_read_tokens int  not null default 0,
  cost_inr          numeric(10,4) not null default 0,
  latency_ms        int,
  ttft_ms           int,
  ok                boolean not null default true,
  error             text,
  created_at        timestamptz not null default now()
);

create index if not exists ai_calls_created_idx      on public.ai_calls(created_at desc);
create index if not exists ai_calls_student_idx      on public.ai_calls(student_id, created_at desc);
create index if not exists ai_calls_kind_created_idx on public.ai_calls(kind, created_at desc);

alter table public.ai_calls enable row level security;
-- No client policy at all. Written and read with the service role only:
-- writing must never fail a learner's request, and reading is an admin concern.

comment on table public.ai_calls is
  'Writing this row must NEVER fail the user request — log and swallow (D11). '
  'cost_inr also backs the daily spend ceiling that degrades the tutor gracefully.';

-- Today's spend in Asia/Kolkata — the D11 ceiling check, one indexed query.
create or replace function public.ai_spend_today()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(cost_inr), 0)
  from public.ai_calls
  where created_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata')
                       at time zone 'Asia/Kolkata');
$$;

-- ─── tutor_feedback ──────────────────────────────────────────────────────────
-- One tap, no dialog. The highest-value eval signal in the product.

create table if not exists public.tutor_feedback (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles(id) on delete cascade,
  tutor_message_id uuid not null references public.tutor_messages(id) on delete cascade,
  helpful          boolean not null,
  created_at       timestamptz not null default now(),
  unique (student_id, tutor_message_id)   -- one verdict per message; tapping again updates
);

create index if not exists tutor_feedback_created_idx on public.tutor_feedback(created_at desc);

alter table public.tutor_feedback enable row level security;

create policy "students manage own tutor_feedback"
  on public.tutor_feedback for all
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);
