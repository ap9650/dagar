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

So slide 26 gets a real link annotation instead, pointing at the file sitting
beside the PDF. Keep the PDF and the two mp4s in the same folder and the link
opens the video in the system player. If they are separated, the page still
carries the address of the live app, and the four screenshots still tell the
story on their own.
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

# Page (1-based) carrying the demo, and the files it should offer.
DEMO_PAGE = 26
DEMO_FILES = ["Dagar-Demo-EN.mp4", "Dagar-Demo-HI.mp4"]


def render(index):
    """One slide as a PNG, through the same renderer used for review."""
    png = WORK / f"{index:02d}.png"
    if png.exists():
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
            # An invisible button over the four screenshots. Two links side by
            # side, one per language, each opening the file next to the PDF.
            half = width / 2
            for n, name in enumerate(DEMO_FILES):
                rect = (n * half + 60, height * 0.28,
                        (n + 1) * half - 60, height * 0.72)
                pdf.linkURL(name, rect, relative=1, thickness=0)
            # A visible cue, because an invisible link nobody knows about is
            # the same as no link.
            pdf.setFillColor(Color(0.06, 0.46, 0.43))
            pdf.setFont("Helvetica-Bold", 11)
            pdf.drawCentredString(
                half, height * 0.135,
                "Click the left half for the English demo, "
                "the right half for Hindi. Keep the mp4 files beside this PDF.",
            )

        pdf.showPage()

    pdf.save()
    size = OUT.stat().st_size / 1_000_000
    print(f"wrote {OUT}  ({count} pages, {size:.1f} MB)")


if __name__ == "__main__":
    main()
