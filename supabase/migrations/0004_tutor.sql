-- 0004_tutor.sql — tutor_messages
-- Spec: docs/DATA_MODEL.md § Learner state · DECISIONS D11 (90-day retention)

create table if not exists public.tutor_messages (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id  uuid references public.lessons(id) on delete set null,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists tutor_messages_student_idx
  on public.tutor_messages(student_id, created_at desc);
create index if not exists tutor_messages_lesson_idx
  on public.tutor_messages(student_id, lesson_id, created_at);
-- Supports the 90-day retention sweep (D11).
create index if not exists tutor_messages_created_idx on public.tutor_messages(created_at);

alter table public.tutor_messages enable row level security;

create policy "students manage own tutor_messages"
  on public.tutor_messages for all
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

create policy "parents read linked student tutor_messages"
  on public.tutor_messages for select
  using (exists (
    select 1 from public.parent_links pl
    where pl.student_id = tutor_messages.student_id
      and pl.parent_id  = auth.uid()
      and pl.status     = 'active'
  ));

comment on table public.tutor_messages is
  'Retention: 90 days, then aggregate-only (D11). Minors data — the tutor must '
  'never request personal information, so none should ever appear here.';
