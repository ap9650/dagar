import { describe, expect, it } from "vitest";
import {
  CHART_TOP,
  chartMax,
  chartTicks,
  chartY,
  layoutBars,
  layoutIcons,
  tallyGroups,
} from "@/components/learn/viz/geometry";

/**
 * Chart geometry — Class 6 Ch 4, Data Handling and Presentation.
 *
 * A chart in a maths lesson IS the question, not an illustration of it. If a bar
 * is drawn at the wrong height the learner reads a wrong value off a correct
 * axis and is marked wrong for it, which is the worst failure this product has:
 * silent, and it lands as "I am bad at maths".
 *
 * So the arithmetic that decides what gets drawn lives in `geometry.ts` and is
 * tested here, away from React.
 */

describe("chartMax — the axis reads in numbers a child counts in", () => {
  it("rounds up to a friendly top rather than hugging the data", () => {
    // The whole point. A peak of 7 must NOT produce an axis topping out at 7,
    // because the gridlines then land on 1.75, 3.5, 5.25 — unreadable to an
    // 11-year-old, and unreadable is indistinguishable from wrong.
    expect(chartMax([7, 3, 5])).toBe(10);
    expect(chartMax([2, 1])).toBe(5);
    expect(chartMax([12, 4])).toBe(20);
    expect(chartMax([26])).toBe(50);
  });

  it("honours an author's override when it clears the data", () => {
    expect(chartMax([3, 4], 10)).toBe(10);
  });

  it("ignores an override that would cut a bar off", () => {
    // A seed file asking for max 5 with a value of 9 is a content mistake. It
    // must not silently draw a bar out of the top of the chart.
    expect(chartMax([9], 5)).toBe(10);
  });

  it("never returns zero, even with no data", () => {
    // Division by this value decides every bar height.
    expect(chartMax([0, 0])).toBeGreaterThan(0);
    expect(chartMax([])).toBeGreaterThan(0);
  });
});

describe("chartTicks", () => {
  it("starts at zero and ends at the top", () => {
    const ticks = chartTicks(10);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(10);
  });

  it("produces whole numbers for the friendly maxima", () => {
    for (const max of [5, 10, 20, 25, 50, 100]) {
      for (const tick of chartTicks(max)) {
        expect(Number.isInteger(tick)).toBe(true);
      }
    }
  });

  it("stays readable — never more than six gridlines", () => {
    for (const max of [5, 10, 20, 25, 50, 100, 1000]) {
      expect(chartTicks(max).length).toBeLessThanOrEqual(6);
    }
  });
});

describe("layoutBars", () => {
  it("makes height proportional to value", () => {
    const { bars } = layoutBars(
      [
        { label: "a", value: 10 },
        { label: "b", value: 5 },
      ],
      10,
    );
    // The invariant a learner actually reads: twice the value, twice the bar.
    expect(bars[0].h).toBeCloseTo(bars[1].h * 2);
  });

  it("leaves headroom, so the top axis number is not drawn off the canvas", () => {
    // Found on a screenshot: a full-height bar started at y=0 and both the top
    // gridline label and the bar's own value were clipped away, losing the
    // largest number on the chart.
    const { bars } = layoutBars([{ label: "a", value: 10 }], 10);
    expect(bars[0].y).toBeGreaterThanOrEqual(CHART_TOP);
  });

  it("puts a bar's top exactly on its own gridline", () => {
    // Bars and gridlines are drawn by different code paths. If they disagree,
    // the picture looks fine and every value read off it is wrong.
    const { bars, plotH } = layoutBars([{ label: "a", value: 15 }], 20);
    expect(bars[0].y).toBeCloseTo(chartY(15, 20, plotH));
  });

  it("sits every bar on the axis, not floating", () => {
    const { bars, plotH } = layoutBars(
      [
        { label: "a", value: 3 },
        { label: "b", value: 8 },
      ],
      10,
    );
    for (const bar of bars) expect(bar.y + bar.h).toBeCloseTo(plotH);
  });

  it("draws a zero as no bar at all", () => {
    const { bars } = layoutBars([{ label: "none", value: 0 }], 10);
    expect(bars[0].h).toBe(0);
  });

  it("keeps six categories inside the canvas", () => {
    const { bars } = layoutBars(
      Array.from({ length: 6 }, (_, i) => ({ label: `c${i}`, value: i + 1 })),
      10,
    );
    for (const bar of bars) expect(bar.x + bar.w).toBeLessThanOrEqual(320);
    // And bars must not overlap, or two categories read as one.
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i].x).toBeGreaterThanOrEqual(bars[i - 1].x + bars[i - 1].w);
    }
  });
});

describe("layoutIcons — the pictograph key is arithmetic", () => {
  it("splits into whole icons plus the leftover fraction", () => {
    // The idea the chapter turns on: 12 with a key of 5 is two icons and a bit,
    // and the bit is worth exactly two fifths of one.
    expect(layoutIcons(12, 5)).toEqual({ full: 2, part: 0.4 });
  });

  it("has no leftover on an exact multiple", () => {
    expect(layoutIcons(15, 5)).toEqual({ full: 3, part: 0 });
  });

  it("draws less than one key as a part-icon, never as none", () => {
    // A category of 2 with a key of 5 must still appear. Rounding it away tells
    // the learner nobody chose it, which is a different fact.
    const { full, part } = layoutIcons(2, 5);
    expect(full).toBe(0);
    expect(part).toBeGreaterThan(0);
  });

  it("survives a key of zero rather than dividing by it", () => {
    expect(() => layoutIcons(4, 0)).not.toThrow();
  });
});

describe("tallyGroups — a bundle is always five", () => {
  it("bundles in fives with the remainder last", () => {
    expect(tallyGroups(12)).toEqual([5, 5, 2]);
    expect(tallyGroups(10)).toEqual([5, 5]);
    expect(tallyGroups(3)).toEqual([3]);
    expect(tallyGroups(0)).toEqual([]);
  });

  it("never emits a group larger than five", () => {
    // The one thing a tally must never draw. A six-bar bundle is not a tally.
    for (let n = 0; n <= 60; n++) {
      for (const group of tallyGroups(n)) {
        expect(group).toBeGreaterThan(0);
        expect(group).toBeLessThanOrEqual(5);
      }
    }
  });

  it("always adds back up to the value", () => {
    for (let n = 0; n <= 60; n++) {
      expect(tallyGroups(n).reduce((a, b) => a + b, 0)).toBe(n);
    }
  });
});
