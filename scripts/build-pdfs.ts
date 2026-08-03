/**
 * npm run deck:pdf — the two submission PDFs.
 *
 * There is no PowerPoint and no LibreOffice on this machine, so neither
 * artefact can be exported the usual way. Both are produced from the sources
 * instead:
 *
 *   Dagar-Pitch-Deck.pdf       each slide rendered by `preview-deck.py`
 *                              (python-pptx → Quick Look), then laid out one
 *                              per page at the deck's own 13.333×7.5in.
 *   Dagar-How-We-Built-It.pdf  docs/HOW_WE_BUILT_IT.md rendered to HTML and
 *                              printed to A4 by headless Chromium.
 *
 * The how-doc is built from the MARKDOWN, not from the .docx. Round-tripping
 * through Word would mean the PDF and the .docx could disagree about a document
 * that is meant to be the same one — and the markdown is the source both are
 * generated from.
 */
import { chromium } from "@playwright/test";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const OUT_DECK = "docs/deck/Dagar-Pitch-Deck.pdf";
const OUT_DOC = "docs/deck/Dagar-How-We-Built-It.pdf";

/** The deck's own aspect, so a slide is a page rather than a picture on one. */
const DECK_W = "13.333in";
const DECK_H = "7.5in";

async function buildDeckPdf() {
  const dir = mkdtempSync(join(tmpdir(), "dagar-deck-"));
  console.log("Rendering slides…");
  execFileSync("python3", ["scripts/preview-deck.py", dir], { stdio: "inherit" });

  const slides = readdirSync(dir)
    .filter((f) => f.endsWith(".png"))
    .sort();
  if (slides.length === 0) throw new Error("preview-deck.py produced no slides");

  const html = `<!doctype html><meta charset="utf-8"><style>
    @page { size: ${DECK_W} ${DECK_H}; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    /* One slide per page, filling it exactly. break-inside guards against a
       renderer deciding a 7.5in image needs two pages. */
    img { display: block; width: ${DECK_W}; height: ${DECK_H}; break-inside: avoid;
          break-after: page; }
    img:last-child { break-after: auto; }
  </style>${slides.map((f) => `<img src="${join(dir, f)}">`).join("")}`;

  const file = join(dir, "deck.html");
  writeFileSync(file, html);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`file://${file}`);
  await page.pdf({ path: OUT_DECK, width: DECK_W, height: DECK_H, printBackground: true });
  await browser.close();
  console.log(`  ✓ ${OUT_DECK} — ${slides.length} slides`);
}

/**
 * The document's own tokens, restated here because a PDF has no Tailwind.
 * Values are copied from `app/globals.css`; if one drifts, that file wins.
 */
const DOC_CSS = `
  @page { size: A4; margin: 18mm 16mm; }
  body { font: 10.5pt/1.55 -apple-system, "Helvetica Neue", Arial, sans-serif;
         color: #3F4A57; margin: 0; }
  h1 { font-size: 22pt; color: #115E59; margin: 0 0 6pt; line-height: 1.2; }
  h2 { font-size: 15pt; color: #1A2733; margin: 22pt 0 7pt; line-height: 1.25;
       border-bottom: 1px solid #D8DEE4; padding-bottom: 4pt; }
  h3 { font-size: 12pt; color: #1A2733; margin: 15pt 0 5pt; }
  /* A heading alone at the foot of a page reads as a mistake in a submitted
     document, so headings stay with what follows them. */
  h1, h2, h3 { break-after: avoid; }
  p { margin: 0 0 8pt; }
  strong { color: #1A2733; }
  a { color: #0F766E; }
  code { font: 9.5pt/1.4 "SF Mono", Menlo, monospace; background: #F1F5F4;
         padding: 1pt 3pt; border-radius: 3px; color: #115E59; }
  pre { background: #F1F5F4; padding: 8pt 10pt; border-radius: 6px; overflow: hidden; }
  pre code { background: none; padding: 0; }
  blockquote { margin: 10pt 0; padding: 8pt 12pt; background: #F0FDFA;
               border-left: 3px solid #0F766E; }
  blockquote p:last-child { margin-bottom: 0; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0 12pt;
          font-size: 9.5pt; }
  th, td { border: 1px solid #D8DEE4; padding: 5pt 7pt; text-align: left;
           vertical-align: top; }
  th { background: #F1F5F4; color: #1A2733; }
  /* Tables here carry long "why not" cells; splitting a row across a page makes
     the reason unreadable. Split BETWEEN rows only. */
  tr { break-inside: avoid; }
  img { max-width: 100%; height: auto; }
  hr { border: 0; border-top: 1px solid #D8DEE4; margin: 16pt 0; }
  ul, ol { margin: 0 0 8pt; padding-left: 18pt; }
  li { margin-bottom: 3pt; }
  .pagebreak { break-after: page; }
`;

async function buildDocPdf() {
  const src = readFileSync("docs/HOW_WE_BUILT_IT.md", "utf8");
  const body = micromark(src, {
    allowDangerousHtml: true,
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  })
    // The author's own page breaks, honoured. They mark the title page and the
    // section boundaries the document was written around.
    .replace(/<!--\s*pagebreak\s*-->/g, '<div class="pagebreak"></div>');

  const html = `<!doctype html><meta charset="utf-8"><style>${DOC_CSS}</style>${body}`;
  const file = join(mkdtempSync(join(tmpdir(), "dagar-doc-")), "doc.html");
  writeFileSync(file, html);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  // Through the docs directory, so `![](architecture.png)` resolves to the real
  // diagram rather than a broken-image box in a submitted PDF.
  await page.goto(`file://${resolve("docs")}/`);
  await page.setContent(html);
  await page.addStyleTag({ content: DOC_CSS });
  await page.pdf({
    path: OUT_DOC,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate:
      '<div style="width:100%;font:8pt -apple-system,Arial;color:#5B6673;' +
      'padding:0 16mm;display:flex;justify-content:space-between;">' +
      "<span>Dagar · How We Built It</span>" +
      '<span class="pageNumber"></span></div>',
    margin: { top: "18mm", bottom: "16mm", left: "16mm", right: "16mm" },
  });
  await browser.close();
  console.log(`  ✓ ${OUT_DOC}`);
}

await buildDeckPdf();
await buildDocPdf();
