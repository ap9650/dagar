-- 0027_badge_ladders.sql
-- Badges stop dead-ending.
--
-- ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
-- Seven one-shot badges. Once earned, the grid became a wall of gold that
-- quietly said "you are finished here" — to a learner who was, at most, two
-- weeks in. `concept_mastered` fired on the first concept ever and never again,
-- however many followed; `chapter_complete` the same.
--
-- Five new codes turn the two counting badges into ladders:
--
--   Ideas mastered      1 · 5 · 15 · 40      (concept_mastered is rung 1)
--   Chapters finished   1 · 3 · 10           (chapter_complete   is rung 1)
--
-- ── WHY THESE NUMBERS ───────────────────────────────────────────────────────
-- Our chapters carry four concepts and a full NCERT class runs to roughly ten
-- chapters, so about forty ideas IS a class. Every ladder in this product tops
-- out at the edge of the learner's horizon rather than inside it: reaching the
-- top rung should mean "you finished the year", never "you are 40% through it".
--
-- A first draft topped out at 20 ideas, which a learner would hit halfway
-- through a single class — a dead end inside the product, which is the exact
-- thing ladders exist to prevent.
--
-- Nothing repeats past the top. "Another badge every ten ideas" is points with
-- extra steps, and D17 refuses points because a second score competes with
-- concept mastery, which is the score that means something.
--
-- ── NOBODY LOSES A BADGE ────────────────────────────────────────────────────
-- Purely additive. Every existing code keeps its meaning and becomes rung 1 of
-- its ladder, so a learner who has earned `concept_mastered` still has it and
-- now has somewhere to go next.

-- ── 1. widen the allowed codes ──────────────────────────────────────────────
alter table public.milestones
  drop constraint if exists milestones_code_check;

alter table public.milestones
  add constraint milestones_code_check check (code in (
    'first_lesson','first_practice',
    'streak_3','streak_7','streak_14','streak_30','streak_100','streak_180','streak_365',
    'concept_mastered','concepts_5','concepts_15','concepts_40',
    'chapter_complete','chapters_3','chapters_10',
    'chapter_mastered'
  ));

-- ── 2. award every rung a learner has passed ────────────────────────────────
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
  v_awarded  text[] := array[]::text[];
  v_streak   int;
  v_concepts int;
  v_chapters int;
  v_rung     int;
  v_code     text;
  v_hit      boolean;
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
  -- Mirrors STREAK_RUNGS in lib/learning/streakLadder.ts. A test parses this
  -- array out of the migration and asserts the two agree.
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

  -- ── the ideas-mastered ladder ─────────────────────────────────────────────
  -- Rung 1 keeps its original name. Renaming `concept_mastered` to
  -- `concepts_1` would have been tidier and would have orphaned every badge
  -- already earned, plus its copy in two languages.
  select count(*) into v_concepts
  from public.concept_mastery
  where student_id = p_student_id and is_mastered;

  if coalesce(v_concepts, 0) >= 1 then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'concept_mastered', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := array_append(v_awarded, 'concept_mastered'); end if;
  end if;

  foreach v_rung in array array[5, 15, 40]
  loop
    if coalesce(v_concepts, 0) >= v_rung then
      v_code := 'concepts_' || v_rung;
      insert into public.milestones (student_id, code, context)
      values (p_student_id, v_code, p_context)
      on conflict (student_id, code) do nothing;
      if found then v_awarded := array_append(v_awarded, v_code); end if;
    end if;
  end loop;

  -- ── the chapters-finished ladder ──────────────────────────────────────────
  -- A chapter counts when every lesson in it is complete. Chapters with no
  -- lessons seeded are excluded, or an empty chapter would award a badge for
  -- vacuous truth — the `exists` clause is doing real work.
  select count(*) into v_chapters
  from public.chapters c
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
    );

  if coalesce(v_chapters, 0) >= 1 then
    insert into public.milestones (student_id, code, context)
    values (p_student_id, 'chapter_complete', p_context)
    on conflict (student_id, code) do nothing;
    if found then v_awarded := array_append(v_awarded, 'chapter_complete'); end if;
  end if;

  foreach v_rung in array array[3, 10]
  loop
    if coalesce(v_chapters, 0) >= v_rung then
      v_code := 'chapters_' || v_rung;
      insert into public.milestones (student_id, code, context)
      values (p_student_id, v_code, p_context)
      on conflict (student_id, code) do nothing;
      if found then v_awarded := array_append(v_awarded, v_code); end if;
    end if;
  end loop;

  -- ── chapter_mastered — every concept in some chapter mastered ─────────────
  -- Not a rung on any ladder. It is a depth achievement, not a count, and
  -- forcing it onto the "chapters finished" ladder would say that mastering a
  -- chapter is the same as finishing ten — which it is not.
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
  'Awards every milestone a learner has earned. Three ladders — streak days '
  '{3,7,14,30,100,180,365}, ideas mastered {1,5,15,40}, chapters finished '
  '{1,3,10} — mirrored in lib/learning/badgeLadders.ts. Change both together.';
