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

/** Two decimals: smooth enough for curves, stable enough for a snapshot. */
export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
