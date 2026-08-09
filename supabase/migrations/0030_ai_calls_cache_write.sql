-- Record the cache-WRITE tokens we have been paying for all along.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- THE COLUMN THAT MADE cost_inr UNAUDITABLE.
--
-- `costInr()` charges four things: input, output, cache reads, and cache
-- writes. `ai_calls` stored the first three. So the money column could never be
-- rebuilt from the token columns beside it, and the difference was not small:
-- rebuilding the 40 real tutor calls from stored tokens gave ₹6.73 against a
-- recorded ₹17.46. Sixty-one percent of tutor spend was invisible.
--
-- Nothing was overcharged. The cost was right, the evidence for it was missing,
-- and "trust the number, you cannot check it" is not a position to hold about
-- the figure that decides when the tutor switches itself off (D11's ₹150/day
-- ceiling sums this column).
--
-- Cache writes cost 1.25x the input rate, so they are the single most expensive
-- token type in the product. They dominate first-turn exchanges, which is most
-- of them while learners ask one question and leave. Once they are visible, the
-- drop in cost per exchange as conversations lengthen becomes measurable rather
-- than asserted.
--
-- Backfill is impossible: the write counts were never persisted and Anthropic
-- does not retro-report them. Existing rows keep 0, which is the honest value
-- for "we did not record this", and every row from here is complete.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.ai_calls
  add column if not exists cache_write_tokens int not null default 0;

comment on column public.ai_calls.cache_write_tokens is
  'Cache-creation tokens, billed at 1.25x the input rate. Zero on rows written '
  'before migration 0030, where the cost was charged but the count was not '
  'recorded. Do not read a 0 on an old row as "no cache write happened".';
