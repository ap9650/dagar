// Relative with an extension, not the `@/` alias: node's type-stripping runs
// `scripts/*.ts` without a bundler to resolve tsconfig paths, and this module
// is read from there to check spend against the live database.
import { istDate } from "../learning/dates.ts";

/**
 * What the AI actually cost, aggregated for `/admin/metrics`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONE NUMBER NOBODY COULD SEE.
 *
 * `ai_calls.cost_inr` has been written on every call since 0007, and until now
 * the only thing that read it was the D11 daily ceiling deciding whether to
 * switch the tutor off. There was no screen. Answering "what have we spent"
 * meant somebody with the service-role key running a query by hand, which means
 * in practice nobody asked.
 *
 * That is the wrong shape for the number that sets the institutional price
 * floor (D17, ₹370/learner/year) and therefore the entire monetisation model.
 * A figure a pitch deck quotes should be visible in the product it describes.
 *
 * Pure, and given rows rather than fetching them, so the arithmetic is testable
 * without a database.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** D11: the tutor stops rather than overspends. */
export const DAILY_CEILING_INR = 150;

/** D11's per-learner target, at standard Sonnet 5 pricing. Cap is ₹7. */
export const WEEKLY_TARGET_INR = 6.4;
export const WEEKLY_CAP_INR = 7;

export type AiCallRow = {
  kind: string;
  student_id: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  /** Zero on rows written before migration 0030, where it was billed unrecorded. */
  cache_write_tokens: number;
  cost_inr: number | string;
  ok: boolean;
  created_at: string;
};

export type KindSpend = {
  kind: string;
  calls: number;
  inr: number;
  perCall: number;
};

export type Spend = {
  totalInr: number;
  calls: number;
  learners: number;
  /** Total divided by learners who triggered at least one call. */
  perLearnerInr: number;
  byKind: KindSpend[];
  /** Today in IST, against the D11 ceiling. */
  todayInr: number;
  ceilingInr: number;
  /** Measured cost of one tutor exchange, the input to the ₹370 floor. */
  perTutorExchangeInr: number | null;
  /**
   * Share of tutor spend that went on WRITING the cache rather than reading it.
   *
   * High means most exchanges are first turns, where the grounding is written
   * at 1.25x input and never read back at 0.1x. It is the number that explains
   * why measured cost per exchange sits above the steady state, and it should
   * fall as learners hold longer conversations. Null until 0030 rows exist.
   */
  cacheWriteShare: number | null;
};

const money = (value: number | string) => Number(value) || 0;

export function summariseSpend(
  rows: readonly AiCallRow[],
  now: Date = new Date(),
): Spend {
  const today = istDate(now);

  let totalInr = 0;
  let todayInr = 0;
  const learners = new Set<string>();
  const kinds = new Map<string, { calls: number; inr: number }>();

  let tutorCalls = 0;
  let tutorInr = 0;
  let tutorWriteTokens = 0;
  let tutorInputTokens = 0;

  for (const row of rows) {
    const inr = money(row.cost_inr);
    totalInr += inr;
    if (istDate(new Date(row.created_at)) === today) todayInr += inr;
    if (row.student_id) learners.add(row.student_id);

    const entry = kinds.get(row.kind) ?? { calls: 0, inr: 0 };
    entry.calls += 1;
    entry.inr += inr;
    kinds.set(row.kind, entry);

    if (row.kind === "tutor" && row.ok) {
      tutorCalls += 1;
      tutorInr += inr;
      tutorWriteTokens += row.cache_write_tokens ?? 0;
      tutorInputTokens += row.input_tokens ?? 0;
    }
  }

  const byKind = [...kinds.entries()]
    .map(([kind, e]) => ({
      kind,
      calls: e.calls,
      inr: e.inr,
      perCall: e.calls ? e.inr / e.calls : 0,
    }))
    .sort((a, b) => b.inr - a.inr);

  // Cache writes bill at 1.25x input, reads at 0.1x. Comparing WRITE tokens to
  // input tokens is the cheap proxy for "how much of this was a first turn" —
  // an exact rupee split would need the per-model rate here, which belongs in
  // `lib/ai/pricing.ts` and not in a dashboard aggregate.
  const cacheWriteShare =
    tutorWriteTokens + tutorInputTokens > 0
      ? tutorWriteTokens / (tutorWriteTokens + tutorInputTokens)
      : null;

  return {
    totalInr,
    calls: rows.length,
    learners: learners.size,
    perLearnerInr: learners.size ? totalInr / learners.size : 0,
    byKind,
    todayInr,
    ceilingInr: DAILY_CEILING_INR,
    perTutorExchangeInr: tutorCalls ? tutorInr / tutorCalls : null,
    cacheWriteShare,
  };
}
