-- 0003_learner_state.sql — lesson_progress, attempts, quiz_sessions,
--                          concept_mastery, streaks, milestones
-- Spec: docs/DATA_MODEL.md § Learner state · DECISIONS D5, D7, D7b

-- ─── lesson_progress ─────────────────────────────────────────────────────────

create table if not exists public.lesson_progress (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  lesson_id    uuid not null references public.lessons(id)  on delete cascade,
  status       text not null default 'started' check (status in ('started','completed')),
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  unique (student_id, lesson_id)
);

create index if not exists lesson_progress_student_idx on public.lesson_progress(student_id);

-- ─── quiz_sessions ───────────────────────────────────────────────────────────
-- Declared before attempts: attempts.quiz_session_id references it.

create table if not exists public.quiz_sessions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  chapter_id   uuid not null references public.chapters(id) on delete cascade,
  score        int,
  total        int,
  mastery_band text check (mastery_band in ('needs_revision','developing','mastered')),
  started_at   timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists quiz_sessions_student_idx
  on public.quiz_sessions(student_id, started_at desc);

-- ─── attempts ────────────────────────────────────────────────────────────────
-- concept_id is denormalised so mastery queries never join.

create table if not exists public.attempts (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.profiles(id)  on delete cascade,
  question_id     uuid not null references public.questions(id) on delete cascade,
  concept_id      uuid not null references public.concepts(id)  on delete cascade,
  given_answer    text not null,
  is_correct      boolean not null,
  hints_used      int  not null default 0,
  ms_taken        int,
  session_kind    text not null check (session_kind in ('practice','quiz')),
  quiz_session_id uuid references public.quiz_sessions(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- The index the D5 mastery window rides on: last 5 attempts per student+concept.
create index if not exists attempts_mastery_idx
  on public.attempts(student_id, concept_id, created_at desc);
create index if not exists attempts_student_created_idx
  on public.attempts(student_id, created_at desc);

-- ─── concept_mastery (derived — D5) ──────────────────────────────────────────
-- Recomputed on attempt write. Never client-supplied.

create table if not exists public.concept_mastery (
  student_id     uuid not null references public.profiles(id) on delete cascade,
  concept_id     uuid not null references public.concepts(id) on delete cascade,
  score          numeric(4,3) not null default 0 check (score between 0 and 1),
  attempts_count int  not null default 0,
  is_mastered    boolean not null default false,
  updated_at     timestamptz not null default now(),
  primary key (student_id, concept_id)
);

-- ─── streaks (derived — D7) ──────────────────────────────────────────────────
-- Dates, not timestamps: a learner active at 11pm and 1am IST has two active days.

create table if not exists public.streaks (
  student_id       uuid primary key references public.profiles(id) on delete cascade,
  current          int  not null default 0,
  longest          int  not null default 0,
  last_active_date date,
  grace_used_on    date,
  updated_at       timestamptz not null default now()
);

comment on column public.streaks.last_active_date is
  'A DATE in Asia/Kolkata, never a timestamp (D7). Storing UTC timestamps here is '
  'the bug that ships: 11pm and 1am IST are two different days.';

-- ─── milestones (D7b) ────────────────────────────────────────────────────────
-- unique(student_id, code) makes re-awarding a no-op.

create table if not exists public.milestones (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  code       text not null check (code in (
               'first_lesson','first_practice','streak_3','streak_7',
               'concept_mastered','chapter_complete','chapter_mastered')),
  context    jsonb not null default '{}'::jsonb,
  earned_at  timestamptz not null default now(),
  unique (student_id, code)
);

create index if not exists milestones_student_idx on public.milestones(student_id, earned_at desc);

-- ─── RLS: student owns own rows; linked parent reads them ────────────────────

alter table public.lesson_progress  enable row level security;
alter table public.attempts         enable row level security;
alter table public.quiz_sessions    enable row level security;
alter table public.concept_mastery  enable row level security;
alter table public.streaks          enable row level security;
alter table public.milestones       enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'lesson_progress','attempts','quiz_sessions','concept_mastery','streaks','milestones'
  ] loop
    execute format($f$
      create policy "students manage own %1$s"
        on public.%1$I for all
        using (auth.uid() = student_id)
        with check (auth.uid() = student_id);
    $f$, t);

    execute format($f$
      create policy "parents read linked student %1$s"
        on public.%1$I for select
        using (exists (
          select 1 from public.parent_links pl
          where pl.student_id = %1$I.student_id
            and pl.parent_id  = auth.uid()
            and pl.status     = 'active'
        ));
    $f$, t);
  end loop;
end $$;

-- No parent write policy exists on any table above, by design (D2).
