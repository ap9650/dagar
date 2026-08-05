-- 0025_streak_ladder.sql
-- The streak gets somewhere to go.
--
-- ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
-- `streak_7` was the last habit milestone a learner could ever earn. From day 8
-- onward the streak counted up toward nothing — a number, not a goal. Combined
-- with the seven one-shot badges, a learner in week two had already met every
-- reward the product had, which is the dead end the whole progress screen
-- suffered from.
--
-- This adds the rest of the rungs: 14, 30, 100, 180, 365. See
-- `lib/learning/streakLadder.ts` for why these numbers, why 3 and 180 are in
-- the list when Duolingo's is 7/30/100/365, and why the ladder stops at a year
-- instead of repeating forever (repeating is points with extra steps, and D17
-- refuses points).
--
-- ── THE AWARD LOOP REPLACES SIX COPY-PASTED BLOCKS ──────────────────────────
-- The old function had one hand-written block per streak code. Seven rungs
-- would have made seven, each a place to mistype a threshold. It is a loop over
-- an array now, so adding a rung later is one number in one place.
--
-- Idempotent as before: `unique(student_id, code)` plus `on conflict do
-- nothing` means a learner on day 200 who completes a second lesson does not
-- re-earn 3, 7, 14, 30 or 100. It also means a learner whose streak is ALREADY
-- past a new rung earns it on their next completion rather than retroactively —
-- correct, and the reason the ladder shipped before the first cohort rather
-- than after it.

-- ── 1. widen the allowed codes ──────────────────────────────────────────────
alter table public.milestones
  drop constraint if exists milestones_code_check;

alter table public.milestones
  add constraint milestones_code_check check (code in (
    'first_lesson','first_practice',
    'streak_3','streak_7','streak_14','streak_30','streak_100','streak_180','streak_365',
    'concept_mastered','chapter_complete','chapter_mastered'
  ));

-- ── 2. award every rung the streak has passed ───────────────────────────────
create or replace function public.award_milestones(
  p_student_id uuid,
  p_context    jsonb default '{}'::jsonb
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_awarded text[] := array[]::text[];
  v_streak  int;
  v_rung    int;
  v_code    text;
  v_hit     boolean;
begin
  -- first_lesson
  if exists (select 1 from public.lesson_progress
             where student_id = p_student_id and status = 'completed') then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'first_lesson', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := array_append(v_awarded, 'first_lesson'); end if;
  end if;

  -- first_practice
  if exists (select 1 from public.attempts
             where student_id = p_student_id and session_kind = 'practice') then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'first_practice', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := array_append(v_awarded, 'first_practice'); end if;
  end if;

  -- ── the streak ladder ─────────────────────────────────────────────────────
  -- One loop, not one block per rung. This array is the SQL mirror of
  -- STREAK_RUNGS in lib/learning/streakLadder.ts; change one and change the
  -- other in the same commit, the same rule the streak function already lives
  -- under.
  select current into v_streak from public.streaks where student_id = p_student_id;

  foreach v_rung in array array[3, 7, 14, 30, 100, 180, 365]
  loop
    if coalesce(v_streak, 0) >= v_rung then
      v_code := 'streak_' || v_rung;
      insert into public.milestones (student_id, code, context)
      values (p_student_id, v_code, p_context)
      on conflict (student_id, code) do nothing;
      if found then v_awarded := array_append(v_awarded, v_code); end if;
    end if;
  end loop;

  -- concept_mastered — any concept at all
  if exists (select 1 from public.concept_mastery
             where student_id = p_student_id and is_mastered) then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'concept_mastered', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := array_append(v_awarded, 'concept_mastered'); end if;
  end if;

  -- chapter_complete — every lesson in some chapter completed
  select exists (
    select 1 from public.chapters c
    where exists (select 1 from public.lessons l where l.chapter_id = c.id)
      and not exists (
        select 1 from public.lessons l
        where l.chapter_id = c.id
          and not exists (
            select 1 from public.lesson_progress lp
            where lp.lesson_id = l.id
              and lp.student_id = p_student_id
              and lp.status = 'completed'
          )
      )
  ) into v_hit;

  if v_hit then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'chapter_complete', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := array_append(v_awarded, 'chapter_complete'); end if;
  end if;

  -- chapter_mastered — every concept in some chapter mastered
  select exists (
    select 1 from public.chapters c
    where exists (select 1 from public.concepts cn where cn.chapter_id = c.id)
      and not exists (
        select 1 from public.concepts cn
        where cn.chapter_id = c.id
          and not exists (
            select 1 from public.concept_mastery cm
            where cm.concept_id = cn.id
              and cm.student_id = p_student_id
              and cm.is_mastered
          )
      )
  ) into v_hit;

  if v_hit then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'chapter_mastered', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := array_append(v_awarded, 'chapter_mastered'); end if;
  end if;

  return v_awarded;
end $$;

revoke all on function public.award_milestones(uuid, jsonb) from public;

comment on function public.award_milestones is
  'Awards every milestone a learner has earned. The streak rungs are a loop over '
  '{3,7,14,30,100,180,365} — the SQL mirror of STREAK_RUNGS in '
  'lib/learning/streakLadder.ts. Change both in the same commit.';
