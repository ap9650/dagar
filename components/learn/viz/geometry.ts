/**
 * Pure geometry for the visual primitives — no React, no tokens, no strings.
 *
 * Kept out of the components on purpose. A diagram in a maths lesson is believed
 * in a way prose is not: a learner who reads a wrong sentence may doubt it, but
 * one who sees a circle cut into five parts labelled "quarters" will not. So the
 * part that decides *what is drawn* is separated from the part that decides how
 * it looks, and it is testable and renderable without a browser.
 */

import type { PartWholeSpec } from "./types";

/** Square viewBox for circle and grid; bar overrides the height. */
export const VIEWBOX = 240;

/** Number-line canvas width. Height depends on whether there are jumps. */
export const W = 320;
export const PAD = 22;

/**
 * The canvas a number line needs.
 *
 * A jump arcs ABOVE the axis, so a line that has one needs a tall upper band and
 * the axis sits low. A line WITHOUT jumps needs room for a mark label and
 * nothing more — and giving it the tall canvas anyway left a third of a 360px
 * screen empty above the line, which is the most expensive whitespace in the
 * product.
 */
export function numberLineBox(hasJumps: boolean): { H: number; AXIS_Y: number } {
  return hasJumps ? { H: 132, AXIS_Y: 92 } : { H: 80, AXIS_Y: 46 };
}

export function buildCells(shape: PartWholeSpec["shape"], parts: number): string[] {
  if (shape === "bar") return barCells(parts);
  if (shape === "grid") return gridCells(parts);
  return circleCells(parts);
}

function circleCells(parts: number): string[] {
  const cx = VIEWBOX / 2;
  const cy = VIEWBOX / 2;
  const r = VIEWBOX / 2 - 12;

  if (parts === 1) {
    // One part is the whole circle. Drawn as two half-arcs rather than a
    // zero-width slice, which renders as nothing at all.
    return [`M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${round(cx - 0.01)} ${cy - r} Z`];
  }

  return Array.from({ length: parts }, (_, i) => {
    // Start at 12 o'clock and go clockwise — the way a roti gets cut.
    const a0 = (i / parts) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((i + 1) / parts) * 2 * Math.PI - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${round(x0)} ${round(y0)} A ${r} ${r} 0 ${large} 1 ${round(x1)} ${round(y1)} Z`;
  });
}

function barCells(parts: number): string[] {
  const pad = 12;
  const width = VIEWBOX - pad * 2;
  const height = 64;
  const y = 12;
  const w = width / parts;
  return Array.from({ length: parts }, (_, i) => {
    const x = pad + i * w;
    return `M ${round(x)} ${y} H ${round(x + w)} V ${y + height} H ${round(x)} Z`;
  });
}

function gridCells(parts: number): string[] {
  const cols = parts <= 4 ? parts : Math.ceil(Math.sqrt(parts));
  const rows = Math.ceil(parts / cols);
  const pad = 12;
  const w = (VIEWBOX - pad * 2) / cols;
  const h = (VIEWBOX - pad * 2) / rows;
  return Array.from({ length: parts }, (_, i) => {
    const x = pad + (i % cols) * w;
    const y = pad + Math.floor(i / cols) * h;
    return `M ${round(x)} ${round(y)} H ${round(x + w)} V ${round(y + h)} H ${round(x)} Z`;
  });
}

/**
 * Tick positions.
 *
 * Built by counting steps rather than `while (value <= to) value += step`,
 * because repeated float addition drifts: 0.1 added ten times is not 1, and a
 * tick that lands at 0.9999999999999999 renders a label saying exactly that.
 */
export function ticks(from: number, to: number, step: number): number[] {
  if (step <= 0) return [from, to];
  const count = Math.round((to - from) / step);
  return Array.from({ length: count + 1 }, (_, i) => round3(from + i * step));
}

export function minorTicks(majors: number[], divisions: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < majors.length - 1; i++) {
    const width = (majors[i + 1] - majors[i]) / divisions;
    for (let d = 1; d < divisions; d++) out.push(round3(majors[i] + width * d));
  }
  return out;
}

/**
 * A real minus sign, not a hyphen.
 *
 * `String(-6)` gives "-6" with U+002D, which is a word-joining hyphen: shorter,
 * sitting lower, and beside the U+2212 that KaTeX renders in the prose it reads
 * as a different symbol. Class 7 is entirely negative numbers, so this is on
 * every screen of it.
 */
export function minus(value: number): string {
  return String(value).replace("-", "\u2212");
}

/** Two decimals: smooth enough for curves, stable enough for a snapshot. */
export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/* ── tokens ────────────────────────────────────────────────────────────────
   Chip layout for integers. Pure, so "does this draw the right number of
   chips, in the right pairs" is a unit test rather than a squint. */

export const TOKEN_R = 17;
export const TOKEN_GAP = 8;
/**
 * Breathing room inside the viewBox.
 *
 * Without it a chip centred at exactly `r` has its top edge ON the boundary, so
 * half the 2.5px stroke is clipped and every circle renders with a flat top —
 * and the strike through a cancelled pair, which deliberately overhangs the
 * chips, loses both its ends.
 */
export const TOKEN_PAD = 6;
export const TOKEN_ROW_H = TOKEN_R * 2 + TOKEN_GAP + 6;

export type Token = { sign: 1 | -1; cx: number; cy: number; paired: boolean };

/**
 * Where each chip goes.
 *
 * With `pairing`, matched `+1`/`−1` chips are laid out as adjacent COLUMNS —
 * one above the other — so a struck-through pair reads as a single cancelled
 * thing. Leftovers follow in a row of their own. That layout is the whole
 * lesson: what is left after the pairs vanish is the answer.
 */
export function layoutTokens(spec: {
  positive: number;
  negative: number;
  pairing?: boolean;
  groupsOf?: number;
}): { tokens: Token[]; width: number; height: number; pairs: number } {
  const positive = Math.max(0, Math.min(spec.positive, 12));
  const negative = Math.max(0, Math.min(spec.negative, 12));
  const pairs = spec.pairing ? Math.min(positive, negative) : 0;
  const step = TOKEN_R * 2 + TOKEN_GAP;
  const tokens: Token[] = [];

  const origin = TOKEN_R + TOKEN_PAD;

  // Paired columns first: a + above a −, struck through together.
  for (let i = 0; i < pairs; i++) {
    const cx = origin + i * step;
    tokens.push({ sign: 1, cx, cy: origin, paired: true });
    tokens.push({ sign: -1, cx, cy: origin + step, paired: true });
  }

  // Then whatever did not cancel, wrapped by `groupsOf` when given.
  const leftoverSign: 1 | -1 = positive - pairs > 0 ? 1 : -1;
  const leftover = Math.abs(positive - pairs) + Math.abs(negative - pairs);
  const perRow = spec.groupsOf && spec.groupsOf > 0 ? spec.groupsOf : Math.max(1, leftover);
  const rowOffset = pairs > 0 ? step * 2 + TOKEN_GAP : 0;

  for (let i = 0; i < leftover; i++) {
    tokens.push({
      sign: leftoverSign,
      cx: origin + (i % perRow) * step,
      cy: origin + rowOffset + Math.floor(i / perRow) * step,
      paired: false,
    });
  }

  const width = Math.max(...tokens.map((t) => t.cx), origin) + TOKEN_R + TOKEN_PAD;
  const height = Math.max(...tokens.map((t) => t.cy), origin) + TOKEN_R + TOKEN_PAD;
  return { tokens, width, height, pairs };
}

/* ── balance pans ──────────────────────────────────────────────────────────
   What sits on a pan, laid out up front rather than by advancing a cursor
   mid-render — a component that mutates while rendering is a lint error here
   and a real hazard the moment anything re-renders partway. */

/**
 * Sized so the WIDEST thing the curriculum can ask for still fits on a pan:
 * four x-boxes beside a three-digit constant. The first sizing overflowed at
 * exactly that case, which a test caught rather than a screenshot.
 */
export const PAN_ITEM = { boxW: 18, boxH: 26, weightH: 26, gap: 4 };
/** Half the pan's width. Contents must fit inside `PAN_HALF * 2`. */
export const PAN_HALF = 70;

export type PanItem =
  | { kind: "x"; x: number; w: number }
  | { kind: "n"; x: number; w: number; value: number };

/**
 * `x` boxes are drawn narrower than a numeric weight and carry the letter; the
 * constant is ONE block showing its value.
 *
 * Drawing the constant as a pile of unit blocks was the first attempt and it
 * cannot work: `3x + 5 = 35` needs thirty-five of them, which overflowed the pan
 * and, once capped, drew six — a picture that was quietly false.
 */
export function layoutPan(xs: number, n: number | undefined, centre: number): PanItem[] {
  const boxes = Math.max(0, Math.min(xs, 4));
  const { boxW, gap } = PAN_ITEM;
  // A zero weight is not a weight. `n: 0` used to draw a real block labelled
  // "0" sitting on the pan beside the x-boxes — seen for the first time on a
  // screenshot of `3x = 12`, where it read as a fourth object with a value.
  // Zero is the absence of a thing, and the picture has to say that.
  const hasWeight = n !== undefined && n !== 0;
  // Wide enough for three digits without the text touching the edges.
  const weightW = hasWeight ? Math.max(28, String(n).length * 12 + 12) : 0;

  const total = boxes * (boxW + gap) + (weightW ? weightW + gap : 0) - (boxes || weightW ? gap : 0);
  let cursor = centre - total / 2;

  const items: PanItem[] = [];
  for (let i = 0; i < boxes; i++) {
    items.push({ kind: "x", x: cursor, w: boxW });
    cursor += boxW + gap;
  }
  if (hasWeight) items.push({ kind: "n", x: cursor, w: weightW, value: n! });
  return items;
}

// ── charts (Class 6 Ch 4 — Data Handling and Presentation) ───────────────────

export const CHART_W = 320;
export const CHART_H = 190;
/** Room under the axis for a category word, which in Hindi runs taller. */
export const CHART_LABEL_H = 34;
export const CHART_LEFT = 30;
/**
 * Headroom above the tallest bar.
 *
 * Without it a full-height bar starts at y=0, and both the top axis number and
 * the bar's own value label are drawn off the top of the viewBox — clipped, so
 * the chart silently loses the largest number on it. Caught on a screenshot,
 * not in a test, which is why the test below now asserts the ceiling.
 */
export const CHART_TOP = 16;

/** Where a value sits vertically. Shared by the bars and the gridlines, so the
 *  two cannot drift apart — a bar that misses its own gridline is a wrong
 *  answer with a correct-looking picture. */
export function chartY(value: number, max: number, plotH: number): number {
  if (max <= 0) return plotH;
  return plotH - (Math.max(0, value) / max) * (plotH - CHART_TOP);
}

export type Bar = { x: number; y: number; w: number; h: number; value: number; label: string };

/**
 * A nice axis top: the smallest of 5, 10, 20, 25, 50, 100… that clears the data.
 *
 * Scaling to the tallest bar exactly is what a chart library does and it is
 * wrong here. The learner has to READ values off this axis, so the gridlines
 * have to land on numbers a 11-year-old counts in. An axis topping out at 7
 * with lines at 1.75 teaches nothing except that charts are hard.
 */
export function chartMax(values: number[], override?: number): number {
  const peak = Math.max(1, ...values);
  if (override && override >= peak) return override;
  for (const step of [5, 10, 20, 25, 50, 100, 200, 500, 1000]) {
    if (peak <= step) return step;
  }
  return Math.ceil(peak / 1000) * 1000;
}

/** Gridline values, always including 0 and the top. Never more than 6 lines. */
export function chartTicks(max: number): number[] {
  const divisions = max % 4 === 0 ? 4 : 5;
  const gap = max / divisions;
  return Array.from({ length: divisions + 1 }, (_, i) => round(i * gap));
}

export function layoutBars(
  categories: { label: string; value: number }[],
  max: number,
): { bars: Bar[]; plotH: number } {
  const plotH = CHART_H - CHART_LABEL_H;
  const n = Math.max(1, categories.length);
  const usable = CHART_W - CHART_LEFT - 10;
  // Gap is a third of the slot: wide enough that bars read as separate objects,
  // narrow enough that six of them still have width at 360px.
  const slot = usable / n;
  const w = slot * 0.66;

  return {
    plotH,
    bars: categories.map((c, i) => {
      const y = chartY(c.value, max, plotH);
      const h = plotH - y;
      return {
        x: CHART_LEFT + i * slot + (slot - w) / 2,
        y,
        w,
        h,
        value: c.value,
        label: c.label,
      };
    }),
  };
}

/**
 * Whole icons plus the fraction of one left over.
 *
 * The half-icon is the entire reason a pictograph is worth teaching: it is
 * where the key stops being decoration and starts being arithmetic. 12 with a
 * key of 5 is two icons and a bit — and a learner who cannot say what "a bit"
 * is worth has not understood the key.
 */
export function layoutIcons(value: number, each: number): { full: number; part: number } {
  const per = Math.max(1, each);
  const full = Math.floor(Math.max(0, value) / per);
  return { full, part: round((Math.max(0, value) - full * per) / per) };
}

/**
 * Tally marks: groups of five, the fifth struck diagonally across the four.
 *
 * Returned as group sizes rather than a flat count so the renderer never has to
 * work out where a bundle ends — an off-by-one there draws six-bar bundles,
 * which is the one thing a tally must never do.
 */
export function tallyGroups(value: number): number[] {
  const total = Math.max(0, Math.floor(value));
  const groups = Array.from({ length: Math.floor(total / 5) }, () => 5);
  if (total % 5) groups.push(total % 5);
  return groups;
}
