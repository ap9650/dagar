-- 0019_feedback_priority.sql — the one question that survives politeness
--
-- The five questions in 0018 all have a costless friendly answer. These
-- respondents are family, friends and a sister who teaches: they will be kind,
-- and "did it help?" → yes tells us almost nothing, because the honest answer
-- and the polite answer look identical.
--
-- This one cannot be answered agreeably. "If we could only do ONE more thing"
-- forces a trade-off — picking more chapters means NOT picking a better tutor —
-- so the answer carries a priority rather than a courtesy.
--
-- Deliberately not "do you want more lessons?", which was the first idea. Nobody
-- has ever said "no thanks, three chapters is plenty": it would have returned
-- unanimous agreement and zero information, while feeling like validation.
--
-- Nullable: 0018 responses exist already, and a required column would have
-- meant either dropping them or inventing an answer on their behalf.

alter table public.product_feedback
  add column if not exists improve_most text
    check (improve_most in ('chapters', 'practice', 'tutor', 'phone', 'other'));

comment on column public.product_feedback.improve_most is
  'Forced single choice. The only question here a polite respondent cannot answer '
  'agreeably — see 0019.';
