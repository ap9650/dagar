#!/usr/bin/env python3
"""
The persona illustration for slide 5 of the pitch deck.

DRAWN, NOT PHOTOGRAPHED — on purpose. Aarav is a composite persona, not a real
child. A stock photograph of a real 13-year-old standing in for "the underserved
learner" is both a licensing question and a dignity one; an illustration says
"this is a composite" without anyone having to read the caption.

Palette is the product's own (saathi-design), so the deck and the app agree.
Drawn at 4x and downsampled — PIL has no anti-aliasing on shapes, and a 13-year-old
with jagged edges undersells the point.

    python3 scripts/gen-persona-illustration.py
"""

from PIL import Image, ImageDraw

S = 4  # supersample factor
W = H = 1000

PRIMARY = (15, 118, 110)
PRIMARY_STRONG = (17, 94, 89)
PRIMARY_SOFT = (204, 251, 241)
INK = (26, 39, 51)
BORDER = (216, 222, 228)
WHITE = (255, 255, 255)
SKIN = (201, 138, 94)
SKIN_SHADE = (176, 116, 76)
HAIR = (35, 25, 15)
STREAK = (234, 88, 12)


def px(*vals):
    """Scale user-space coordinates into supersampled space."""
    return [v * S for v in vals]


def ellipse(d, cx, cy, rx, ry, fill, outline=None, width=0):
    d.ellipse(px(cx - rx, cy - ry, cx + rx, cy + ry), fill=fill, outline=outline,
              width=width * S if width else 0)


def main() -> None:
    img = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # ── the disc the whole portrait sits in ────────────────────────────────
    ellipse(d, 500, 500, 490, 490, PRIMARY_SOFT)

    # ── shoulders ─────────────────────────────────────────────────────────
    # Clipped by the disc below, so it can overshoot the canvas happily.
    d.ellipse(px(180, 730, 820, 1240), fill=PRIMARY)

    # ── neck ──────────────────────────────────────────────────────────────
    d.rounded_rectangle(px(452, 610, 548, 780), radius=40 * S, fill=SKIN_SHADE)

    # ── collar: a soft V so the tee reads as a tee ─────────────────────────
    d.polygon(px(430, 745, 500, 830, 570, 745), fill=PRIMARY_STRONG)

    # ── hair, back layer ──────────────────────────────────────────────────
    ellipse(d, 500, 452, 186, 206, HAIR)

    # ── face ──────────────────────────────────────────────────────────────
    ellipse(d, 336, 490, 30, 40, SKIN)   # ears
    ellipse(d, 664, 490, 30, 40, SKIN)
    ellipse(d, 500, 480, 166, 192, SKIN)

    # ── hair, front: a cap with a sweep across the brow ───────────────────
    d.pieslice(px(500 - 186, 452 - 206, 500 + 186, 452 + 206), 180, 360, fill=HAIR)
    d.polygon(px(330, 452, 340, 396, 470, 350, 668, 398, 668, 440,
                 540, 396, 400, 430),
              fill=HAIR)

    # ── eyes, and brows clear of the hairline ─────────────────────────────
    for ex in (443, 557):
        ellipse(d, ex, 500, 17, 20, INK)
        ellipse(d, ex + 6, 493, 5, 6, WHITE)
        d.line(px(ex - 25, 468, ex + 25, 462), fill=HAIR, width=8 * S)

    # ── nose and mouth ────────────────────────────────────────────────────
    d.arc(px(478, 512, 522, 566), 20, 160, fill=SKIN_SHADE, width=7 * S)
    d.arc(px(456, 548, 544, 612), 20, 160, fill=(140, 80, 60), width=9 * S)

    # ── clip the portrait to the disc ─────────────────────────────────────
    mask = Image.new("L", (W * S, H * S), 0)
    ImageDraw.Draw(mask).ellipse(px(10, 10, 990, 990), fill=255)
    img.putalpha(mask)

    out = Image.new("RGB", (W, H), WHITE)
    small = img.resize((W, H), Image.LANCZOS)
    out.paste(small, (0, 0), small)

    # ── the phone, deliberately OUTSIDE the clip ──────────────────────────
    # Drawn last so it overlaps the disc edge rather than being sliced by it —
    # a card resting on top of the portrait, which is also where it sits in his
    # life. Same 4x-then-downsample trick, on its own transparent layer.
    layer = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    p = ImageDraw.Draw(layer)
    p.rounded_rectangle(px(646, 646, 856, 966), radius=30 * S,
                        fill=WHITE, outline=BORDER, width=5 * S)
    p.rounded_rectangle(px(672, 674, 830, 722), radius=10 * S, fill=PRIMARY_SOFT)
    # progress ring — three-quarters round, the way the daily goal shows it
    p.arc(px(705, 748, 797, 840), 0, 360, fill=(241, 245, 244), width=14 * S)
    p.arc(px(705, 748, 797, 840), -90, 180, fill=PRIMARY, width=14 * S)
    p.ellipse(px(672, 872, 700, 900), fill=STREAK)  # streak flame
    p.rounded_rectangle(px(714, 878, 830, 896), radius=9 * S, fill=(216, 222, 228))
    p.rounded_rectangle(px(672, 916, 830, 934), radius=9 * S, fill=(216, 222, 228))

    phone = layer.resize((W, H), Image.LANCZOS)
    out.paste(phone, (0, 0), phone)

    path = "docs/deck/persona-aarav.png"
    out.save(path)
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
