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
