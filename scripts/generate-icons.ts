/**
 * npm run icons — render the app icons from one SVG source.
 *
 * Checked in as a script rather than as binary blobs somebody has to redraw:
 * the mark is defined once, in code, and every size is derived from it. sharp
 * ships with Next, so this needs no extra dependency.
 *
 * THE MARK: three ascending dots joined by a line — the journey path from the
 * dashboard, which is Dagar's one signature UI element. Pure geometry, no text:
 * a letterform would need a font at render time, and it would have to pick a
 * script, which is exactly the choice the language picker exists to avoid making
 * for the learner.
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const TEAL = "#0F766E";
const WHITE = "#FFFFFF";

/**
 * @param inset 0 for a full-bleed maskable icon; ~0.1 for the rounded square.
 * @param markScale fraction of the canvas the mark occupies. Maskable icons need
 *   ~20% padding on every side or a circular Android launcher crops into it.
 */
function svg(size: number, { inset, markScale }: { inset: number; markScale: number }) {
  const pad = size * inset;
  const box = size - pad * 2;
  const radius = inset === 0 ? 0 : box * 0.22;

  // Three nodes on a rising diagonal, drawn in a centred square of side `span`.
  const span = size * markScale;
  const originX = (size - span) / 2;
  const originY = (size - span) / 2;
  const stroke = span * 0.11;
  const r = span * 0.13;

  const nodes = [
    { x: originX + span * 0.15, y: originY + span * 0.85 },
    { x: originX + span * 0.5, y: originY + span * 0.5 },
    { x: originX + span * 0.85, y: originY + span * 0.15 },
  ];

  const line = nodes.map((n, i) => `${i === 0 ? "M" : "L"} ${n.x} ${n.y}`).join(" ");

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="${pad}" y="${pad}" width="${box}" height="${box}" rx="${radius}" fill="${TEAL}"/>
  <path d="${line}" fill="none" stroke="${WHITE}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>
  ${nodes.map((n, i) => `<circle cx="${n.x}" cy="${n.y}" r="${i === 2 ? r * 1.25 : r}" fill="${WHITE}"/>`).join("\n  ")}
</svg>`);
}

const targets = [
  // Rounded square, small inset — the standard home-screen icon.
  { file: "icon-192.png", size: 192, inset: 0.06, markScale: 0.52 },
  { file: "icon-512.png", size: 512, inset: 0.06, markScale: 0.52 },
  // Maskable: full bleed, mark kept inside the 80% safe zone so a circular
  // launcher mask cannot clip it.
  { file: "icon-maskable-512.png", size: 512, inset: 0, markScale: 0.42 },
  // iOS has no maskable concept and applies its own rounding to a square.
  { file: "apple-touch-icon.png", size: 180, inset: 0, markScale: 0.52 },
];

mkdirSync(new URL("../public/icons/", import.meta.url), { recursive: true });

for (const target of targets) {
  const out = new URL(`../public/icons/${target.file}`, import.meta.url);
  await sharp(svg(target.size, target))
    .png({ compressionLevel: 9 })
    .toFile(out.pathname);
  console.log(`  ✓ ${target.file}  ${target.size}×${target.size}`);
}

console.log("\n✓ icons written to public/icons/");
