-- 0006_analytics.sql — events
-- Spec: docs/DATA_MODEL.md § Analytics (canonical event names)

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete set null,
  name       text not null,
  props      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_name_created_idx    on public.events(name, created_at desc);
create index if not exists events_student_created_idx on public.events(student_id, created_at desc);

alter table public.events enable row level security;

-- Insert-only for learners. Nobody reads events through the client — /admin/metrics
-- aggregates with the service role. An events table a learner can read is a
-- cross-learner leak waiting to happen.
create policy "students insert own events"
  on public.events for insert to authenticated
  with check (auth.uid() = student_id);

comment on table public.events is
  'Canonical names only — see DATA_MODEL.md. Inventing an off-list name breaks the '
  'MVP success metrics, which are keyed to these exact strings.';
