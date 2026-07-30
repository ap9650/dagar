-- 0009_fix_award_milestones.sql
--
-- Fixes a bug in 0008: `v_awarded := v_awarded || 'first_lesson'` raised
--   22P02 malformed array literal: "first_lesson"
-- because `text[] || <untyped literal>` is ambiguous — Postgres tries to parse the
-- right-hand side as an ARRAY LITERAL rather than appending it as an element.
--
-- Fixed with array_append(), which can only mean "append one element".
-- 0008 is already applied, so this replaces the function forward rather than
-- editing history (CLAUDE.md: migrations are forward-only).

create or replace function public.award_milestones(
  p_student_id uuid,
  p_context    jsonb default '{}'::jsonb
) returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_awarded text[] := '{}';
  v_streak  int;
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

  -- streak_3 / streak_7
  select current into v_streak from public.streaks where student_id = p_student_id;

  if coalesce(v_streak, 0) >= 3 then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'streak_3', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := array_append(v_awarded, 'streak_3'); end if;
  end if;

  if coalesce(v_streak, 0) >= 7 then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'streak_7', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := array_append(v_awarded, 'streak_7'); end if;
  end if;

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
            where lp.lesson_id  = l.id
              and lp.student_id = p_student_id
              and lp.status     = 'completed'))
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
              and cm.is_mastered))
  ) into v_hit;
  if v_hit then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'chapter_mastered', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := array_append(v_awarded, 'chapter_mastered'); end if;
  end if;

  return v_awarded;
end $$;

revoke all  on function public.award_milestones(uuid, jsonb) from public;
grant execute on function public.award_milestones(uuid, jsonb) to service_role;
