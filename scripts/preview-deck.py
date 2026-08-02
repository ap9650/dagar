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

SLIDES = [bd.cover, bd.s1_problem, bd.s2_solution, bd.s3_validation,
          bd.s4_market_size, bd.s5_persona, bd.s6_features, bd.s7_how,
          bd.s8_next, bd.s9_roadmap, bd.s10_adoption, bd.s11_competitors,
          bd.s12_pricing, bd.s13_testimonials]


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
