-- 0007_functions.sql — recompute_concept_mastery, extend_streak, award_milestones
-- Spec: DECISIONS D5 (mastery), D7 (streaks), D7b (milestones)
--
-- All three are SERVER-SIDE TRUTH. Never trust a client-supplied score or streak.
-- All three are IDEMPOTENT: calling twice for the same event changes nothing.

-- ─── D5: concept mastery ─────────────────────────────────────────────────────
-- score = correct ÷ attempted over the learner's LAST 5 attempts on that concept.
-- Mastered at score >= 0.8 with >= 3 attempts.
--
-- The 5-attempt window is deliberate and kind: a learner who starts badly and
-- improves sees their early failures fall out of the window. An all-time average
-- would pin them below the line forever.

create or replace function public.recompute_concept_mastery(
  p_student_id uuid,
  p_concept_id uuid
) returns public.concept_mastery
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total    int;
  v_correct  int;
  v_score    numeric(4,3);
  v_mastered boolean;
  v_row      public.concept_mastery;
begin
  select count(*), count(*) filter (where w.is_correct)
    into v_total, v_correct
  from (
    select a.is_correct
    from public.attempts a
    where a.student_id = p_student_id
      and a.concept_id = p_concept_id
    order by a.created_at desc
    limit 5                                   -- the D5 window
  ) w;

  v_score    := case when v_total = 0 then 0
                     else round(v_correct::numeric / v_total, 3) end;
  v_mastered := (v_score >= 0.8 and v_total >= 3);   -- both conditions required

  insert into public.concept_mastery
        (student_id, concept_id, score, attempts_count, is_mastered, updated_at)
  values (p_student_id, p_concept_id, v_score, v_total, v_mastered, now())
  on conflict (student_id, concept_id) do update
    set score = excluded.score,
        attempts_count = excluded.attempts_count,
        is_mastered = excluded.is_mastered,
        updated_at = now()
  returning * into v_row;

  return v_row;
end $$;

-- ─── D7: streaks ─────────────────────────────────────────────────────────────
-- Call with the learner's activity DATE in Asia/Kolkata. Caller decides the day
-- qualified (>= 1 lesson completed OR >= 5 practice questions).
--
-- One grace day per rolling 7: a single missed day does not reset the streak.

create or replace function public.extend_streak(
  p_student_id uuid,
  p_date       date default (now() at time zone 'Asia/Kolkata')::date
) returns public.streaks
language plpgsql
security definer
set search_path = public
as $$
declare
  s          public.streaks;
  v_gap      int;
  v_grace_ok boolean;
begin
  select * into s from public.streaks where student_id = p_student_id;

  if not found then
    insert into public.streaks (student_id, current, longest, last_active_date)
    values (p_student_id, 1, 1, p_date)
    returning * into s;
    return s;
  end if;

  -- Already counted today — idempotent, a second lesson does not extend again.
  if s.last_active_date = p_date then
    return s;
  end if;

  -- Backdated call: never rewind a streak.
  if s.last_active_date > p_date then
    return s;
  end if;

  v_gap := p_date - s.last_active_date;

  if v_gap = 1 then
    s.current := s.current + 1;

  elsif v_gap = 2 then
    -- Exactly one day missed. Spend the grace day if it is available.
    v_grace_ok := (s.grace_used_on is null or s.grace_used_on <= p_date - 7);
    if v_grace_ok then
      s.current       := s.current + 1;
      s.grace_used_on := p_date - 1;         -- the day that was forgiven
    else
      s.current := 1;
    end if;

  else
    s.current := 1;                          -- two or more days missed
  end if;

  update public.streaks
     set current          = s.current,
         longest          = greatest(longest, s.current),
         last_active_date = p_date,
         grace_used_on    = s.grace_used_on,
         updated_at       = now()
   where student_id = p_student_id
  returning * into s;

  return s;
end $$;

-- ─── D7b: milestones ─────────────────────────────────────────────────────────
-- Evaluates all seven codes and returns only the ones newly awarded, so the caller
-- knows which toasts to show. unique(student_id, code) makes re-running a no-op.
--
-- A milestone is a MOMENT, not a state: once earned it is never revoked, even if
-- mastery later drops below the threshold.

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
  r         record;
begin
  -- first_lesson
  if exists (select 1 from public.lesson_progress
             where student_id = p_student_id and status = 'completed') then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'first_lesson', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := v_awarded || 'first_lesson'; end if;
  end if;

  -- first_practice
  if exists (select 1 from public.attempts
             where student_id = p_student_id and session_kind = 'practice') then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'first_practice', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := v_awarded || 'first_practice'; end if;
  end if;

  -- streak_3 / streak_7
  select current into v_streak from public.streaks where student_id = p_student_id;
  if coalesce(v_streak, 0) >= 3 then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'streak_3', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := v_awarded || 'streak_3'; end if;
  end if;
  if coalesce(v_streak, 0) >= 7 then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'streak_7', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := v_awarded || 'streak_7'; end if;
  end if;

  -- concept_mastered — any concept at all
  if exists (select 1 from public.concept_mastery
             where student_id = p_student_id and is_mastered) then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'concept_mastered', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := v_awarded || 'concept_mastered'; end if;
  end if;

  -- chapter_complete — every lesson in some chapter completed
  select c.id into r from public.chapters c
   where exists (select 1 from public.lessons l where l.chapter_id = c.id)
     and not exists (
       select 1 from public.lessons l
       where l.chapter_id = c.id
         and not exists (
           select 1 from public.lesson_progress lp
           where lp.lesson_id = l.id
             and lp.student_id = p_student_id
             and lp.status = 'completed'))
   limit 1;
  if found then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'chapter_complete', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := v_awarded || 'chapter_complete'; end if;
  end if;

  -- chapter_mastered — every concept in some chapter mastered
  select c.id into r from public.chapters c
   where exists (select 1 from public.concepts cn where cn.chapter_id = c.id)
     and not exists (
       select 1 from public.concepts cn
       where cn.chapter_id = c.id
         and not exists (
           select 1 from public.concept_mastery cm
           where cm.concept_id = cn.id
             and cm.student_id = p_student_id
             and cm.is_mastered))
   limit 1;
  if found then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'chapter_mastered', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := v_awarded || 'chapter_mastered'; end if;
  end if;

  return v_awarded;
end $$;

-- Functions are granted to PUBLIC by default in Postgres, so revoking from anon and
-- authenticated alone would leave them callable. Revoke from PUBLIC, then grant the
-- service role explicitly — these run from route handlers, never from a browser.
revoke all on function public.recompute_concept_mastery(uuid, uuid) from public;
revoke all on function public.extend_streak(uuid, date)             from public;
revoke all on function public.award_milestones(uuid, jsonb)         from public;
revoke all on function public.ai_spend_today()                      from public;

grant execute on function public.recompute_concept_mastery(uuid, uuid) to service_role;
grant execute on function public.extend_streak(uuid, date)             to service_role;
grant execute on function public.award_milestones(uuid, jsonb)         to service_role;
grant execute on function public.ai_spend_today()                      to service_role;
