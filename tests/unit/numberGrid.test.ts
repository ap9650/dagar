import { describe, expect, it } from "vitest";
import { gridSums, layoutGrid, parityOfSum } from "@/components/learn/viz/geometry";

/**
 * Number Play geometry — Class 7 Ch 6 (Ganita Prakash).
 *
 * Two things carry real pedagogical weight here and both are arithmetic, so
 * both are tested away from React: what a magic square's totals say when a cell
 * is still blank, and the parity rule the chapter is actually built on.
 */

describe("gridSums — an unfinished row has no total", () => {
  // 2×2, one cell still empty.
  const partial = [{ value: 4 }, { value: 9 }, { value: 5 }, {}];

  it("adds the rows and columns that are complete", () => {
    const { rowSums, colSums } = gridSums(partial, 2, 2);
    expect(rowSums[0]).toBe(13);
    expect(colSums[0]).toBe(9);
  });

  it("reports a row containing a blank as unknown, NOT as the partial sum", () => {
    // The whole pedagogy of the puzzle. Printing 5 for the bottom row hands the
    // learner a wrong number to reason from, and printing 0 is worse — both look
    // like facts. Unknown draws as "?" and keeps the puzzle a puzzle.
    const { rowSums, colSums } = gridSums(partial, 2, 2);
    expect(rowSums[1]).toBeUndefined();
    expect(colSums[1]).toBeUndefined();
  });

  it("totals a complete magic square, and every line agrees", () => {
    // The classic 3×3. Its claim is that every row and column makes 15, and the
    // claim is only checkable because these numbers are on screen.
    const magic = [8, 1, 6, 3, 5, 7, 4, 9, 2].map((value) => ({ value }));
    const { rowSums, colSums } = gridSums(magic, 3, 3);
    expect(rowSums).toEqual([15, 15, 15]);
    expect(colSums).toEqual([15, 15, 15]);
  });

  it("handles negative numbers, which Class 7 has already met", () => {
    const withNegatives = [{ value: -3 }, { value: 7 }, { value: 5 }, { value: -1 }];
    expect(gridSums(withNegatives, 2, 2).rowSums).toEqual([4, 4]);
  });

  it("treats a missing cell as blank rather than throwing", () => {
    // A seed file that authors 3 cells for a 2×2 is a content mistake. It must
    // degrade to a blank, not crash the lesson.
    expect(() => gridSums([{ value: 1 }, { value: 2 }, { value: 3 }], 2, 2)).not.toThrow();
    expect(gridSums([{ value: 1 }, { value: 2 }, { value: 3 }], 2, 2).rowSums[1]).toBeUndefined();
  });
});

describe("layoutGrid", () => {
  it("reserves room for the totals only when they are shown", () => {
    const without = layoutGrid(3, 3, false);
    const withSums = layoutGrid(3, 3, true);
    expect(withSums.width).toBeGreaterThan(without.width);
    expect(withSums.height).toBeGreaterThan(without.height);
  });

  it("never overlaps two cells", () => {
    const { cell } = layoutGrid(3, 3, true);
    expect(cell(0, 1).x).toBeGreaterThan(cell(0, 0).x);
    expect(cell(1, 0).y).toBeGreaterThan(cell(0, 0).y);
  });
});

describe("parityOfSum — the rule the chapter is built on", () => {
  it("knows the four cases without needing the total", () => {
    // The claim worth learning: you never have to add them up.
    expect(parityOfSum([2, 4])).toBe("even"); // even + even
    expect(parityOfSum([3, 5])).toBe("even"); // odd + odd
    expect(parityOfSum([2, 3])).toBe("odd"); // even + odd
    expect(parityOfSum([3, 2])).toBe("odd"); // odd + even
  });

  it("extends past two numbers, which is where learners guess", () => {
    // Three odds are odd; four odds are even. An even COUNT of odd numbers is
    // what makes a sum even, not "mostly odd".
    expect(parityOfSum([1, 3, 5])).toBe("odd");
    expect(parityOfSum([1, 3, 5, 7])).toBe("even");
    expect(parityOfSum([1, 3, 5, 7, 2, 4, 6])).toBe("even");
  });

  it("is right about negatives — parity has no sign", () => {
    // −3 is odd. Using % on a negative in JavaScript gives −1, which is not 1,
    // and a naive check calls it even.
    expect(parityOfSum([-3])).toBe("odd");
    expect(parityOfSum([-3, -5])).toBe("even");
    expect(parityOfSum([-3, 4])).toBe("odd");
  });

  it("treats zero as even", () => {
    expect(parityOfSum([0])).toBe("even");
    expect(parityOfSum([0, 0])).toBe("even");
    expect(parityOfSum([])).toBe("even");
  });
});

/**
 * Every magic square in the SEED is actually magic.
 *
 * This exists because one authored here was not. A 2×2 written as
 * [6, ?, 4, 5] had rows totalling 10 and 9 — presented to a learner as a magic
 * square, with a "find the missing number" question whose stated method gives a
 * different answer depending on which line you use. Found by adding up the
 * numbers, which nothing in the pipeline had been doing.
 *
 * A wrong diagram in a maths lesson is believed. This is the cheapest possible
 * guard against the whole class of mistake.
 */
describe("seeded magic squares are magic", () => {
  it("every fully-filled numberGrid with showSums has one consistent total", async () => {
    const { chapters } = await import("../../supabase/seed/index.ts");
    const grids: { where: string; spec: NumberGridLike }[] = [];

    for (const chapter of chapters) {
      for (const lesson of chapter.lessons) {
        (lesson.steps ?? []).forEach((step, i) => {
          const viz = (step as { viz?: unknown }).viz as NumberGridLike | undefined;
          if (viz?.kind === "numberGrid") grids.push({ where: `${lesson.slug} step ${i}`, spec: viz });
        });
      }
      for (const question of chapter.questions) {
        const viz = question.stem_viz as NumberGridLike | undefined;
        if (viz?.kind === "numberGrid") grids.push({ where: question.slug, spec: viz });
      }
    }

    // Guard the guard: if this ever finds nothing, the walk above has broken and
    // the test would pass vacuously forever.
    expect(grids.length).toBeGreaterThan(0);

    for (const { where, spec } of grids) {
      if (!spec.showSums) continue;
      const { rowSums, colSums } = gridSums(spec.cells, spec.rows, spec.cols);
      // Only the totals that are knowable — a line with a gap has none.
      const known = [...rowSums, ...colSums].filter((s): s is number => s !== undefined);
      expect(new Set(known).size, `${where}: lines disagree — ${known.join(", ")}`).toBe(1);
    }
  });
});

type NumberGridLike = {
  kind: string;
  rows: number;
  cols: number;
  cells: { value?: number }[];
  showSums?: boolean;
};
