import { describe, expect, it } from "vitest";
import { summariseSpend, DAILY_CEILING_INR, type AiCallRow } from "@/lib/analytics/spend";

/**
 * AI spend, the number that sets the price floor.
 *
 * D17 prices institutions at ₹450 because an active learner costs ~₹370, and
 * that ₹370 comes from this column. If the aggregate is wrong, the pitch deck
 * is wrong and so is every conversation with a funder. Worth testing properly
 * rather than trusting a sum.
 */

const NOW = new Date("2026-08-09T12:00:00Z"); // 17:30 IST, 9 Aug

const call = (over: Partial<AiCallRow> = {}): AiCallRow => ({
  kind: "tutor",
  student_id: "s1",
  input_tokens: 266,
  output_tokens: 113,
  cache_read_tokens: 1265,
  cache_write_tokens: 0,
  cost_inr: 0.44,
  ok: true,
  created_at: "2026-08-09T06:00:00Z",
  ...over,
});

describe("summariseSpend", () => {
  it("is all zeroes for no calls, without dividing by zero", () => {
    const s = summariseSpend([], NOW);
    expect(s.totalInr).toBe(0);
    expect(s.perLearnerInr).toBe(0);
    expect(s.perTutorExchangeInr).toBeNull();
    expect(s.cacheWriteShare).toBeNull();
  });

  it("totals spend and counts distinct learners, not calls", () => {
    const s = summariseSpend(
      [call({ student_id: "a" }), call({ student_id: "a" }), call({ student_id: "b" })],
      NOW,
    );
    expect(s.calls).toBe(3);
    expect(s.learners).toBe(2);
    expect(s.totalInr).toBeCloseTo(1.32, 4);
    expect(s.perLearnerInr).toBeCloseTo(0.66, 4);
  });

  it("reads cost_inr when Postgres hands numeric back as a string", () => {
    // `numeric(10,4)` arrives as a string through PostgREST. Summing it with +
    // would concatenate, and the dashboard would show "0.440.44".
    const s = summariseSpend([call({ cost_inr: "0.4400" }), call({ cost_inr: "0.1600" })], NOW);
    expect(s.totalInr).toBeCloseTo(0.6, 4);
  });

  it("splits by kind, most expensive first", () => {
    const s = summariseSpend(
      [
        call({ kind: "hint", cost_inr: 0.16 }),
        call({ kind: "tutor", cost_inr: 0.44 }),
        call({ kind: "tutor", cost_inr: 0.44 }),
        call({ kind: "summary", cost_inr: 0.13 }),
      ],
      NOW,
    );
    expect(s.byKind.map((k) => k.kind)).toEqual(["tutor", "hint", "summary"]);
    expect(s.byKind[0]).toMatchObject({ calls: 2, perCall: 0.44 });
  });

  describe("the daily ceiling", () => {
    it("counts only today, in IST", () => {
      const s = summariseSpend(
        [
          // 18:40Z on the 8th is 00:10 IST on the 9th. Today.
          call({ created_at: "2026-08-08T18:40:00Z", cost_inr: 1 }),
          // 18:20Z on the 8th is 23:50 IST on the 8th. Yesterday.
          call({ created_at: "2026-08-08T18:20:00Z", cost_inr: 1 }),
          call({ created_at: "2026-08-09T06:00:00Z", cost_inr: 1 }),
        ],
        NOW,
      );
      expect(s.totalInr).toBe(3);
      expect(s.todayInr).toBe(2);
    });

    it("reports the D11 ceiling so the page never hardcodes a second copy", () => {
      expect(summariseSpend([], NOW).ceilingInr).toBe(DAILY_CEILING_INR);
    });
  });

  describe("cost per tutor exchange", () => {
    it("ignores failed calls, which cost nothing and would drag the average down", () => {
      const s = summariseSpend(
        [call({ cost_inr: 0.44 }), call({ cost_inr: 0.44 }), call({ ok: false, cost_inr: 0 })],
        NOW,
      );
      expect(s.perTutorExchangeInr).toBeCloseTo(0.44, 4);
    });

    it("ignores hints and summaries, which are cheaper and not the floor input", () => {
      const s = summariseSpend(
        [call({ cost_inr: 0.44 }), call({ kind: "hint", cost_inr: 0.16 })],
        NOW,
      );
      expect(s.perTutorExchangeInr).toBeCloseTo(0.44, 4);
    });

    it("matches the 9 Aug measurement", () => {
      // 40 real exchanges, ₹17.463 recorded. The figure D17's ₹370 floor and
      // the pitch deck both rest on.
      const rows = Array.from({ length: 40 }, () => call({ cost_inr: 17.463 / 40 }));
      expect(summariseSpend(rows, NOW).perTutorExchangeInr).toBeCloseTo(0.4366, 3);
    });
  });

  describe("cache write share", () => {
    it("is high when every exchange is a first turn", () => {
      // Nothing read back, everything written: the pilot's actual shape, and
      // why measured cost per exchange sits above the steady state.
      const s = summariseSpend(
        [call({ cache_write_tokens: 1265, input_tokens: 266, cache_read_tokens: 0 })],
        NOW,
      );
      expect(s.cacheWriteShare).toBeCloseTo(1265 / (1265 + 266), 3);
    });

    it("falls as conversations lengthen and the grounding is read instead", () => {
      const s = summariseSpend(
        [
          call({ cache_write_tokens: 1265, input_tokens: 266 }),
          ...Array.from({ length: 9 }, () =>
            call({ cache_write_tokens: 0, input_tokens: 266, cache_read_tokens: 1265 }),
          ),
        ],
        NOW,
      );
      expect(s.cacheWriteShare!).toBeLessThan(0.35);
    });

    it("is null on pre-0030 rows, which recorded no write at all", () => {
      // Those rows were BILLED for cache writes and never stored the count. A
      // zero here would read as "no writes happened", which is a different and
      // wrong claim.
      const s = summariseSpend([call({ cache_write_tokens: 0, input_tokens: 0 })], NOW);
      expect(s.cacheWriteShare).toBeNull();
    });
  });
});
