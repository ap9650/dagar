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
  buildCells, layoutPan, layoutTokens, minorTicks, numberLineBox, PAD, PAN_ITEM, round,
  ticks, TOKEN_R, VIEWBOX, W,
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
  const { H, AXIS_Y } = numberLineBox(jumps.length > 0);
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

function tokens(positive: number, negative: number, opts: { pairing?: boolean; groupsOf?: number }, label: string) {
  const { tokens: ts, width, height } = layoutTokens({ positive, negative, ...opts });
  const chips = ts.map((tk) => `
    <g opacity="${tk.paired ? 0.45 : 1}">
      <circle cx="${tk.cx}" cy="${tk.cy}" r="${TOKEN_R}" fill="${tk.sign === 1 ? P : "#fff"}" stroke="${tk.sign === 1 ? P : "#1a2733"}" stroke-width="2.5"/>
      <text x="${tk.cx}" y="${tk.cy}" text-anchor="middle" dominant-baseline="central" font-size="20" font-weight="600" font-family="system-ui" fill="${tk.sign === 1 ? "#fff" : "#1a2733"}">${tk.sign === 1 ? "+" : "−"}</text>
    </g>`).join("");
  const strikes = ts.filter((tk) => tk.paired).filter((_, i) => i % 2 === 0).map((c) =>
    `<line x1="${c.cx - TOKEN_R - 3}" y1="${c.cy - TOKEN_R - 3}" x2="${c.cx + TOKEN_R + 3}" y2="${c.cy + TOKEN_R * 2 + 11}" stroke="#5b6673" stroke-width="3" stroke-linecap="round"/>`).join("");
  return `<div><svg viewBox="0 0 ${width} ${height}" width="${Math.min(240, width * 2)}">${chips}${strikes}</svg>
    <div style="font:600 13px system-ui;color:#1a2733;text-align:center">${label}</div></div>`;
}

function balance(left: [number, number | undefined], right: [number, number | undefined], tilt: 0 | 10 | -10, label: string) {
  const BW = 320, BH = 180, BEAM = 52, PANY = 118, HALF = 70, ARM = 88;
  const { boxH, weightH } = PAN_ITEM;
  const pan = (cx: number, xs: number, n: number | undefined, dy: number) => {
    const items = layoutPan(xs, n, cx);
    return `<line x1="${cx}" y1="${BEAM + dy}" x2="${cx}" y2="${PANY + dy}" stroke="#b6c0ca" stroke-width="2"/>
      <path d="M ${cx - HALF} ${PANY + dy} H ${cx + HALF}" stroke="#3f4a57" stroke-width="4" stroke-linecap="round"/>
      ${items.map((it) => it.kind === "x"
        ? `<rect x="${it.x}" y="${PANY + dy - boxH - 2}" width="${it.w}" height="${boxH}" rx="3" fill="${P}"/><text x="${it.x + it.w / 2}" y="${PANY + dy - boxH / 2 - 2}" text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="600" font-style="italic" font-family="system-ui" fill="#fff">x</text>`
        : `<rect x="${it.x}" y="${PANY + dy - weightH - 2}" width="${it.w}" height="${weightH}" rx="3" fill="${SURF}" stroke="#b6c0ca" stroke-width="2"/><text x="${it.x + it.w / 2}" y="${PANY + dy - weightH / 2 - 2}" text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="600" font-family="system-ui" fill="#1a2733">${it.value}</text>`).join("")}`;
  };
  return `<div><svg viewBox="0 0 ${BW} ${BH}" width="300">
    <line x1="${BW / 2 - ARM}" y1="${BEAM + tilt}" x2="${BW / 2 + ARM}" y2="${BEAM - tilt}" stroke="#3f4a57" stroke-width="5" stroke-linecap="round"/>
    <path d="M ${BW / 2} ${BEAM} V ${BH - 22} M ${BW / 2 - 26} ${BH - 22} H ${BW / 2 + 26}" stroke="#3f4a57" stroke-width="5" stroke-linecap="round" fill="none"/>
    <circle cx="${BW / 2}" cy="${BEAM}" r="6" fill="#3f4a57"/>
    ${pan(BW / 2 - ARM, left[0], left[1], tilt)}${pan(BW / 2 + ARM, right[0], right[1], -tilt)}
  </svg><div style="font:600 13px system-ui;color:#1a2733;text-align:center">${label}</div></div>`;
}

const row = (children: string) =>
  `<div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;margin-bottom:20px">${children}</div>`;

const html = `<body style="margin:0;padding:20px;background:#fff;font-family:system-ui">
${row(
  tokens(3, 0, {}, "+3") +
  tokens(0, 4, {}, "−4") +
  tokens(5, 3, { pairing: true }, "5 + (−3) = 2") +
  tokens(0, 12, { groupsOf: 4 }, "(−4) × 3"),
)}
${row(
  balance([3, 5], [0, 35], 0, "3x + 5 = 35") +
  balance([2, undefined], [0, 12], 0, "2x = 12") +
  balance([2, 5], [0, 12], -10, "take 5 from one side only"),
)}
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
