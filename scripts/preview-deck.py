#!/usr/bin/env python3
"""
Renders every slide of the deck to a PNG so it can actually be looked at.

macOS Quick Look will only ever thumbnail slide 1 of a .pptx, so this builds a
one-slide file per slide and thumbnails each. Slow and silly, and still the
cheapest way to see the deck on a machine with no PowerPoint and no LibreOffice.

    python3 scripts/preview-deck.py [outdir]
"""

import subprocess
import sys
import importlib

from pptx import Presentation
from pptx.util import Inches

deck = importlib.import_module("build-deck".replace("-", "_")) if False else None

# build-deck.py is not an importable module name, so load it by path.
import importlib.util
spec = importlib.util.spec_from_file_location("builddeck", "scripts/build-deck.py")
bd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bd)

# From the deck itself, not a second copy of the list. The copy that used to
# live here silently omitted any slide added after it was written — so the one
# tool for looking at the deck was the tool least likely to show a new slide.
SLIDES = bd.SLIDES


def main() -> None:
    outdir = sys.argv[1] if len(sys.argv) > 1 else "/tmp/deck-preview"
    subprocess.run(["mkdir", "-p", outdir], check=True)
    for i, fn in enumerate(SLIDES):
        prs = Presentation()
        prs.slide_width, prs.slide_height = Inches(bd.SW), Inches(bd.SH)
        fn(prs)
        one = f"{outdir}/slide-{i:02d}.pptx"
        prs.save(one)
        subprocess.run(["qlmanage", "-t", "-s", "1800", "-o", outdir, one],
                       capture_output=True)
        subprocess.run(["mv", f"{outdir}/slide-{i:02d}.pptx.png",
                        f"{outdir}/slide-{i:02d}.png"], capture_output=True)
        subprocess.run(["rm", "-f", one], check=False)
    print(f"previews in {outdir}")


if __name__ == "__main__":
    main()
