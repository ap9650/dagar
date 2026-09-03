"""
The pitch deck as a PDF, with the demo video reachable from slide 26.

    python3 scripts/build-pitch-pdf.py

    → docs/deck/Dagar-Pitch-Deck.pdf

── WHY IT RENDERS RATHER THAN CONVERTS ─────────────────────────────────────────
There is no PowerPoint, Keynote or LibreOffice on this machine, so there is
nothing to convert the .pptx with. What there is, is the same Quick Look
renderer already used to preview a single slide during authoring, so every page
here is produced by the tool whose output has been reviewed all along. The PDF
therefore looks exactly like the slides that were signed off.

The cost is that pages are images: no selectable text, and no hyperlinks except
the ones added deliberately below.

── THE VIDEO LINK ──────────────────────────────────────────────────────────────
A PDF cannot reliably play video. Acrobat can embed it, nothing else honours it,
and a judge on a phone or in a browser gets an empty box.

So slide 26 links out instead, to the two recordings served from the app's own
domain. An earlier version pointed at files sitting beside the PDF, which broke
the moment the deck was uploaded on its own. This deck is submitted as a single
file, so the link has to survive being the only thing that arrives.

The addresses are printed on the page as well as being clickable, so they still
work from a printout, a screenshot, or a viewer that strips annotations.
"""
import pathlib
import shutil
import subprocess
import sys

from PIL import Image
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas

sys.path.insert(0, str(pathlib.Path(__file__).parent))

SW, SH = 13.333, 7.5          # slide size in inches, matching build-pitch.py
DPI = 72                      # PDF points per inch
OUT = pathlib.Path("docs/deck/Dagar-Pitch-Deck.pdf")
WORK = pathlib.Path(".pdf-build")

# Page (1-based) carrying the demo, and where the recordings are served from.
# Same domain as the app, so there is one thing to keep alive rather than two.
DEMO_PAGE = 26
DEMO_LINKS = [
    ("Watch in English", "https://dagar-ap19.vercel.app/demo-en.mp4"),
    ("हिंदी में देखिए", "https://dagar-ap19.vercel.app/demo-hi.mp4"),
]


SOURCE = pathlib.Path("scripts/build-pitch.py")


def render(index):
    """One slide as a PNG, through the same renderer used for review.

    ── THE CACHE HAS TO EXPIRE ─────────────────────────────────────────────────
    This used to reuse any PNG that existed, full stop. Every rebuild after the
    first therefore produced a PDF of the slides as they were the first time,
    silently: the build printed "wrote ... 27 pages" and the file was days out
    of date. A whole afternoon of edits shipped to nobody.

    A cache keyed on nothing is not a cache, it is a stale copy. This one
    expires whenever the deck source is newer than the render.
    """
    png = WORK / f"{index:02d}.png"
    if png.exists() and png.stat().st_mtime > SOURCE.stat().st_mtime:
        return png
    subprocess.run(
        [sys.executable, "scripts/build-pitch.py", "--only", str(index)],
        check=True, capture_output=True,
    )
    shutil.move(f"/tmp/pitch-{index:02d}.png", png)
    return png


def main():
    WORK.mkdir(exist_ok=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)

    # How many slides there are, without importing the module and running it.
    source = pathlib.Path("scripts/build-pitch.py").read_text()
    block = source.split("SLIDES = [", 1)[1].split("]", 1)[0]
    count = len([p for p in block.replace("\n", " ").split(",") if p.strip()])

    width, height = SW * DPI, SH * DPI
    pdf = canvas.Canvas(str(OUT), pagesize=(width, height))
    pdf.setTitle("Dagar — Pitch Deck")
    pdf.setAuthor("Akriti Panwar")

    for i in range(count):
        png = render(i)
        with Image.open(png) as im:
            pdf.drawImage(str(png), 0, 0, width=width, height=height,
                          preserveAspectRatio=False)

        if i + 1 == DEMO_PAGE:
            # The addresses are drawn on the page, not just wrapped around
            # invisible rectangles. An annotation-only link disappears in a
            # printout, a screenshot, or a viewer that strips them, and this
            # deck may be the only file that arrives.
            # The slide already prints both addresses in its closing band. All
            # this adds is a clickable region over each half, from the band up
            # across the screenshots, so a click anywhere sensible works.
            half = width / 2
            for n, (_, url) in enumerate(DEMO_LINKS):
                pdf.linkURL(url,
                            (n * half + 40, height * 0.10,
                             (n + 1) * half - 40, height * 0.74),
                            relative=0, thickness=0)

        pdf.showPage()

    pdf.save()
    size = OUT.stat().st_size / 1_000_000
    print(f"wrote {OUT}  ({count} pages, {size:.1f} MB)")


if __name__ == "__main__":
    main()
