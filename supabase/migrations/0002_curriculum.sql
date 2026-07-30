-- 0002_curriculum.sql — chapters, concepts, lessons, questions, questions_public
-- Spec: docs/DATA_MODEL.md § Curriculum · DECISIONS D1 (ncert_ref), D3, D16 (i18n)

-- ─── chapters ────────────────────────────────────────────────────────────────

create table if not exists public.chapters (
  id          uuid primary key default gen_random_uuid(),
  grade       int  not null check (grade in (6,7,8)),
  number      int  not null,
  title       text not null,
  slug        text not null unique,
  summary     text,
  ncert_ref   text,          -- cites BOTH NCERT editions — see D1
  order_index int  not null default 0,
  i18n        jsonb not null default '{}'::jsonb
);

comment on column public.chapters.ncert_ref is
  'Both editions, e.g. "Ganita Prakash Part 2 Ch 6 (Algebra Play) · old NCERT Ch 2". D1.';

-- ─── concepts ────────────────────────────────────────────────────────────────

create table if not exists public.concepts (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null references public.chapters(id) on delete cascade,
  name        text not null,
  slug        text not null unique,
  order_index int  not null default 0,
  i18n        jsonb not null default '{}'::jsonb
);

create index if not exists concepts_chapter_idx on public.concepts(chapter_id, order_index);

-- ─── lessons ─────────────────────────────────────────────────────────────────

create table if not exists public.lessons (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null references public.chapters(id) on delete cascade,
  concept_id  uuid not null references public.concepts(id) on delete cascade,
  order_index int  not null default 0,
  title       text not null,
  body_md     text not null,        -- KaTeX allowed
  est_minutes int  not null default 4,
  i18n        jsonb not null default '{}'::jsonb
);

create index if not exists lessons_chapter_idx on public.lessons(chapter_id, order_index);
create index if not exists lessons_concept_idx on public.lessons(concept_id);

-- ─── questions ───────────────────────────────────────────────────────────────
-- answer_value is NEVER localised (D16) and NEVER reaches the client (D3).

create table if not exists public.questions (
  id           uuid primary key default gen_random_uuid(),
  concept_id   uuid not null references public.concepts(id) on delete cascade,
  chapter_id   uuid not null references public.chapters(id) on delete cascade,
  kind         text not null check (kind in ('practice','quiz')),
  difficulty   int  not null check (difficulty between 1 and 3),
  stem_md      text not null,
  answer_type  text not null
               check (answer_type in ('mcq','integer','fraction','decimal','expression')),
  answer_value text not null,       -- canonical form; language-independent
  choices      jsonb,               -- mcq only
  solution_md  text not null,
  i18n         jsonb not null default '{}'::jsonb,  -- stem/solution/choice LABELS only
  created_at   timestamptz not null default now()
);

create index if not exists questions_concept_idx
  on public.questions(concept_id, kind, difficulty);
create index if not exists questions_chapter_idx on public.questions(chapter_id, kind);

comment on column public.questions.answer_value is
  'Never translated (D16), never sent to the client before grading (D3). '
  'Read via the service role in a route handler only.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.chapters  enable row level security;
alter table public.concepts  enable row level security;
alter table public.lessons   enable row level security;
alter table public.questions enable row level security;

-- Curriculum is public reference data: any signed-in user may read it.
create policy "authenticated read chapters"
  on public.chapters for select to authenticated using (true);
create policy "authenticated read concepts"
  on public.concepts for select to authenticated using (true);
create policy "authenticated read lessons"
  on public.lessons  for select to authenticated using (true);

-- DELIBERATELY NO SELECT POLICY ON public.questions.
-- RLS is enabled with no policy, so every client read returns zero rows.
-- Learners read questions_public (below); grading reads the base table with
-- the service role, which bypasses RLS. This is what keeps answer keys server-side.

-- ─── questions_public ────────────────────────────────────────────────────────
-- Excludes answer_value and solution_md. security_invoker is explicitly OFF so the
-- view executes as its owner and can read the RLS-locked base table. Stated rather
-- than inherited: if Postgres ever flips the default, this view still works.

create or replace view public.questions_public
  with (security_invoker = false) as
  select id, concept_id, chapter_id, kind, difficulty, stem_md, answer_type,
         choices, i18n, created_at
  from public.questions;

revoke all on public.questions_public from anon, authenticated;
grant select on public.questions_public to authenticated;

comment on view public.questions_public is
  'Answer-key-free projection of questions. The ONLY question source for client '
  'reads (D3). Adding answer_value or solution_md here is a security bug.';
