-- 0001_identity.sql — profiles, parent_links
-- Spec: docs/DATA_MODEL.md § Identity · docs/DECISIONS.md D2, D16

create extension if not exists "pgcrypto";

-- ─── profiles ────────────────────────────────────────────────────────────────
-- One row per auth.users. Minors: display name + grade only (D2).
-- No DOB, no address, no photo — do not add them.

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('student','parent')),
  display_name text,
  grade        int  check (grade in (6,7,8)),               -- null for parents
  locale       text not null default 'en' check (locale in ('en','hi')),  -- D16
  timezone     text not null default 'Asia/Kolkata',        -- D7 day boundary
  created_at   timestamptz not null default now(),
  -- a student must have a grade; a parent must not
  constraint grade_matches_role check (
    (role = 'student' and grade is not null) or
    (role = 'parent'  and grade is null)
  )
);

alter table public.profiles enable row level security;

create policy "users manage own profile"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─── parent_links ────────────────────────────────────────────────────────────
-- The ONLY cross-user boundary in the product. Parents never write learner data.

create table if not exists public.parent_links (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  parent_id      uuid references public.profiles(id) on delete set null, -- null until claimed
  link_code      text not null unique check (char_length(link_code) = 6),
  whatsapp_e164  text,
  status         text not null default 'pending'
                 check (status in ('pending','active','revoked')),
  created_at     timestamptz not null default now(),
  claimed_at     timestamptz
);

create index if not exists parent_links_student_idx on public.parent_links(student_id);
create index if not exists parent_links_parent_idx  on public.parent_links(parent_id);

alter table public.parent_links enable row level security;

create policy "students manage own link codes"
  on public.parent_links for all
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

create policy "parents read their own links"
  on public.parent_links for select
  using (auth.uid() = parent_id);

-- Claiming a code is a service-role route handler, not a client write:
-- the client must never be able to set parent_id to itself on an arbitrary row.

-- ─── profile visibility across the link ──────────────────────────────────────
-- A parent may read the linked student's profile row (display_name, grade, locale)
-- so the parent view can render it. Read only — there is no parent write path.

create policy "parents read linked student profile"
  on public.profiles for select
  using (exists (
    select 1 from public.parent_links pl
    where pl.student_id = profiles.id
      and pl.parent_id  = auth.uid()
      and pl.status     = 'active'
  ));

comment on table public.parent_links is
  'The only cross-user RLS boundary (D2). Parents read; parents never write.';
