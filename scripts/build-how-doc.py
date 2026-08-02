#!/usr/bin/env python3
"""
Renders `docs/HOW_WE_BUILT_IT.md` into `docs/deck/Dagar-How-We-Built-It.docx`.

The markdown is the source of truth; the .docx is a build artefact. Edit the .md
and re-run, or edit the .docx directly and never run this again — both are
editable, which is the point. Open the .docx in Word or Google Docs and
File → Save as PDF for the submission.

Handles the markdown subset actually used in that file: h1/h2/h3, paragraphs,
`- ` bullets, `| … |` tables with a header rule, `> ` callouts, `---` rules,
`![alt](path)` images, `<!-- pagebreak -->`, and inline **bold** / `code`.
Anything else is passed through as plain text rather than silently mangled.

    python3 scripts/build-how-doc.py
"""

import os
import re

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

SRC = "docs/HOW_WE_BUILT_IT.md"
OUT = "docs/deck/Dagar-How-We-Built-It.docx"

PRIMARY = RGBColor(0x0F, 0x76, 0x6E)
PRIMARY_STRONG = RGBColor(0x11, 0x5E, 0x59)
INK = RGBColor(0x1A, 0x27, 0x33)
BODY = RGBColor(0x3F, 0x4A, 0x57)
MUTED = RGBColor(0x5B, 0x66, 0x73)

FONT = "Arial"


def shade(cell, hex_colour):
    el = OxmlElement("w:shd")
    el.set(qn("w:val"), "clear")
    el.set(qn("w:fill"), hex_colour)
    cell._tc.get_or_add_tcPr().append(el)


def left_bar(paragraph, hex_colour):
    """A coloured left border — used for the callout blocks."""
    pPr = paragraph._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    left = OxmlElement("w:left")
    left.set(qn("w:val"), "single")
    left.set(qn("w:sz"), "18")
    left.set(qn("w:space"), "10")
    left.set(qn("w:color"), hex_colour)
    borders.append(left)
    pPr.append(borders)


# **bold** must be tried before *italic*, or the first two stars of a bold span
# match as an empty italic and the rest leaks out as literal asterisks.
INLINE = re.compile(r"(\*\*.+?\*\*|\*[^*]+?\*|`.+?`)")


def add_runs(paragraph, text, size=10.5, color=BODY, bold=False, italic=False):
    """Split on **bold**, *italic* and `code` and emit a run for each piece."""
    for piece in INLINE.split(text):
        if not piece:
            continue
        run = paragraph.add_run()
        if piece.startswith("**") and piece.endswith("**"):
            run.text = piece[2:-2]
            run.font.bold = True
            run.font.name = FONT
        elif piece.startswith("*") and piece.endswith("*"):
            run.text = piece[1:-1]
            run.font.italic = True
            run.font.name = FONT
            run.font.size = Pt(size)
            run.font.color.rgb = color
            continue
        elif piece.startswith("`") and piece.endswith("`"):
            run.text = piece[1:-1]
            run.font.name = "Consolas"
            run.font.color.rgb = PRIMARY_STRONG
        else:
            run.text = piece
            run.font.bold = bold
            run.font.name = FONT
        run.font.size = Pt(size)
        run.font.italic = italic
        if run.font.color.rgb is None:
            run.font.color.rgb = color
    return paragraph


def para(doc, space_before=0, space_after=6, indent=0.0):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.25
    if indent:
        p.paragraph_format.left_indent = Inches(indent)
    return p


def heading(doc, text, level):
    sizes = {1: 22, 2: 15, 3: 12}
    colours = {1: INK, 2: PRIMARY_STRONG, 3: INK}
    p = para(doc, space_before=18 if level > 1 else 0, space_after=7)
    add_runs(p, text, size=sizes[level], color=colours[level], bold=True)
    if level == 2:
        pPr = p._p.get_or_add_pPr()
        borders = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        bottom.set(qn("w:val"), "single")
        bottom.set(qn("w:sz"), "6")
        bottom.set(qn("w:space"), "6")
        bottom.set(qn("w:color"), "CCFBF1")
        borders.append(bottom)
        pPr.append(borders)
    return p


def add_table(doc, rows):
    header, body_rows = rows[0], rows[1:]
    table = doc.add_table(rows=1, cols=len(header))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    for i, text in enumerate(header):
        cell = table.rows[0].cells[i]
        cell.text = ""
        shade(cell, "F1F5F4")
        add_runs(cell.paragraphs[0], text, size=9.5, color=INK, bold=True)
    for row in body_rows:
        cells = table.add_row().cells
        for i, text in enumerate(row):
            if i >= len(cells):
                break
            cells[i].text = ""
            add_runs(cells[i].paragraphs[0], text, size=9.5)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    return table


def parse_row(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def cover(doc, lines):
    """The first block, up to the pagebreak, laid out as a title page."""
    for _ in range(4):
        doc.add_paragraph()
    p = para(doc, space_after=4)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_runs(p, "Dagar", size=44, color=PRIMARY_STRONG, bold=True)
    p = para(doc, space_after=22)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_runs(p, "साथी  ·  companion", size=12, color=PRIMARY)
    p = para(doc, space_after=20)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_runs(p, "How We Built It", size=24, color=INK, bold=True)
    for line in lines:
        p = para(doc, space_after=5)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_runs(p, line, size=11, color=MUTED)


def main() -> None:
    text = open(SRC, encoding="utf-8").read()
    cover_md, rest = text.split("<!-- pagebreak -->", 1)

    doc = Document()
    section = doc.sections[0]
    section.left_margin = section.right_margin = Inches(1.0)
    section.top_margin = section.bottom_margin = Inches(0.9)
    style = doc.styles["Normal"]
    style.font.name = FONT
    style.font.size = Pt(10.5)

    cover_lines = [ln.strip() for ln in cover_md.splitlines()
                   if ln.strip() and not ln.startswith("#")]
    cover(doc, cover_lines)

    # page_break_before on the NEXT block, rather than an empty paragraph holding
    # a break run — the empty paragraph rendered as a stray glyph in previewers
    # that do not paginate, and left a blank line in ones that do.
    pending_break = True

    lines = rest.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()

        if not line.strip() or line.strip() == "---":
            i += 1
            continue

        if line.startswith("<!-- pagebreak -->"):
            pending_break = True
            i += 1
            continue

        if line.startswith("### "):
            heading(doc, line[4:], 3)
        elif line.startswith("## "):
            h = heading(doc, line[3:], 2)
            if pending_break:
                h.paragraph_format.page_break_before = True
                pending_break = False
        elif line.startswith("# "):
            heading(doc, line[2:], 1)

        elif line.startswith("!["):
            m = re.match(r"!\[(.*?)\]\((.*?)\)", line)
            path = os.path.join("docs", m.group(2))
            if os.path.exists(path):
                doc.add_picture(path, width=Inches(6.3))
                doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
                cap = para(doc, space_after=10)
                cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                add_runs(cap, m.group(1), size=9, color=MUTED, italic=True)

        elif line.startswith("|"):
            block = []
            while i < len(lines) and lines[i].startswith("|"):
                if not re.match(r"^\|[\s:\-|]+\|$", lines[i].strip()):
                    block.append(parse_row(lines[i]))
                i += 1
            add_table(doc, block)
            continue

        elif line.startswith("> "):
            block = []
            while i < len(lines) and lines[i].startswith("> "):
                block.append(lines[i][2:])
                i += 1
            p = para(doc, space_before=6, space_after=10, indent=0.16)
            left_bar(p, "0F766E")
            add_runs(p, " ".join(block), size=10.5, color=PRIMARY_STRONG)
            continue

        elif re.match(r"^\d+\. ", line):
            block = []
            while i < len(lines) and re.match(r"^\d+\. ", lines[i]):
                block.append(lines[i])
                i += 1
            for item in block:
                p = para(doc, space_after=4, indent=0.24)
                add_runs(p, item, size=10.5)
            continue

        elif line.startswith("- "):
            block = []
            while i < len(lines) and lines[i].startswith("- "):
                block.append(lines[i][2:])
                i += 1
            for item in block:
                p = doc.add_paragraph(style="List Bullet")
                p.paragraph_format.space_after = Pt(4)
                p.paragraph_format.line_spacing = 1.2
                add_runs(p, item, size=10.5)
            continue

        else:
            add_runs(para(doc), line, size=10.5)

        i += 1

    doc.save(OUT)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
