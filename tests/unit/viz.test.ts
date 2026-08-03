import { describe, expect, it } from "vitest";
import { buildCells, minorTicks, ticks } from "@/components/learn/viz/geometry";
import { sameSet, toIndexSet } from "@/components/learn/viz/types";

/**
 * The geometry, not the rendering.
 *
 * A diagram in a maths lesson is believed in a way prose is not — a learner who
 * reads a wrong sentence may doubt it, and a learner who sees a circle cut into
 * five parts labelled "quarters" will not. These functions decide what is drawn,
 * they are pure, and they are the cheapest place to catch that.
 */

describe("toIndexSet", () => {
  it("turns a count into the first n indices", () => {
    expect([...toIndexSet(3, 8)]).toEqual([0, 1, 2]);
  });

  it("passes explicit indices through", () => {
    expect([...toIndexSet([1, 4], 8)].sort()).toEqual([1, 4]);
  });

  it("clamps a count to the number of parts", () => {
    // "shade 9 of 4" is an authoring mistake; it must not produce 9 shapes.
    expect(toIndexSet(9, 4).size).toBe(4);
  });

  it("drops out-of-range indices", () => {
    expect([...toIndexSet([0, 7, -1], 4)].sort()).toEqual([0]);
  });

  it("treats undefined as nothing shaded", () => {
    expect(toIndexSet(undefined, 4).size).toBe(0);
  });
});

describe("sameSet", () => {
  it("ignores order", () => {
    expect(sameSet(new Set([2, 0]), new Set([0, 2]))).toBe(true);
  });

  it("is false when sizes differ", () => {
    expect(sameSet(new Set([0]), new Set([0, 1]))).toBe(false);
  });

  it("is false on the same size with different members", () => {
    expect(sameSet(new Set([0, 1]), new Set([0, 2]))).toBe(false);
  });
});

describe("buildCells", () => {
  it("makes one path per part, for every shape", () => {
    for (const shape of ["circle", "bar", "grid"] as const) {
      for (const parts of [1, 2, 3, 4, 5, 8, 12]) {
        expect(buildCells(shape, parts)).toHaveLength(parts);
      }
    }
  });

  it("emits no NaN — the failure that renders an invisible shape", () => {
    for (const shape of ["circle", "bar", "grid"] as const) {
      for (const parts of [1, 2, 3, 7, 12]) {
        for (const d of buildCells(shape, parts)) expect(d).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it("is deterministic — same input, byte-identical output", () => {
    expect(buildCells("circle", 5)).toEqual(buildCells("circle", 5));
  });

  it("draws a whole circle as one closed path, not a zero-width slice", () => {
    const [only] = buildCells("circle", 1);
    expect(only).toMatch(/^M .* A .* Z$/);
  });

  it("uses the large-arc flag once past a half turn", () => {
    // 2 parts: each is exactly a semicircle, so neither is "large".
    expect(buildCells("circle", 2).every((d) => / 0 1 /.test(d))).toBe(true);
    // 1 part is the whole circle and must set it.
    expect(buildCells("circle", 1)).toEqual([expect.stringContaining("1 1")]);
  });

  it("splits a bar into equal widths that fill the whole bar", () => {
    const xs = buildCells("bar", 4).map((d) => Number(d.split(" ")[1]));
    const gaps = xs.slice(1).map((x, i) => Math.round((x - xs[i]) * 100) / 100);
    expect(new Set(gaps).size).toBe(1);
  });
});

describe("ticks", () => {
  it("includes both ends", () => {
    expect(ticks(0, 4, 1)).toEqual([0, 1, 2, 3, 4]);
  });

  it("handles negative ranges — Class 7 integers", () => {
    expect(ticks(-3, 3, 1)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
  });

  it("does NOT drift on fractional steps", () => {
    // Counting steps rather than accumulating: repeated += 0.1 gives
    // 0.30000000000000004 and a tick labelled 0.9999999999999999.
    expect(ticks(0, 1, 0.1)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
  });

  it("survives a zero step instead of hanging", () => {
    expect(ticks(0, 4, 0)).toEqual([0, 4]);
  });
});

describe("minorTicks", () => {
  it("puts divisions-1 ticks between each pair", () => {
    expect(minorTicks([0, 1], 4)).toEqual([0.25, 0.5, 0.75]);
  });

  it("returns nothing for a single major tick", () => {
    expect(minorTicks([0], 4)).toEqual([]);
  });

  it("keeps thirds readable rather than 0.30000000000000004", () => {
    expect(minorTicks([0, 1], 3)).toEqual([0.333, 0.667]);
  });
});

describe("axis labels", () => {
  it("uses a real minus sign, not a hyphen", async () => {
    // String(-6) gives U+002D, a word-joining hyphen: shorter, lower, and beside
    // the U+2212 KaTeX renders in the prose it reads as a different symbol.
    // Class 7 is entirely negative numbers, so it appears on every screen.
    const { minus } = await import("@/components/learn/viz/geometry");
    expect(minus(-6)).toBe("−6");
    expect(minus(6)).toBe("6");
    expect(minus(-0.5)).toBe("−0.5");
    expect(minus(0)).toBe("0");
  });
});

describe("layoutTokens", () => {
  it("lays out plain counters in a row", async () => {
    const { layoutTokens } = await import("@/components/learn/viz/geometry");
    const { tokens, pairs } = layoutTokens({ positive: 3, negative: 0 });
    expect(tokens).toHaveLength(3);
    expect(tokens.every((t) => t.sign === 1)).toBe(true);
    expect(pairs).toBe(0);
  });

  it("cancels matched chips into pairs — the zero pair", async () => {
    // 5 + (−3): three pairs vanish, two positives survive. That leftover IS the
    // answer, which is the entire reason this shape exists.
    const { layoutTokens } = await import("@/components/learn/viz/geometry");
    const { tokens, pairs } = layoutTokens({ positive: 5, negative: 3, pairing: true });
    expect(pairs).toBe(3);
    expect(tokens.filter((t) => t.paired)).toHaveLength(6);
    const survivors = tokens.filter((t) => !t.paired);
    expect(survivors).toHaveLength(2);
    expect(survivors.every((t) => t.sign === 1)).toBe(true);
  });

  it("leaves the NEGATIVE side surviving when negatives win", async () => {
    const { layoutTokens } = await import("@/components/learn/viz/geometry");
    const { tokens } = layoutTokens({ positive: 2, negative: 6, pairing: true });
    const survivors = tokens.filter((t) => !t.paired);
    expect(survivors).toHaveLength(4);
    expect(survivors.every((t) => t.sign === -1)).toBe(true);
  });

  it("cancels to nothing when they match exactly", async () => {
    const { layoutTokens } = await import("@/components/learn/viz/geometry");
    const { tokens } = layoutTokens({ positive: 4, negative: 4, pairing: true });
    expect(tokens.filter((t) => !t.paired)).toHaveLength(0);
  });

  it("wraps into groups — (−4) × 3 is three rows of four", async () => {
    const { layoutTokens } = await import("@/components/learn/viz/geometry");
    const { tokens } = layoutTokens({ positive: 0, negative: 12, groupsOf: 4 });
    expect(new Set(tokens.map((t) => t.cy)).size).toBe(3);
    expect(new Set(tokens.map((t) => t.cx)).size).toBe(4);
  });

  it("keeps every chip inside the box, stroke included", async () => {
    // Without padding a chip centred at exactly r has half its stroke clipped and
    // renders with a flat top — which is what the gallery showed.
    const { layoutTokens, TOKEN_R } = await import("@/components/learn/viz/geometry");
    const { tokens, width, height } = layoutTokens({ positive: 5, negative: 3, pairing: true });
    for (const t of tokens) {
      expect(t.cx - TOKEN_R).toBeGreaterThan(0);
      expect(t.cy - TOKEN_R).toBeGreaterThan(0);
      expect(t.cx + TOKEN_R).toBeLessThan(width);
      expect(t.cy + TOKEN_R).toBeLessThan(height);
    }
  });
});

describe("layoutPan", () => {
  it("draws the constant as ONE labelled weight, not a pile", async () => {
    // 3x + 5 = 35 needs thirty-five unit blocks. The first version drew six and
    // overflowed the pan — a picture that was quietly false.
    const { layoutPan } = await import("@/components/learn/viz/geometry");
    const items = layoutPan(0, 35, 100);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "n", value: 35 });
  });

  it("fits inside the pan for the widest case in the curriculum", async () => {
    const { layoutPan } = await import("@/components/learn/viz/geometry");
    const items = layoutPan(4, 100, 160);
    const left = Math.min(...items.map((i) => i.x));
    const right = Math.max(...items.map((i) => i.x + i.w));
    const { PAN_HALF } = await import("@/components/learn/viz/geometry");
    expect(right - left).toBeLessThanOrEqual(PAN_HALF * 2);
  });

  it("centres its contents on the pan", async () => {
    const { layoutPan } = await import("@/components/learn/viz/geometry");
    const items = layoutPan(2, 12, 160);
    const left = Math.min(...items.map((i) => i.x));
    const right = Math.max(...items.map((i) => i.x + i.w));
    expect(Math.round((left + right) / 2)).toBe(160);
  });

  it("omits the weight when there is no constant — 2x = 12 has none on the left", async () => {
    const { layoutPan } = await import("@/components/learn/viz/geometry");
    expect(layoutPan(2, undefined, 100).every((i) => i.kind === "x")).toBe(true);
  });

  it("treats an authored zero the same as no constant at all", async () => {
    // `left: { xs: 3, n: 0 }` is a natural way to write "3x and nothing else",
    // and it drew a block labelled "0" sitting on the pan — a fourth object
    // with a value, in a picture whose entire job is that objects have weight.
    // Caught on a screenshot of `3x = 12`, not by reading the code.
    const { layoutPan } = await import("@/components/learn/viz/geometry");
    expect(layoutPan(3, 0, 100).every((i) => i.kind === "x")).toBe(true);
    // And what remains is still centred, rather than shoved left by a gap that
    // was reserved for a weight nobody drew.
    const items = layoutPan(3, 0, 100);
    const left = Math.min(...items.map((i) => i.x));
    const right = Math.max(...items.map((i) => i.x + i.w));
    expect(Math.round((left + right) / 2)).toBe(100);
  });
});
