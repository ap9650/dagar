#!/usr/bin/env python3
"""
The two persona portraits for the pitch deck: Lakshmi, and her father Suresh.

DRAWN, NOT PHOTOGRAPHED, on purpose. Both are composite personas, not real
people. A stock photograph of a real 13-year-old standing in for "the
underserved learner" is both a licensing question and a dignity one; an
illustration says "this is a composite" without anyone having to read a caption.

Each portrait carries the object that defines that person's relationship to the
product. Lakshmi holds the app: a progress ring and a streak. Suresh holds a
message, because he never opens the app at all, and the whole design of the
parent loop follows from that.

Palette is the product's own (saathi-design), so the deck and the app agree.
Drawn at 4x and downsampled, since PIL has no anti-aliasing on shapes.

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


def lakshmi() -> None:
    img = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # ── the disc the whole portrait sits in ────────────────────────────────
    ellipse(d, 500, 500, 490, 490, PRIMARY_SOFT)

    # ── hair, back layer ──────────────────────────────────────────────────
    # Wider and far longer than the face, so hair reads on both sides of it and
    # falls past the shoulders. Drawn BEFORE the shoulders, so the kurta sits
    # over it and the braids can come back over the top at the end.
    ellipse(d, 500, 560, 252, 336, HAIR)

    # ── shoulders ─────────────────────────────────────────────────────────
    # Clipped by the disc below, so it can overshoot the canvas happily.
    d.ellipse(px(180, 730, 820, 1240), fill=PRIMARY)

    # ── neck ──────────────────────────────────────────────────────────────
    d.rounded_rectangle(px(452, 610, 548, 780), radius=40 * S, fill=SKIN_SHADE)

    # ── collar: a round neckline, the way a kurta sits ────────────────────
    d.chord(px(414, 700, 586, 838), 0, 180, fill=PRIMARY_STRONG)

    # ── face ──────────────────────────────────────────────────────────────
    ellipse(d, 336, 490, 30, 40, SKIN)   # ears
    ellipse(d, 664, 490, 30, 40, SKIN)
    ellipse(d, 500, 480, 166, 192, SKIN)
    ellipse(d, 332, 520, 11, 11, STREAK)  # small studs
    ellipse(d, 668, 520, 11, 11, STREAK)

    # ── hair, front: a centre parting, not a boy's sweep ──────────────────
    d.pieslice(px(500 - 190, 452 - 210, 500 + 190, 452 + 210), 180, 360, fill=HAIR)
    # Two masses falling from the parting to either temple. The gap between
    # them at the crown IS the parting — no line needed to draw it.
    d.polygon(px(310, 500, 322, 396, 430, 340, 496, 330, 492, 404, 400, 436,
                 352, 500),
              fill=HAIR)
    d.polygon(px(690, 500, 678, 396, 570, 340, 504, 330, 508, 404, 600, 436,
                 648, 500),
              fill=HAIR)

    # ── eyes, and brows clear of the hairline ─────────────────────────────
    for ex in (443, 557):
        ellipse(d, ex, 500, 17, 20, INK)
        ellipse(d, ex + 6, 493, 5, 6, WHITE)
        d.line(px(ex - 25, 468, ex + 25, 462), fill=HAIR, width=8 * S)

    # ── nose and mouth ────────────────────────────────────────────────────
    d.arc(px(478, 512, 522, 566), 20, 160, fill=SKIN_SHADE, width=7 * S)
    d.arc(px(456, 548, 544, 612), 20, 160, fill=(140, 80, 60), width=9 * S)

    # ── braids, over the shoulders ────────────────────────────────────────
    # Four tapering beads each, so it reads as a plait rather than a rope, with
    # a ribbon at the end. Drawn last of the portrait layer, on top of the
    # kurta, because that is where a braid actually falls.
    for bx, drift in ((300, -14), (700, 14)):
        for i, r in enumerate((54, 47, 40, 33)):
            ellipse(d, bx + drift * i, 660 + i * 78, r, r + 8, HAIR)
        ellipse(d, bx + drift * 4, 660 + 4 * 78 - 26, 22, 16, STREAK)

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

    path = "docs/deck/persona-lakshmi.png"
    out.save(path)
    print(f"wrote {path}")


def suresh() -> None:
    """
    Lakshmi's father, and the reason the parent loop is a message.

    Same disc, same palette, deliberately the same visual weight: a secondary
    persona drawn smaller or plainer would say he matters less, and the product
    argument is that he is the difference between a learner who keeps going and
    one who quietly stops.

    He holds a WhatsApp message, not the app. That is the single most important
    thing this drawing has to say.
    """
    img = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    ellipse(d, 500, 500, 490, 490, PRIMARY_SOFT)

    # Shoulders in the strong teal rather than the mid tone, so the two
    # portraits are distinguishable at thumbnail size without leaving the palette.
    d.ellipse(px(170, 730, 830, 1250), fill=PRIMARY_STRONG)
    d.rounded_rectangle(px(452, 606, 548, 782), radius=40 * S, fill=SKIN_SHADE)

    # A collared shirt, not a round neckline: two lapels meeting at the throat.
    d.polygon(px(430, 742, 500, 812, 500, 890, 396, 800), fill=PRIMARY)
    d.polygon(px(570, 742, 500, 812, 500, 890, 604, 800), fill=PRIMARY)

    ellipse(d, 338, 486, 30, 40, SKIN)   # ears
    ellipse(d, 662, 486, 30, 40, SKIN)
    ellipse(d, 500, 476, 164, 188, SKIN)

    # Short hair, stopping WELL above the brows. The first attempt ran a dome
    # down to eye level and read as a swimming cap: on a short-haired figure the
    # hairline is most of the character, so it has to sit where a hairline sits.
    d.pieslice(px(500 - 178, 436 - 172, 500 + 178, 436 + 172), 182, 358, fill=HAIR)
    # A fringe swept across the crown, with no gap cut through to the scalp. The
    # first version lifted a skin-coloured wedge out to suggest a parting and it
    # read as a bald patch, which is a different man.
    d.polygon(px(384, 306, 486, 270, 660, 320, 676, 424, 626, 350, 470, 320,
                 372, 402), fill=HAIR)
    # Sideburns, in front of the ears rather than over them. The grey ellipses
    # that were here landed on the ears and read as bruises.
    for sx in (348, 652):
        d.rounded_rectangle(px(sx - 16, 424, sx + 16, 496), radius=12 * S, fill=HAIR)

    # Brows drawn as a MIRRORED pair, dipping slightly towards the nose. The
    # first pass reused Lakshmi's single line for both eyes, which slopes the
    # same way on each side: on a face with no fringe over it that reads as one
    # raised brow and one lowered, and the whole portrait looked angry.
    for ex, outer in ((443, -1), (557, 1)):
        ellipse(d, ex, 496, 17, 20, INK)
        ellipse(d, ex + 6, 489, 5, 6, WHITE)
        # Nearly level, lifting a touch towards the nose. Sloping DOWN towards
        # the nose is the universal drawn signal for anger, and two attempts at
        # this face landed there. He is worried about his daughter, not cross.
        d.line(px(ex + 26 * outer, 461, ex - 26 * outer, 456), fill=HAIR, width=9 * S)

    d.arc(px(478, 508, 522, 562), 20, 160, fill=SKIN_SHADE, width=7 * S)

    # Moustache: a thin stroke under the nose, curving down at the ends. Drawn
    # as a filled chord first time round, which produced a black slab wider than
    # the mouth and sitting on top of the nose.
    # Wide and shallow. A tall narrow arc here reads as a downturned mouth, and
    # with the brows above it the whole face turns into a scowl.
    d.arc(px(444, 566, 556, 606), 200, 340, fill=HAIR, width=13 * S)
    d.arc(px(458, 596, 542, 656), 20, 160, fill=(140, 80, 60), width=9 * S)

    mask = Image.new("L", (W * S, H * S), 0)
    ImageDraw.Draw(mask).ellipse(px(10, 10, 990, 990), fill=255)
    img.putalpha(mask)

    out = Image.new("RGB", (W, H), WHITE)
    small = img.resize((W, H), Image.LANCZOS)
    out.paste(small, (0, 0), small)

    # ── the message, outside the clip ─────────────────────────────────────
    # A chat bubble rather than a progress ring. He is not a user of the app and
    # the portrait should not imply he is.
    layer = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    p = ImageDraw.Draw(layer)
    p.rounded_rectangle(px(646, 646, 856, 966), radius=30 * S,
                        fill=WHITE, outline=BORDER, width=5 * S)
    p.rounded_rectangle(px(672, 674, 830, 722), radius=10 * S, fill=PRIMARY_SOFT)
    # Incoming bubble, left aligned, with a squared corner where the tail sits.
    p.rounded_rectangle(px(672, 748, 812, 836), radius=18 * S, fill=PRIMARY_SOFT)
    p.rectangle(px(672, 812, 692, 836), fill=PRIMARY_SOFT)
    for i, (x0, x1) in enumerate(((690, 796), (690, 776), (690, 800))):
        p.rounded_rectangle(px(x0, 766 + i * 22, x1, 780 + i * 22), radius=7 * S,
                            fill=PRIMARY)
    p.ellipse(px(672, 872, 700, 900), fill=STREAK)
    p.rounded_rectangle(px(714, 878, 830, 896), radius=9 * S, fill=(216, 222, 228))
    p.rounded_rectangle(px(672, 916, 830, 934), radius=9 * S, fill=(216, 222, 228))

    phone = layer.resize((W, H), Image.LANCZOS)
    out.paste(phone, (0, 0), phone)

    path = "docs/deck/persona-suresh.png"
    out.save(path)
    print(f"wrote {path}")


if __name__ == "__main__":
    lakshmi()
    suresh()
