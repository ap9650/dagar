/**
 * A gallery of every visual primitive, rendered to a static page.
 *
 * Not shipped — `public/_viz-preview.html` is gitignored. It exists because a
 * wrong diagram in a maths lesson is believed in a way wrong prose is not, and
 * unit tests prove the numbers while proving nothing about whether the picture
 * reads. This is the cheapest way to actually look at all of them at once.
 *
 *   npm run viz:preview     then open http://localhost:3000/_viz-preview.html
 */
import { writeFileSync } from "node:fs";
import {
  AXIS_Y, buildCells, H, minorTicks, PAD, round, ticks, VIEWBOX, W,
} from "../components/learn/viz/geometry.ts";

const P = "#0f766e", SURF = "#f1f5f4", BORD = "#b6c0ca", BODY = "#3f4a57", HINT = "#0369a1";

function partWhole(shape: "circle" | "bar" | "grid", parts: number, shaded: number[], label: string) {
  const h = shape === "bar" ? 88 : VIEWBOX;
  const cells = buildCells(shape, parts)
    .map((d, i) => `<path d="${d}" fill="${shaded.includes(i) ? P : SURF}" stroke="${BORD}" stroke-width="2" stroke-linejoin="round"/>`)
    .join("");
  return `<div><svg viewBox="0 0 ${VIEWBOX} ${h}" width="180" height="${(180 * h) / VIEWBOX}">${cells}</svg>
    <div style="font:600 13px system-ui;color:#1a2733;text-align:center">${label}</div></div>`;
}

function numberLine(
  from: number, to: number, step: number, divisions: number,
  marks: { at: number; label?: string }[], jumps: { from: number; to: number; label?: string }[],
) {
  const x = (v: number) => PAD + ((v - from) / (to - from)) * (W - PAD * 2);
  const majors = ticks(from, to, step);
  const minors = divisions > 1 ? minorTicks(majors, divisions) : [];
  return `<div><svg viewBox="0 0 ${W} ${H}" width="300" height="${(300 * H) / W}">
    <defs><marker id="a${from}${to}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${P}"/></marker></defs>
    <line x1="${PAD - 10}" y1="${AXIS_Y}" x2="${W - PAD + 10}" y2="${AXIS_Y}" stroke="${BORD}" stroke-width="2"/>
    ${minors.map((v) => `<line x1="${round(x(v))}" y1="${AXIS_Y - 5}" x2="${round(x(v))}" y2="${AXIS_Y + 5}" stroke="${BODY}" stroke-width="2"/>`).join("")}
    ${majors.map((v) => `<line x1="${round(x(v))}" y1="${AXIS_Y - 9}" x2="${round(x(v))}" y2="${AXIS_Y + 9}" stroke="${BODY}" stroke-width="2"/><text x="${round(x(v))}" y="${AXIS_Y + 28}" text-anchor="middle" font-size="14" font-family="system-ui" fill="${BODY}">${v}</text>`).join("")}
    ${jumps.map((j) => { const x0 = x(j.from), x1 = x(j.to), pk = Math.min(48, 18 + Math.abs(x1 - x0) * 0.35);
      return `<path d="M ${round(x0)} ${AXIS_Y - 10} Q ${round((x0 + x1) / 2)} ${round(AXIS_Y - 10 - pk)} ${round(x1)} ${AXIS_Y - 10}" fill="none" stroke="${P}" stroke-width="2.5" stroke-linecap="round" marker-end="url(#a${from}${to})"/>${j.label ? `<text x="${round((x0 + x1) / 2)}" y="${round(AXIS_Y - 16 - pk)}" text-anchor="middle" font-size="14" font-weight="600" font-family="system-ui" fill="${P}">${j.label}</text>` : ""}`; }).join("")}
    ${marks.map((m) => `<circle cx="${round(x(m.at))}" cy="${AXIS_Y}" r="7" fill="${HINT}"/>${m.label ? `<text x="${round(x(m.at))}" y="${AXIS_Y - 16}" text-anchor="middle" font-size="15" font-weight="600" font-family="system-ui" fill="${HINT}">${m.label}</text>` : ""}`).join("")}
  </svg></div>`;
}

const row = (children: string) =>
  `<div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;margin-bottom:20px">${children}</div>`;

const html = `<body style="margin:0;padding:20px;background:#fff;font-family:system-ui">
${row(
  partWhole("circle", 4, [0], "circle 1/4") +
  partWhole("circle", 8, [0, 1, 2], "circle 3/8") +
  partWhole("circle", 1, [0], "circle 1/1") +
  partWhole("circle", 3, [0, 1], "circle 2/3"),
)}
${row(partWhole("grid", 12, [0, 1, 2, 3, 4], "grid 5/12") + partWhole("grid", 6, [0, 1, 2], "grid 3/6") + partWhole("grid", 9, [0, 1, 2, 3], "grid 4/9"))}
${row(partWhole("bar", 4, [0, 1, 2], "bar 3/4") + partWhole("bar", 8, [0, 1, 2], "bar 3/8") + partWhole("bar", 2, [0], "bar 1/2"))}
${row(
  numberLine(0, 1, 1, 4, [{ at: 0.75, label: "3/4" }], []) +
  numberLine(-5, 5, 1, 1, [], [{ from: -3, to: 2, label: "+5" }]) +
  numberLine(0, 4, 1, 3, [{ at: 2, label: "2" }], []),
)}
</body>`;

writeFileSync("public/_viz-preview.html", html);
console.log("wrote public/_viz-preview.html → http://localhost:3000/_viz-preview.html");
