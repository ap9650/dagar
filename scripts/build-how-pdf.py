#!/usr/bin/env python3
"""
Renders `docs/HOW_WE_BUILT_IT.md` into `docs/deck/Dagar-How-We-Built-It.pdf`.

    python3 scripts/build-how-pdf.py

── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────────
There was already a PDF at that path. It was a browser print-to-PDF, made by hand
on 3 August and never made again, so by September it was five weeks behind the
markdown and still called the product Saathi on every page. Because its pages are
images, no grep in this repo could see the old name — the rename sweep passed
over it, and a search for "Saathi" reported clean while the file said otherwise.

That is the whole argument for this script. A build artefact nobody can rebuild
is not an artefact, it is a copy that rots quietly and then gets published.

The markdown is the source of truth. Both this and `build-how-doc.py` read it, so
the PDF and the .docx cannot disagree.

── THE MARKDOWN SUBSET ─────────────────────────────────────────────────────────
Exactly what that document uses, matching `build-how-doc.py` block for block:
h1/h2/h3, paragraphs, `- ` bullets, `1. ` numbered lists, `| … |` tables with a
header rule, `> ` callouts, `---` rules, `![alt](path)` images,
`<!-- pagebreak -->`, and inline **bold** / *italic* / `code`. Anything else is
drawn as plain text rather than silently mangled.

── FONTS ───────────────────────────────────────────────────────────────────────
Arial, to match the .docx, and Devanagari MT for the one Devanagari word in the
document — the wordmark डगर. Both ship with macOS, as do the `qlmanage` and `say`
binaries the deck and demo builds already depend on.

Helvetica would have been one less dependency and is wrong: it is a base-14 font
with WinAnsi encoding, and this document contains → and ≥. Those would not have
errored, they would have come out as black boxes in the middle of a sentence.
"""
import os
import pathlib
import re
import shutil

from reportlab.lib.colors import Color
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

SRC = pathlib.Path("docs/HOW_WE_BUILT_IT.md")
OUT = pathlib.Path("docs/deck/Dagar-How-We-Built-It.pdf")

# The deck's palette, so the deck, the feedback report and this look like one set.
INK = Color(0.10, 0.15, 0.20)
BODY = Color(0.25, 0.29, 0.34)
MUTED = Color(0.36, 0.40, 0.45)
PRIMARY = Color(0.06, 0.46, 0.43)
PRIMARY_STRONG = Color(0.07, 0.37, 0.35)
RULE = Color(0.85, 0.87, 0.89)
WASH = Color(0.94, 0.97, 0.96)
SOFT = Color(0.80, 0.98, 0.945)

W, H = A4
M = 52                      # page margin
COL = W - 2 * M             # text column width

SYS = "/System/Library/Fonts/Supplemental"
FONTS = {
    "R": f"{SYS}/Arial.ttf",
    "B": f"{SYS}/Arial Bold.ttf",
    "I": f"{SYS}/Arial Italic.ttf",
    "C": f"{SYS}/Courier New.ttf",
}
DEVA = f"{SYS}/DevanagariMT.ttc"

for name, path in FONTS.items():
    pdfmetrics.registerFont(TTFont(name, path))
# The wordmark only. Missing on a non-Mac, and a missing wordmark is a cosmetic
# loss on one line — not a reason to fail a build that is otherwise complete.
HAS_DEVA = os.path.exists(DEVA)
if HAS_DEVA:
    pdfmetrics.registerFont(TTFont("D", DEVA, subfontIndex=0))


# ── inline formatting ───────────────────────────────────────────────────────────
# **bold** is tried before *italic*, or the opening two stars of a bold span match
# as an empty italic and the rest of the span leaks out as literal asterisks.
INLINE = re.compile(r"(\*\*.+?\*\*|\*[^*]+?\*|`.+?`)")


DEVANAGARI = re.compile(r"([ऀ-ॿ]+)")


def script_split(text, font, size):
    """Hand Devanagari to the Devanagari font and leave everything else alone.

    Arial has no Devanagari, and reportlab does not fall back — it draws the
    missing glyph, so डगर came out as three empty boxes mid-sentence. It appears
    twice in this document and both are the product's own name, which is a poor
    word to render as tofu.

    Bold and italic collapse to regular here: Devanagari MT ships one face, and a
    synthesised slant on a shirorekha script looks like a rendering fault.
    """
    if not HAS_DEVA or not DEVANAGARI.search(text):
        return [(text, font, size)]
    return [(part, "D" if DEVANAGARI.fullmatch(part) else font, size)
            for part in DEVANAGARI.split(text) if part]


def runs(text, font="R", size=10):
    """Markdown inline spans → [(text, font, size)], ready to measure and draw."""
    out = []
    for piece in INLINE.split(text):
        if not piece:
            continue
        if piece.startswith("**") and piece.endswith("**"):
            out += script_split(piece[2:-2], "B", size)
        elif piece.startswith("*") and piece.endswith("*"):
            out += script_split(piece[1:-1], "I", size)
        elif piece.startswith("`") and piece.endswith("`"):
            # Courier at the same point size reads a size larger than the text
            # around it, so it is nudged down rather than left to shout.
            out += script_split(piece[1:-1], "C", size - 0.5)
        else:
            out += script_split(piece, font, size)
    return out


def wrap(parts, width):
    """Wrap styled runs to `width`, breaking on spaces and keeping each run's font.

    Returns a list of lines, each a list of (text, font, size). Splitting on
    " " and re-joining would collapse the double space this document uses in
    "  ·  " separators, so the separator is kept as part of the token.
    """
    lines, line, x = [], [], 0.0
    for text, font, size in parts:
        for token in re.split(r"(\s+)", text):
            if not token:
                continue
            w = stringWidth(token, font, size)
            if x + w > width and line and token.strip():
                lines.append(line)
                line, x = [], 0.0
            if not line and not token.strip():
                continue                      # no leading space on a fresh line
            line.append((token, font, size))
            x += w
    if line:
        lines.append(line)
    return lines or [[]]


class Doc:
    def __init__(self, path):
        self.c = canvas.Canvas(str(path), pagesize=A4)
        self.c.setTitle("Dagar — How We Built It")
        self.c.setAuthor("Akriti Panwar")
        self.y = H - M
        self.page = 1
        self.numbering = False   # the cover carries no folio

    # ── page furniture ──────────────────────────────────────────────────────────
    def _footer(self):
        if not self.numbering:
            return
        self.c.setFillColor(MUTED)
        self.c.setFont("R", 7.5)
        self.c.drawString(M, 26, "Dagar  ·  How We Built It")
        self.c.drawRightString(W - M, 26, str(self.page))

    def new_page(self):
        self._footer()
        self.c.showPage()
        self.page += 1
        self.y = H - M

    def space(self, need):
        """Break the page when `need` points will not fit below the cursor."""
        if self.y - need < M + 18:
            self.new_page()

    # ── blocks ──────────────────────────────────────────────────────────────────
    def text(self, parts, indent=0, gap=7, lead=None):
        size = max(p[2] for p in parts) if parts else 10
        lead = lead or size * 1.45
        for line in wrap(parts, COL - indent):
            self.space(lead)
            x = M + indent
            for token, font, sz in line:
                self.c.setFont(font, sz)
                self.c.drawString(x, self.y - size, token)
                x += stringWidth(token, font, sz)
            self.y -= lead
        self.y -= gap

    def heading(self, text, level):
        size = {1: 20, 2: 14, 3: 11.5}[level]
        colour = {1: INK, 2: PRIMARY_STRONG, 3: INK}[level]
        # Keep the heading with the first line of what follows: a heading alone at
        # the foot of a page is the most common ugly break in a generated PDF.
        self.space(size * 1.45 + 26)
        self.y -= {1: 0, 2: 16, 3: 12}[level]
        self.c.setFillColor(colour)
        self.text(runs(text, "B", size), gap=6)
        if level == 2:
            self.y += 2
            self.c.setStrokeColor(SOFT)
            self.c.setLineWidth(1.4)
            self.c.line(M, self.y, W - M, self.y)
            self.y -= 10
        self.c.setFillColor(BODY)

    def bullets(self, items, ordered=False):
        for n, item in enumerate(items, 1):
            marker = f"{n}." if ordered else "•"
            self.space(15)
            self.c.setFillColor(PRIMARY if not ordered else MUTED)
            self.c.setFont("B" if ordered else "R", 10)
            self.c.drawString(M + 4, self.y - 10, marker)
            self.c.setFillColor(BODY)
            self.text(runs(item), indent=20, gap=3)
        self.y -= 5

    def callout(self, text):
        parts = runs(text, "R", 10)
        lines = wrap(parts, COL - 26)
        height = len(lines) * 14.5 + 16
        self.space(height)
        self.c.setFillColor(WASH)
        self.c.rect(M, self.y - height + 8, COL, height, stroke=0, fill=1)
        self.c.setFillColor(PRIMARY)
        self.c.rect(M, self.y - height + 8, 3, height, stroke=0, fill=1)
        self.y -= 8
        self.c.setFillColor(PRIMARY_STRONG)
        self.text(parts, indent=16, gap=14, lead=14.5)
        self.c.setFillColor(BODY)

    def table(self, rows):
        header, body = rows[0], rows[1:]
        n = len(header)

        # Column widths from the longest cell in each column, so a "Layer" column
        # does not get the same slab as the sentence of prose beside it. Clamped
        # so no column collapses below something readable.
        longest = [max(len(r[i]) if i < len(r) else 0 for r in rows) for i in range(n)]
        total = sum(longest) or 1
        widths = [max(COL * 0.13, COL * (w / total)) for w in longest]
        widths = [w * COL / sum(widths) for w in widths]

        def row_lines(row, size):
            return [wrap(runs(row[i] if i < len(row) else "", "R", size), widths[i] - 14)
                    for i in range(n)]

        def draw(row, size, bold, fill):
            cells = row_lines(row, size)
            height = max(len(c) for c in cells) * (size * 1.35) + 11
            self.space(height)
            top = self.y
            if fill:
                self.c.setFillColor(fill)
                self.c.rect(M, top - height, COL, height, stroke=0, fill=1)
            x = M
            for i, cell in enumerate(cells):
                yy = top - 5
                for line in cell:
                    tx = x + 7
                    for token, font, sz in line:
                        self.c.setFillColor(INK if bold else BODY)
                        self.c.setFont("B" if bold and font == "R" else font, sz)
                        self.c.drawString(tx, yy - size, token)
                        tx += stringWidth(token, "B" if bold and font == "R" else font, sz)
                    yy -= size * 1.35
                x += widths[i]
            self.c.setStrokeColor(RULE)
            self.c.setLineWidth(0.5)
            self.c.line(M, top - height, W - M, top - height)
            self.y = top - height

        self.space(40)
        draw(header, 8.5, True, WASH)
        for row in body:
            draw(row, 8.5, False, None)
        self.y -= 12

    def image(self, path, caption):
        img = ImageReader(path)
        iw, ih = img.getSize()
        width = COL
        height = width * ih / iw
        # A tall diagram on a nearly full page would be scaled to a stripe. Give
        # it its own page instead.
        if height > H - 2 * M - 40:
            height = H - 2 * M - 40
            width = height * iw / ih
        self.space(height + 26)
        self.c.drawImage(img, M + (COL - width) / 2, self.y - height,
                         width=width, height=height, mask="auto")
        self.y -= height + 8
        if caption:
            self.c.setFillColor(MUTED)
            self.text(runs(caption, "I", 8.5), gap=12)
            self.c.setFillColor(BODY)

    def rule(self):
        self.space(16)
        self.y -= 4
        self.c.setStrokeColor(RULE)
        self.c.setLineWidth(0.6)
        self.c.line(M, self.y, W - M, self.y)
        self.y -= 12

    def cover(self, lines):
        self.y = H * 0.62
        if HAS_DEVA:
            self.c.setFillColor(PRIMARY_STRONG)
            self.c.setFont("D", 52)
            self.c.drawCentredString(W / 2, self.y, "डगर")
            self.y -= 40
        self.c.setFillColor(PRIMARY_STRONG)
        self.c.setFont("B", 40)
        self.c.drawCentredString(W / 2, self.y, "Dagar")
        self.y -= 26
        self.c.setFillColor(PRIMARY)
        self.c.setFont("R", 11)
        self.c.drawCentredString(W / 2, self.y, "the trail you walk")
        self.y -= 46
        self.c.setFillColor(INK)
        self.c.setFont("B", 23)
        self.c.drawCentredString(W / 2, self.y, "How We Built It")
        self.y -= 34
        for line in lines:
            # Centred, so each line is measured whole rather than wrapped.
            parts = runs(re.sub(r"\*\*|`", "", line), "R", 10.5)
            width = sum(stringWidth(t, f, s) for t, f, s in parts)
            x = (W - width) / 2
            for token, font, size in parts:
                self.c.setFillColor(MUTED)
                self.c.setFont(font, size)
                self.c.drawString(x, self.y, token)
                x += stringWidth(token, font, size)
            self.y -= 17

    def save(self):
        self._footer()
        self.c.save()


def parse_row(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    cover_md, rest = SRC.read_text(encoding="utf-8").split("<!-- pagebreak -->", 1)

    doc = Doc(OUT)
    doc.cover([ln.strip() for ln in cover_md.splitlines()
               if ln.strip() and not ln.startswith("#")])
    doc.new_page()
    doc.numbering = True
    doc.page = 1

    lines = rest.splitlines()
    # False, not True: the `<!-- pagebreak -->` that ends the cover block was
    # consumed by the split above and already paid for by `new_page()`. Starting
    # True broke the page a second time and left a blank page 2.
    pending_break = False
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()

        if not line.strip():
            i += 1
            continue

        if line.strip() == "---":
            i += 1
            continue

        if line.startswith("<!-- pagebreak -->"):
            pending_break = True
            i += 1
            continue

        if line.startswith("|"):
            block = []
            while i < len(lines) and lines[i].startswith("|"):
                if not re.match(r"^\|[\s:\-|]+\|$", lines[i].strip()):
                    block.append(parse_row(lines[i]))
                i += 1
            doc.table(block)
            continue

        if line.startswith("> "):
            block = []
            while i < len(lines) and lines[i].startswith("> "):
                block.append(lines[i][2:])
                i += 1
            doc.callout(" ".join(block))
            continue

        if re.match(r"^\d+\. ", line):
            block = []
            while i < len(lines) and re.match(r"^\d+\. ", lines[i]):
                block.append(re.sub(r"^\d+\. ", "", lines[i]))
                i += 1
            doc.bullets(block, ordered=True)
            continue

        if line.startswith("- "):
            block = []
            while i < len(lines) and lines[i].startswith("- "):
                block.append(lines[i][2:])
                i += 1
            doc.bullets(block)
            continue

        if line.startswith("### "):
            doc.heading(line[4:], 3)
        elif line.startswith("## "):
            if pending_break:
                doc.new_page()
                pending_break = False
            doc.heading(line[3:], 2)
        elif line.startswith("# "):
            doc.heading(line[2:], 1)
        elif line.startswith("!["):
            m = re.match(r"!\[(.*?)\]\((.*?)\)", line)
            path = os.path.join("docs", m.group(2))
            if os.path.exists(path):
                doc.image(path, m.group(1))
        else:
            doc.c.setFillColor(BODY)
            doc.text(runs(line))

        i += 1

    doc.save()
    print(f"wrote {OUT}  ({doc.page} pages, {OUT.stat().st_size / 1000:.0f} KB)")

    # Also into `public/reports/`, so the file has a URL and not only a path —
    # and by the build, never by hand, for the reason in the docstring above.
    web = pathlib.Path("public/reports")
    web.mkdir(parents=True, exist_ok=True)
    shutil.copy(OUT, web / OUT.name)
    print(f"  → public/reports/{OUT.name}  — deploy to publish at /reports/{OUT.name}")


if __name__ == "__main__":
    main()
