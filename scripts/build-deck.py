#!/usr/bin/env python3
"""
Builds `docs/deck/Dagar-Pitch-Deck.pptx` — the submission deck.

Editable by design: every word on every slide is a real PowerPoint text run, not
a picture of text. Change a number here and re-run, or change it in PowerPoint
and never run this again. Both are fine.

The only two images are `persona-aarav.png` (drawn, see
`gen-persona-illustration.py`) and `architecture.png`.

    python3 scripts/build-deck.py

Every figure on the market slides is sourced on the slide itself. If you edit one,
edit its source too — an unsourced number in front of a judge is a liability.
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# ── brand (saathi-design) ────────────────────────────────────────────────────
PRIMARY = RGBColor(0x0F, 0x76, 0x6E)
PRIMARY_STRONG = RGBColor(0x11, 0x5E, 0x59)
PRIMARY_SOFT = RGBColor(0xCC, 0xFB, 0xF1)
PRIMARY_WASH = RGBColor(0xF0, 0xFD, 0xFA)
INK = RGBColor(0x1A, 0x27, 0x33)
BODY = RGBColor(0x3F, 0x4A, 0x57)
MUTED = RGBColor(0x5B, 0x66, 0x73)
BORDER = RGBColor(0xD8, 0xDE, 0xE4)
SURFACE = RGBColor(0xF1, 0xF5, 0xF4)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
CORRECT = RGBColor(0x15, 0x80, 0x3D)
AMBER = RGBColor(0xB4, 0x53, 0x09)
HINT = RGBColor(0x03, 0x69, 0xA1)
CELEBRATE_BG = RGBColor(0xFF, 0xFB, 0xEB)

# Arial, not Inter. The deck will be opened on a machine that is not this one,
# and a font substitution reflows every slide. Change it once in the slide
# master if you want something warmer.
FONT = "Arial"

APP_URL = "dagar-ap19.vercel.app"
# The repo is still named `saathi` on GitHub and this is deliberately the TRUE
# url, not the aspirational one. A repo link on a slide that 404s in front of a
# judge is worse than an old name. Rename the repo and change this together.
REPO_URL = "github.com/ap9650/saathi"

SW, SH = 13.333, 7.5      # 16:9
M = 0.62                  # side margin
CONTENT_W = SW - 2 * M


# ── primitives ───────────────────────────────────────────────────────────────

def box(slide, x, y, w, h, fill=None, line=None, line_w=1.0, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
        radius=0.06):
    s = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        s.adjustments[0] = radius
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(line_w)
    s.shadow.inherit = False
    return s


def text(slide, x, y, w, h, runs, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    """runs: list of dicts — t, size, bold, color, space_after, line, italic, bullet."""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    for i, r in enumerate(runs):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = r.get("align", align)
        p.space_after = Pt(r.get("space_after", 0))
        p.space_before = Pt(r.get("space_before", 0))
        if r.get("line"):
            p.line_spacing = r["line"]
        run = p.add_run()
        run.text = r["t"]
        f = run.font
        f.name = FONT
        f.size = Pt(r.get("size", 12))
        f.bold = r.get("bold", False)
        f.italic = r.get("italic", False)
        f.color.rgb = r.get("color", BODY)
    return tb


def slide_shell(prs, number, kicker, title, subtitle=None):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    # eyebrow rule
    box(s, M, 0.52, 0.34, 0.055, fill=PRIMARY, shape=MSO_SHAPE.RECTANGLE)
    text(s, M + 0.46, 0.42, 9.0, 0.3,
         [{"t": kicker.upper(), "size": 10.5, "bold": True, "color": PRIMARY,
           "space_after": 0}])
    text(s, M, 0.78, CONTENT_W - 0.4, 0.62,
         [{"t": title, "size": 29, "bold": True, "color": INK, "line": 1.0}])
    y = 1.52
    if subtitle:
        text(s, M, 1.44, CONTENT_W - 0.4, 0.36,
             [{"t": subtitle, "size": 13.5, "color": MUTED, "line": 1.15}])
        # 2.06, not 1.94 — every subtitle here runs to two lines, and 1.94 put
        # the first content row on top of the second line.
        y = 2.06
    # footer
    text(s, M, SH - 0.44, 6.0, 0.24,
         [{"t": f"Dagar  ·  Personalised learning for every underserved learner",
           "size": 8.5, "color": MUTED}])
    text(s, SW - M - 2.0, SH - 0.44, 2.0, 0.24,
         [{"t": str(number), "size": 8.5, "color": MUTED}], align=PP_ALIGN.RIGHT)
    return s, y


def card(slide, x, y, w, h, title, body, accent=PRIMARY, fill=WHITE,
         title_size=13.5, body_size=10.5, badge=None):
    box(slide, x, y, w, h, fill=fill, line=BORDER, line_w=1.0)
    box(slide, x, y + 0.18, 0.045, h - 0.36, fill=accent, shape=MSO_SHAPE.RECTANGLE)
    runs = []
    if badge:
        runs.append({"t": badge.upper(), "size": 8.5, "bold": True, "color": accent,
                     "space_after": 4})
    runs.append({"t": title, "size": title_size, "bold": True, "color": INK,
                 "space_after": 5, "line": 1.05})
    if body:
        runs.append({"t": body, "size": body_size, "color": BODY, "line": 1.22})
    text(slide, x + 0.28, y + 0.2, w - 0.5, h - 0.36, runs)


def stat(slide, x, y, w, h, big, label, sub=None, accent=PRIMARY, fill=PRIMARY_WASH):
    box(slide, x, y, w, h, fill=fill, line=BORDER)
    runs = [{"t": big, "size": 30, "bold": True, "color": accent, "space_after": 3,
             "line": 1.0},
            {"t": label, "size": 11, "bold": True, "color": INK, "space_after": 3,
             "line": 1.15}]
    if sub:
        runs.append({"t": sub, "size": 9.5, "color": MUTED, "line": 1.2})
    text(slide, x + 0.26, y + 0.22, w - 0.5, h - 0.4, runs)


def chip(slide, x, y, w, h, label, fill=PRIMARY_SOFT, color=PRIMARY_STRONG, size=10):
    box(slide, x, y, w, h, fill=fill, line=None, radius=0.35)
    text(slide, x + 0.12, y, w - 0.24, h,
         [{"t": label, "size": size, "bold": True, "color": color}],
         align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


def source_note(slide, y, note):
    text(slide, M, y, CONTENT_W, 0.3,
         [{"t": note, "size": 8.5, "color": MUTED, "line": 1.25}])


def grid(x0, y0, cols, rows, w, h, gx, gy):
    return [(x0 + c * (w + gx), y0 + r * (h + gy)) for r in range(rows) for c in range(cols)]


# ── slides ───────────────────────────────────────────────────────────────────

def cover(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    box(s, 0, 0, SW, SH, fill=PRIMARY_WASH, shape=MSO_SHAPE.RECTANGLE)
    box(s, 0, 0, 0.22, SH, fill=PRIMARY, shape=MSO_SHAPE.RECTANGLE)
    text(s, 1.1, 2.05, 8.6, 1.0,
         [{"t": "Dagar", "size": 62, "bold": True, "color": PRIMARY_STRONG,
           "space_after": 6, "line": 1.0},
          # डगर, the wordmark the app itself carries. "साथी · companion" was the
          # old name's gloss and survived the rename here — a cover slide
          # glossing the wrong word is the one place nobody would think to look.
          {"t": "डगर  ·  the trail you walk", "size": 15, "color": PRIMARY,
           "space_after": 0}])
    box(s, 1.12, 3.62, 1.4, 0.05, fill=PRIMARY, shape=MSO_SHAPE.RECTANGLE)
    text(s, 1.1, 3.95, 9.2, 1.2,
         [{"t": "Personalised learning for every underserved learner.",
           "size": 22, "bold": True, "color": INK, "space_after": 10, "line": 1.2},
          {"t": "An AI learning companion that knows exactly what a learner is "
                "studying, where they are stuck, and how to help without handing "
                "over the answer.",
           "size": 13, "color": BODY, "line": 1.35}])
    text(s, 1.1, SH - 1.15, 10.0, 0.7,
         [{"t": "Live product  ·  " + APP_URL, "size": 11.5, "bold": True,
           "color": PRIMARY_STRONG, "space_after": 4},
          {"t": "Buildathon MVP  ·  August 2026  ·  Built by Akriti Panwar",
           "size": 10, "color": MUTED}])


def s1_problem(prs):
    s, y = slide_shell(prs, 1, "01 · Problem",
                       "Enrolment was solved. Learning was not.")
    cards = [
        ("Children move up a grade without mastering the last one",
         "India put 248 million children in school. It did not put a tutor beside "
         "each one. Overcrowded classrooms mean a doubt raised on Monday is still "
         "a doubt in December — and Class 8 is built on Class 6.", AMBER),
        ("Help exists, but it is priced out of reach",
         "Private tuition is the default answer to falling behind, and it costs "
         "more than the families who need it most can pay. The learner who most "
         "needs personalised support is the one who structurally cannot buy it.", AMBER),
        ("Parents want to help and have nothing to work with",
         "They lack the time, the subject knowledge, and any visibility beyond an "
         "exam mark that arrives months too late. Wanting to support a child is "
         "not the same as being able to.", HINT),
        ("The learners furthest from support are overlooked first",
         "Economically disadvantaged, disabled and neurodiverse learners are the "
         "ones a stretched system drops first — and the ones no product is "
         "designed around.", HINT),
    ]
    w, h, gx, gy = 5.98, 1.68, 0.22, 0.2
    for (cx, cy), (t, b, a) in zip(grid(M, y, 2, 2, w, h, gx, gy), cards):
        card(s, cx, cy, w, h, t, b, accent=a)

    yb = y + 2 * h + gy + 0.22
    box(s, M, yb, CONTENT_W, 0.86, fill=PRIMARY_WASH, line=PRIMARY_SOFT)
    text(s, M + 0.34, yb + 0.14, CONTENT_W - 0.68, 0.6,
         [{"t": "Existing products each solve one fragment.", "size": 12.5,
           "bold": True, "color": PRIMARY_STRONG, "space_after": 4},
          {"t": "Video platforms deliver content but cannot personalise teaching.  "
                "Generic AI assistants answer questions but do not know the "
                "learner's curriculum or history.  Practice apps assess without "
                "adapting instruction.  Tutoring personalises but does not scale. "
                "Nobody joins them up.",
           "size": 10.5, "color": BODY, "line": 1.25}])
    source_note(s, SH - 0.78, "Source: PRD §2 — Problem Statement. Enrolment figure: UDISE+ 2023-24.")


def s2_solution(prs):
    s, y = slide_shell(prs, 2, "02 · Solution",
                       "A companion that knows what you are learning.",
                       "Dagar is not a chatbot with a syllabus attached. It is a "
                       "curriculum-aware learning journey — and the AI is grounded "
                       "in the exact lesson on the learner's screen.")

    steps = ["Chapter", "Micro-lesson", "AI Tutor", "Guided practice",
             "Chapter quiz", "Mastery + insights"]
    cw, gap = 1.92, 0.16
    for i, label in enumerate(steps):
        x = M + i * (cw + gap)
        box(s, x, y, cw, 0.66, fill=PRIMARY if i < 3 else PRIMARY_SOFT,
            line=None, radius=0.16)
        text(s, x + 0.1, y, cw - 0.2, 0.66,
             [{"t": label, "size": 11, "bold": True,
               "color": WHITE if i < 3 else PRIMARY_STRONG}],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        if i < len(steps) - 1:
            text(s, x + cw, y, gap, 0.66,
                 [{"t": "›", "size": 15, "bold": True, "color": MUTED}],
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

    y2 = y + 1.02
    # (title, body, accent, badge, fill). The last card USED to claim the learner
    # "is offered a real person" — see D8a. No session happens, so the claim is
    # now the measurement it always was, badged and tinted so the difference
    # survives a five-second skim.
    cards = [
        ("Grounded, not generic",
         "Every tutor call carries the current lesson's text and that learner's "
         "concept mastery. It teaches inside the curriculum, and it hints before "
         "it answers — a learner handed the answer has learned nothing.",
         PRIMARY, None, WHITE),
        ("Adapts to the concept, not the score",
         "Mastery is tracked per concept, not per chapter. Practice difficulty "
         "steps up and down on performance, and the next lesson is recommended "
         "from what is actually weak.", PRIMARY, None, WHITE),
        ("Hindi from day one",
         "Full UI, curriculum content and AI tutor in Hindi and English. For a "
         "Hindi-medium learner, language is not a feature — it is the front door. "
         "Personalisation is worthless to someone who cannot read the lesson.",
         CORRECT, None, WHITE),
        ("A parent loop that needs no parent",
         "A weekly summary reaches a supporting adult through a link — no account, "
         "no app, no login. Because the adult who checks may be a grandmother, an "
         "older sister, or a teacher.", HINT, None, WHITE),
        ("Built to keep someone coming back",
         "A closable daily goal, a streak with a grace day, milestones. No hearts, "
         "no leaderboards, no guilt — mechanics that punish invert badly for a "
         "learner who is already behind.", HINT, None, WHITE),
        ("We measure where AI is not enough",
         "Repeated struggle is detected and the learner is asked whether they want "
         "a person. No session happens yet, the app says so plainly, and the ask is "
         "recorded — so supply is sized on evidence, not promised ahead of it.",
         AMBER, "not built · demand test", SURFACE),
    ]
    w, h, gx, gy = 3.897, 1.56, 0.2, 0.2
    for (cx, cy), (t, b, a, bg, fl) in zip(grid(M, y2, 3, 2, w, h, gx, gy), cards):
        card(s, cx, cy, w, h, t, b, accent=a, fill=fl, badge=bg,
             title_size=12.5, body_size=9.8)


def s3_validation(prs):
    s, y = slide_shell(prs, 3, "03 · Market validation",
                       "The phone is already in their hand.",
                       "The access problem is close to solved. The reason-to-open-it "
                       "problem is wide open — and that is the one Dagar is built for.")

    sw = (CONTENT_W - 0.4) / 3
    stat(s, M, y, sw, 1.72, "~90%",
         "of rural households with a child aged 14–16 own a smartphone",
         "Device access is no longer the binding constraint.", accent=CORRECT,
         fill=RGBColor(0xDC, 0xFC, 0xE7))
    stat(s, M + sw + 0.2, y, sw, 1.72, "57%",
         "of those children used one for anything educational last week",
         "76% used one for social media in the same week.", accent=AMBER,
         fill=RGBColor(0xFE, 0xF3, 0xC7))
    stat(s, M + 2 * (sw + 0.2), y, sw, 1.72, "248M",
         "students enrolled in Classes 1–12 — and the number is falling",
         "26.4 crore average (2018–22) → 24.8 crore (2023-24).", accent=PRIMARY,
         fill=PRIMARY_WASH)

    y2 = y + 1.92
    box(s, M, y2, CONTENT_W, 1.02, fill=PRIMARY_WASH, line=PRIMARY_SOFT)
    text(s, M + 0.34, y2 + 0.16, CONTENT_W - 0.68, 0.8,
         [{"t": "The 33-point gap is the product thesis.", "size": 13.5,
           "bold": True, "color": PRIMARY_STRONG, "space_after": 5},
          {"t": "Nine in ten of these children can reach a learning app; barely "
                "half open one. Distribution here is not a hardware problem, it is "
                "a habit problem — which is why the daily goal, the streak and the "
                "weekly parent summary are MVP scope and not Phase 3 polish.",
           "size": 11, "color": BODY, "line": 1.28}])

    y3 = y2 + 1.22
    rows = [
        ("A buyer already exists, and it is mandated",
         "Section 135 of the Companies Act requires qualifying companies to spend "
         "2% of net profit on CSR. Education is the most-funded category. A "
         "per-learner programme is exactly the shape CSR budgets buy.", PRIMARY),
        ("Learning outcomes lag enrolment, persistently",
         "Foundational gaps compound: a learner who misses equivalent fractions in "
         "Class 6 fails algebra in Class 8 for a reason nobody diagnoses. Hence "
         "concept mastery as the unit, not syllabus completion.", HINT),
    ]
    w, h, gx = (CONTENT_W - 0.2) / 2, 1.24, 0.2
    for (cx, cy), (t, b, a) in zip(grid(M, y3, 2, 1, w, h, gx, 0), rows):
        card(s, cx, cy, w, h, t, b, accent=a, title_size=12, body_size=9.8)

    source_note(s, SH - 0.9,
                "Sources: ASER 2024 (National findings, rural, ages 14–16) · UDISE+ 2023-24 · "
                "Companies Act 2013, §135. Full derivation in docs/MARKET_AND_PRICING.md.")


def s4_market_size(prs):
    s, y = slide_shell(prs, 4, "04 · Market size",
                       "₹1,500 Cr serviceable. 250,000 learners is the honest goal.",
                       "India only. ₹85 = $1. These are derived estimates from public "
                       "data, not commissioned research — every input and its "
                       "confidence level is published with the model.")

    # Bar widths are proportional-ish, but CAPPED at 6.6 so the note beside them
    # always has a column to live in. An unbounded TAM bar squeezed its own
    # caption into a two-character-wide sliver.
    bands = [
        ("TAM", "~248M learners", "₹12,400 Cr  (~$1.46B)",
         "Every school-going learner in India, Classes 1–12, at a ₹500/learner/year "
         "blended ARPU ceiling.", PRIMARY_STRONG, 6.6),
        ("SAM", "~30M learners", "₹1,500 Cr  (~$176M)",
         "Classes 6–8 (~65M)  ×  ~62% on NCERT or NCERT-aligned state curricula  "
         "×  ~75% with usable household smartphone access.", PRIMARY, 5.2),
        ("SOM", "~250,000 learners", "₹10–11 Cr  (~$1.25M ARR)",
         "Year 3, via 15–25 NGO/CSR partners (~150k), 2–3 district government "
         "pilots (~75k) and organic word of mouth (~25k). ≈0.8% of SAM.", HINT, 3.9),
    ]
    yy = y
    for tag, learners, value, note, colour, width in bands:
        box(s, M, yy, CONTENT_W, 1.06, fill=SURFACE, line=BORDER)
        box(s, M, yy, width, 1.06, fill=colour, line=None, radius=0.1)
        text(s, M + 0.28, yy + 0.14, 1.2, 0.78,
             [{"t": tag, "size": 16, "bold": True, "color": WHITE}])
        text(s, M + 1.42, yy + 0.14, 3.6, 0.78,
             [{"t": learners, "size": 16, "bold": True, "color": WHITE,
               "space_after": 2},
              {"t": value, "size": 10.5, "color": PRIMARY_SOFT}])
        text(s, M + 6.86, yy + 0.16, CONTENT_W - 7.14, 0.74,
             [{"t": note, "size": 10, "color": BODY, "line": 1.3}],
             anchor=MSO_ANCHOR.MIDDLE)
        yy += 1.2

    y2 = yy + 0.1
    bw = (CONTENT_W - 0.2) / 2
    box(s, M, y2, bw, 1.12, fill=RGBColor(0xFE, 0xF3, 0xC7), line=RGBColor(0xF5, 0xD9, 0x8A))
    text(s, M + 0.3, y2 + 0.16, bw - 0.6, 0.86,
         [{"t": "The weakest input, named rather than buried", "size": 11.5,
           "bold": True, "color": AMBER, "space_after": 4},
          {"t": "NCERT alignment at 62% is the least certain number in the model "
                "and swings SAM by roughly ±10 million learners. Verifying state-board "
                "textbook adoption is the first research task, not a footnote.",
           "size": 9.8, "color": BODY, "line": 1.26}])

    box(s, M + bw + 0.2, y2, bw, 1.12, fill=PRIMARY_WASH, line=PRIMARY_SOFT)
    text(s, M + bw + 0.5, y2 + 0.16, bw - 0.6, 0.86,
         [{"t": "For a social-impact product, learners reached is the headline",
           "size": 11.5, "bold": True, "color": PRIMARY_STRONG, "space_after": 4},
          {"t": "Revenue is the sustainability constraint, not the goal. We lead "
                "with 250,000 learners and treat ₹10.6 Cr as what it costs to keep "
                "serving them.",
           "size": 9.8, "color": BODY, "line": 1.26}])


def s5_persona(prs):
    s, y = slide_shell(prs, 5, "05 · Primary persona (MVP)",
                       "Aarav, 13. He is not bad at maths.")

    s.shapes.add_picture("docs/deck/persona-aarav.png", Inches(M), Inches(y + 0.02),
                         height=Inches(3.3))
    facts = [("Age", "13"), ("Class", "7, government school"),
             ("Curriculum", "NCERT Mathematics"), ("Device", "his mother's Android"),
             ("Language", "Hindi at home, English textbook")]
    yy = y + 3.5
    for i, (k, v) in enumerate(facts):
        text(s, M + 0.02, yy + i * 0.23, 3.5, 0.22,
             [{"t": f"{k}   {v}", "size": 9.5, "color": MUTED}])

    x = M + 3.9
    w = SW - x - M
    text(s, x, y + 0.02, w, 3.4,
         [{"t": "He is three weeks behind, and nobody noticed which three weeks.",
           "size": 15, "bold": True, "color": INK, "space_after": 11, "line": 1.2},
          {"t": "The phone is his mother's. He gets it after dinner, sometimes, and "
                "there is one charger for the house.",
           "size": 11.5, "color": BODY, "space_after": 8, "line": 1.35},
          {"t": "When he puts his hand up in class, thirty-eight other children are "
                "also waiting. So mostly he does not put his hand up.",
           "size": 11.5, "color": BODY, "space_after": 8, "line": 1.35},
          {"t": "He has tried YouTube. YouTube is excellent and does not know that "
                "he never really got equivalent fractions, so it keeps explaining "
                "the wrong thing beautifully.",
           "size": 11.5, "color": BODY, "space_after": 8, "line": 1.35},
          {"t": "He has asked a chatbot too. It gave him the answer immediately. He "
                "copied it down, felt briefly clever, and could not do the next "
                "question either.",
           "size": 11.5, "color": BODY, "space_after": 8, "line": 1.35},
          {"t": "His mother asks how school is going. He says fine. It is the only "
                "answer he has, because nobody has ever shown either of them what "
                "he actually does and does not understand.",
           "size": 11.5, "color": BODY, "line": 1.35}])

    needs = [("Someone who knows where he is", PRIMARY),
             ("Hints, not answers", PRIMARY),
             ("To feel like he is winning at something", CORRECT),
             ("Someone to notice", HINT)]
    yy2 = y + 3.46
    text(s, x, yy2, w, 0.26,
         [{"t": "WHAT HE ACTUALLY NEEDS", "size": 9, "bold": True, "color": PRIMARY}])
    cw = (w - 0.36) / 4
    for i, (label, colour) in enumerate(needs):
        chip(s, x + i * (cw + 0.12), yy2 + 0.32, cw, 0.5, label,
             fill=PRIMARY_WASH, color=colour, size=9)

    source_note(s, SH - 0.9,
                "Composite persona from PRD §5. Illustrated rather than photographed — "
                "Aarav is a representative learner, not a real child.")


def s6_features(prs):
    s, y = slide_shell(prs, 6, "06 · Features",
                       "Seven features. And one we chose not to fake.",
                       "The first seven are live at " + APP_URL +
                       " — NCERT Mathematics, Classes 6–8, one chapter per grade, "
                       "in Hindi and English. The eighth card is not a feature, and "
                       "the app says so too.")
    # (title, body, accent, badge, fill). The last card is deliberately NOT a
    # feature — see D8a. It carries a badge and a tinted fill so it cannot be
    # skim-read as one, and the slide title names it before anyone reaches it.
    feats = [
        ("Curriculum dashboard", "Grade, chapters, lessons as a visible journey "
         "path, with a recommended next lesson and a closable daily goal.",
         PRIMARY, None, WHITE),
        ("Micro-lessons", "One concept at a time, in the learner's language, with "
         "KaTeX-rendered maths and worked examples.", PRIMARY, None, WHITE),
        ("AI Tutor", "Claude Sonnet 5, grounded in the current lesson text and the "
         "learner's concept mastery. Streams, hints first, refuses off-curriculum.",
         PRIMARY, None, WHITE),
        ("Guided practice", "Adaptive difficulty, instant deterministic grading, a "
         "hint ladder from nudge to worked solution.", PRIMARY, None, WHITE),
        ("Chapter quiz", "Mastery per concept, order varied per attempt, revision "
         "recommended from what was actually missed.", HINT, None, WHITE),
        ("Progress, streaks, milestones", "Personal progress only. No ranks, no "
         "leaderboards, no lives — a grace day so one bad evening costs nothing.",
         HINT, None, WHITE),
        ("Parent companion", "A weekly summary a supporting adult reads without an "
         "account. Tutor conversations are never in it.", CORRECT, None, WHITE),
        ("A human mentor", "No session happens. The app tells the learner that, and "
         "records the ask — so we size real demand before promising supply we do "
         "not have.", AMBER, "not built · demand test", SURFACE),
    ]
    w, h, gx, gy = 2.96, 1.72, 0.2, 0.2
    for (cx, cy), (t, b, a, bg, fl) in zip(grid(M, y, 4, 2, w, h, gx, gy), feats):
        card(s, cx, cy, w, h, t, b, accent=a, fill=fl, badge=bg,
             title_size=12, body_size=9.6)

    yb = y + 2 * h + gy + 0.2
    box(s, M, yb, CONTENT_W, 0.62, fill=PRIMARY_WASH, line=PRIMARY_SOFT)
    text(s, M + 0.3, yb, CONTENT_W - 0.6, 0.62,
         [{"t": "Also shipped, because they are not optional for this audience:   "
                "WCAG 2.1 AA throughout  ·  full keyboard navigation  ·  44px touch "
                "targets  ·  prefers-reduced-motion honoured  ·  installable PWA, "
                "no app store required  ·  designed at 360px first",
           "size": 10, "color": PRIMARY_STRONG}], anchor=MSO_ANCHOR.MIDDLE)


def s6b_screens(prs):
    """The product, photographed.

    Six slides describe this app and, until now, none of them showed it. A judge
    reading "guided practice with pictorial input" has to take our word for it.
    These are real screenshots of the real thing at 360px — captured by driving
    the app with `npm run deck:shots`, not composited in a design tool, so a
    screen that breaks cannot quietly keep looking good on this slide.
    """
    s, y = slide_shell(prs, 7, "07 · The product",
                       "What it actually looks like, on the phone it is used on.",
                       "Every screen below is a real screenshot at 360px — the width of the "
                       "shared Android phone this was designed for. Nothing here is a mockup.")

    screens = [
        ("dashboard-en", "A journey, not a list",
         "Streak, one closable daily goal, and a path with a visible “you are here”."),
        ("lesson-step", "One idea per step",
         "Eight steps, a diagram for each, read aloud on request. The tutor is one tap away."),
        ("practice-choiceviz", "Answer with a picture",
         "No keyboard. Distractors are real misconceptions, not random wrong numbers."),
        # Titles are kept under ~24 characters. The caption column is 1.7" wide,
        # so a longer one wraps to a second line, pushes its body down, and runs
        # into the source note at the foot of the slide.
        ("practice-balance", "The diagram asks",
         "Class 8 meets equations as a balance before it meets them as algebra."),
        ("dashboard-hi", "Hindi is not a Phase 2",
         "Every screen, both languages, from day one — including the maths."),
    ]

    # 1080×2280 screenshots — a 0.4737 aspect. Height first, then width from it,
    # so five phones and their captions fit the slide without cropping.
    ph = 3.62
    pw = ph * 0.4737
    gap = (CONTENT_W - 5 * pw) / 4

    for i, (name, title, body) in enumerate(screens):
        x = M + i * (pw + gap)
        # A hairline frame: without it a white app screen dissolves into a white
        # slide and the phone stops reading as a phone.
        box(s, x - 0.045, y - 0.045, pw + 0.09, ph + 0.09, fill=None, line=BORDER, line_w=1.0,
            radius=0.05)
        s.shapes.add_picture(f"docs/deck/screens/{name}.png", Inches(x), Inches(y),
                             height=Inches(ph))
        text(s, x, y + ph + 0.16, pw, 0.9,
             [{"t": title, "size": 11.5, "bold": True, "color": INK, "space_after": 4,
               "line": 1.1},
              {"t": body, "size": 9.2, "color": BODY, "line": 1.22}])

    source_note(s, SH - 0.74,
                "Captured from the running app by `npm run deck:shots`, which signs in and "
                "walks to each screen — so these cannot drift from what ships.")


def s7_how(prs):
    s, y = slide_shell(prs, 8, "08 · How we built it",
                       "Four days. Every constraint met as a decision.")

    # The stack gets its own full-width strip so the architecture diagram and the
    # trade-off cards can share the remaining height without either one landing
    # on top of the other.
    box(s, M, y, CONTENT_W, 0.66, fill=SURFACE, line=BORDER)
    text(s, M + 0.28, y, 1.0, 0.66,
         [{"t": "STACK", "size": 9, "bold": True, "color": PRIMARY}],
         anchor=MSO_ANCHOR.MIDDLE)
    text(s, M + 1.2, y, CONTENT_W - 1.5, 0.66,
         [{"t": "Next.js 16 App Router (TypeScript), installable PWA on Vercel  ·  "
                "Supabase Postgres, row-level security on every table  ·  Claude "
                "Sonnet 5 for tutoring and hints, Haiku 4.5 for batch  ·  KaTeX  ·  "
                "Twilio WhatsApp behind a channel-agnostic adapter",
           "size": 9.8, "color": BODY, "line": 1.25}], anchor=MSO_ANCHOR.MIDDLE)

    y0 = y + 0.84
    arch_w = 6.13                       # 1800×1180 → 4.02" tall, matches the cards
    s.shapes.add_picture("docs/architecture.png", Inches(M), Inches(y0),
                         width=Inches(arch_w))

    x = M + arch_w + 0.22
    w = SW - x - M
    tradeoffs = [
        ("Grading is code, never AI",
         "A model asked \"is this correct?\" is wrong occasionally and silently, and "
         "the cost lands on a child who was right. Deterministic grading treats 1/2, "
         "2/4 and 0.5 as one answer. AI writes hints and explanations only."),
        ("Answer keys never reach the browser",
         "Learners read a view with no answer column; grading happens server-side. "
         "Three files in the whole repo may read the base table, and a test fails if "
         "that list grows."),
        ("The parent link needs no parent account",
         "Requiring a login from the adult would have excluded the grandmother, the "
         "older sister and the teacher — often the adult who actually checks."),
    ]
    yy = y0
    for t, b in tradeoffs:
        card(s, x, yy, w, 1.26, t, b, accent=PRIMARY, title_size=11.5, body_size=9.4)
        yy += 1.38

    yb = y0 + 4.12
    box(s, M, yb, CONTENT_W, 0.5, fill=PRIMARY, line=None)
    text(s, M + 0.3, yb, CONTENT_W - 4.6, 0.5,
         [{"t": "The full build story — architecture, the trade-offs made under a "
                "four-day clock, and everything left in the backlog with its reason "
                "— is the accompanying PDF.",
           "size": 10.5, "bold": True, "color": WHITE}], anchor=MSO_ANCHOR.MIDDLE)
    text(s, SW - M - 4.2, yb, 3.9, 0.5,
         [{"t": REPO_URL, "size": 10.5, "bold": True, "color": PRIMARY_SOFT}],
         align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)


def s8_next(prs):
    s, y = slide_shell(prs, 9, "09 · Next",
                       "The next 1–2 months, if the feedback says go.",
                       "Ordered by what real users have already told us, not by what "
                       "is fun to build. The first three came out of testing this week.")
    items = [
        ("01", "Widen the question bank",
         "A tester retook a quiz and got the same eight questions — because there "
         "are only eight per chapter. Order now varies per attempt; the real fix is "
         "16 per chapter. ~6 hours, most of it verifying answer keys.", AMBER),
        ("02", "Teach on a rounded decimal instead of failing it",
         "Grading demands six decimal places on a recurring answer, so 5/12 as 0.42 "
         "is marked wrong. It should say \"very close — write it as a fraction\". "
         "Correct arithmetic, useless pedagogy.", AMBER),
        ("03", "Make the adaptive ladder visible",
         "Practice already steps difficulty up and down. The learner cannot see it. "
         "\"Nice — let's try a harder one\" on the way up, and silence on the way "
         "down, so nobody is told they are failing.", PRIMARY),
        ("04", "Let an adult see the practice",
         "Questions attempted and what the learner answered. Deferred on purpose: "
         "showing the correct answer beside it needs a server-assembled payload, "
         "not a new permission on the answer key.", PRIMARY),
        ("05", "WhatsApp off the sandbox",
         "The Twilio sandbox expires a parent's session after three days and cannot "
         "carry a weekly template. Moving to WhatsApp Business is Meta verification "
         "— paperwork, not engineering. The adapter is already written.", HINT),
        ("06", "A tutor eval set with an LLM judge",
         "20–30 real learner questions with a rubric. Until it exists, every prompt "
         "edit is an untested deploy — and the tutor is the differentiator.", HINT),
        ("07", "Hindi authored natively, not translated",
         "Today the Hindi is translated from English. A Hindi-medium learner "
         "deserves lessons written in Hindi, in the register a 12-year-old actually "
         "speaks.", CORRECT),
        ("08", "A cohort dashboard",
         "The unlock for the first NGO conversation. They will not buy a product "
         "they cannot report on.", CORRECT),
    ]
    w, h, gx, gy = (CONTENT_W - 0.6) / 4, 2.04, 0.2, 0.2
    for (cx, cy), (n, t, b, a) in zip(grid(M, y, 4, 2, w, h, gx, gy), items):
        card(s, cx, cy, w, h, t, b, accent=a, title_size=11.5, body_size=9.2, badge=n)


def s9_roadmap(prs):
    s, y = slide_shell(prs, 10, "10 · Roadmap",
                       "One subject proves it. The rest is authoring.",
                       "Curriculum is data — chapters, concepts, lessons and questions "
                       "are rows, not code. Adding a subject is authoring, not "
                       "rebuilding. That is a fact about the schema, not a promise.")
    phases = [
        ("Phase 1 — now", "Validate the core loop",
         "NCERT Mathematics, Classes 6–8  ·  AI Tutor  ·  guided practice  ·  chapter "
         "quiz  ·  progress and streaks  ·  parent summary  ·  Hindi and English  ·  "
         "a demand test for human mentoring, which is measured and not yet built.   "
         "Free, deliberately — no pricing experiment runs until H1–H7 have data.",
         PRIMARY),
        ("Phase 2 — expansion", "Widen subjects, languages and stakeholders",
         "Science and other subjects  ·  more grades  ·  Marathi, Tamil and Bengali "
         "(the storage model already supports them)  ·  adaptive learning paths  ·  "
         "teacher dashboard  ·  NGO cohort dashboard  ·  first paid CSR pilots.", HINT),
        ("Phase 3 — inclusive platform", "The part of the vision the MVP could not reach",
         "Learners with visual, hearing and speech impairments  ·  neurodiverse "
         "learners (ADHD, dyslexia)  ·  voice-first learning  ·  offline learning  ·  "
         "AI-powered accessibility  ·  a verified mentor network.", CORRECT),
    ]
    w, gx = (CONTENT_W - 0.4) / 3, 0.2
    for i, (t, sub, b, a) in enumerate(phases):
        x = M + i * (w + gx)
        box(s, x, y, w, 2.24, fill=WHITE, line=BORDER)
        box(s, x, y, w, 0.09, fill=a, line=None, shape=MSO_SHAPE.RECTANGLE)
        text(s, x + 0.26, y + 0.28, w - 0.52, 1.86,
             [{"t": t, "size": 14, "bold": True, "color": INK, "space_after": 3},
              {"t": sub, "size": 10, "bold": True, "color": a, "space_after": 9},
              {"t": b, "size": 9.8, "color": BODY, "line": 1.32}])

    y2 = y + 2.46
    box(s, M, y2, CONTENT_W, 1.42, fill=PRIMARY_WASH, line=PRIMARY_SOFT)
    text(s, M + 0.32, y2 + 0.2, CONTENT_W - 0.64, 0.4,
         [{"t": "WHO DAGAR IS FOR NEXT", "size": 9.5, "bold": True, "color": PRIMARY}])
    groups = [
        ("Learners", "Students with visual, hearing or speech impairments  ·  "
                     "neurodiverse learners  ·  adult literacy learners"),
        ("Institutions", "Teachers  ·  government schools  ·  NGOs  ·  CSR education "
                         "programmes  ·  volunteer mentors"),
    ]
    for i, (k, v) in enumerate(groups):
        x = M + 0.32 + i * 6.0
        text(s, x, y2 + 0.6, 5.7, 0.7,
             [{"t": k, "size": 11.5, "bold": True, "color": PRIMARY_STRONG,
               "space_after": 4},
              {"t": v, "size": 10, "color": BODY, "line": 1.3}])


def s10_adoption(prs):
    s, y = slide_shell(prs, 11, "11 · Adoption",
                       "Reach learners through the adults who already have them.",
                       "Paid consumer acquisition contradicts the targeting: you "
                       "cannot buy your way to users selected for being unable to pay. "
                       "So distribution runs through people who already hold a cohort.")

    left = [
        ("Teachers are the highest-leverage channel",
         "One teacher forwards a link to forty students in a single message. No app "
         "store, no install, no cost — Dagar is an installable web link. This is "
         "how the first testers were reached, and it is the lowest-CAC route in the "
         "model by an order of magnitude."),
        ("Families and word of mouth",
         "An older sibling shows a younger one. A parent sends it to the WhatsApp "
         "group. Small, slow, real, and free — modelled at ~25,000 learners by Year 3 "
         "with zero acquisition spend."),
    ]
    right = [
        ("NGOs and CSR programmes — the volume",
         "15–25 partner organisations at 6–10k learners each, ~150,000 by Year 3. "
         "They already run after-school education programmes and already report on "
         "them. Section 135 makes the budget mandatory; the cohort dashboard makes "
         "it buyable."),
        ("Government school pilots",
         "2–3 district-level pilots, ~75,000 learners. NCERT alignment is what makes "
         "this conversation possible at all — the content is the curriculum they "
         "already teach, not a parallel one."),
    ]
    w, h, gx, gy = (CONTENT_W - 0.2) / 2, 1.44, 0.2, 0.18
    text(s, M, y, w, 0.26,
         [{"t": "B2C  ·  DIRECT, UNPAID", "size": 9.5, "bold": True, "color": PRIMARY}])
    text(s, M + w + gx, y, w, 0.26,
         [{"t": "INSTITUTIONAL  ·  WHERE THE VOLUME IS", "size": 9.5, "bold": True,
           "color": HINT}])
    for i, (t, b) in enumerate(left):
        card(s, M, y + 0.36 + i * (h + gy), w, h, t, b, accent=PRIMARY,
             title_size=12, body_size=9.6)
    for i, (t, b) in enumerate(right):
        card(s, M + w + gx, y + 0.36 + i * (h + gy), w, h, t, b, accent=HINT,
             title_size=12, body_size=9.6)

    yb = y + 0.36 + 2 * h + gy + 0.22
    box(s, M, yb, CONTENT_W, 0.92, fill=PRIMARY_WASH, line=PRIMARY_SOFT)
    text(s, M + 0.32, yb + 0.16, CONTENT_W - 0.64, 0.66,
         [{"t": "What removes the friction, on every channel", "size": 11.5,
           "bold": True, "color": PRIMARY_STRONG, "space_after": 4},
          {"t": "It is a link, not an app store listing — installable, but nothing "
                "to download first.  ·  Google Sign-In, because a shared Android "
                "phone is already signed in.  ·  Hindi, so the front door is not "
                "English.  ·  The parent summary needs no parent account, so an "
                "adult can be reached without onboarding them.",
           "size": 10, "color": BODY, "line": 1.28}])


def s11_competitors(prs):
    s, y = slide_shell(prs, 12, "12 · Competition",
                       "Everyone solves a fragment. The gap is joining them up.")
    rows = [
        ("Video platforms", "YouTube, Khan Academy",
         "Excellent content, genuinely free. But it cannot know that this learner "
         "never got equivalent fractions, so it explains the wrong thing well.",
         "No model of the individual learner"),
        ("Generic AI assistants", "ChatGPT, Gemini",
         "Strong at maths, and increasingly free. They do not know the learner's "
         "chapter, history or gaps — and they hand over the answer on request.",
         "No curriculum, no memory, answers first"),
        ("Answer-scanning apps", "Photomath, Doubtnut",
         "Photograph the question, receive the solution. Fast, and it removes the "
         "productive struggle that learning actually consists of.",
         "Solves the homework, not the learner"),
        ("Premium edtech", "BYJU'S, Unacademy, Physics Wallah",
         "Real personalisation and real teaching, sold at a price point and through "
         "a sales motion built for families who can already afford tuition.",
         "Priced for families who can pay"),
        ("Government platforms", "DIKSHA, e-Pathshala",
         "NCERT-aligned, free, at national scale. Built as content repositories — "
         "no adaptive tutor, no mastery model, no habit loop.",
         "Content, not a companion"),
    ]
    hh = 0.72
    box(s, M, y, CONTENT_W, 0.42, fill=SURFACE, line=BORDER)
    for label, cx, cw in [("Category", M + 0.26, 2.2), ("Who", M + 2.5, 2.1),
                          ("What they do well, and where it stops", M + 4.7, 5.0),
                          ("The gap", M + 9.8, 2.3)]:
        text(s, cx, y, cw, 0.42,
             [{"t": label.upper(), "size": 8.8, "bold": True, "color": MUTED}],
             anchor=MSO_ANCHOR.MIDDLE)
    yy = y + 0.42
    for i, (cat, who, does, gap) in enumerate(rows):
        box(s, M, yy, CONTENT_W, hh, fill=WHITE if i % 2 else PRIMARY_WASH, line=BORDER)
        text(s, M + 0.26, yy, 2.2, hh,
             [{"t": cat, "size": 10.5, "bold": True, "color": INK}], anchor=MSO_ANCHOR.MIDDLE)
        text(s, M + 2.5, yy, 2.1, hh,
             [{"t": who, "size": 9.5, "color": MUTED}], anchor=MSO_ANCHOR.MIDDLE)
        text(s, M + 4.7, yy + 0.08, 5.0, hh - 0.16,
             [{"t": does, "size": 9.3, "color": BODY, "line": 1.22}], anchor=MSO_ANCHOR.MIDDLE)
        text(s, M + 9.8, yy, 2.3, hh,
             [{"t": gap, "size": 9.3, "bold": True, "color": AMBER, "line": 1.2}],
             anchor=MSO_ANCHOR.MIDDLE)
        yy += hh

    yb = yy + 0.2
    box(s, M, yb, CONTENT_W, 1.0, fill=PRIMARY, line=None)
    text(s, M + 0.32, yb + 0.14, CONTENT_W - 0.64, 0.76,
         [{"t": "Dagar's position:  curriculum-aware, mastery-driven, hints before "
                "answers, Hindi from day one, free at the core.",
           "size": 12.5, "bold": True, "color": WHITE, "space_after": 5},
          {"t": "The defensible piece is not the model — anyone can call the same "
                "API. It is the learner state that grounds every call: which concept "
                "is weak, what was answered wrong last week, which lesson is open "
                "right now. That compounds with use and does not transfer.",
           "size": 10, "color": PRIMARY_SOFT, "line": 1.28}])


def s12_pricing(prs):
    s, y = slide_shell(prs, 13, "13 · Pricing",
                       "Learners never pay for the core. Institutions pay for reach.",
                       "The MVP is free, deliberately — a pricing experiment now would "
                       "contaminate the activation and retention numbers that decide "
                       "whether the product works at all. Free is a stage, not a "
                       "missing model.")
    tiers = [
        ("Dagar Free", "₹0", "Full curriculum, micro-lessons, practice, quizzes, "
         "progress, streaks, milestones and parent summaries. AI Tutor capped at 10 "
         "questions/day.", PRIMARY, "THE MISSION TIER"),
        ("Dagar Plus", "₹99/mo  ·  ₹799/yr", "Unlimited AI Tutor, deeper adaptive "
         "practice, revision plans, detailed parent insights.", HINT, "FAMILIES PAY FOR DEPTH"),
        ("Dagar Mentor", "+₹299/mo", "Adds two human mentor sessions a month. Gated "
         "on verified mentor supply — never sold ahead of capacity.", AMBER, "SUPPLY-GATED"),
        ("Dagar for Institutions", "₹450–600 / learner / yr", "NGO, CSR and government "
         "licences. Cohort dashboards, reporting, bulk onboarding.", CORRECT,
         "THE REVENUE ENGINE"),
    ]
    w, gx = (CONTENT_W - 0.6) / 4, 0.2
    for i, (t, price, b, a, badge) in enumerate(tiers):
        x = M + i * (w + gx)
        box(s, x, y, w, 2.16, fill=WHITE, line=BORDER)
        box(s, x, y, w, 0.09, fill=a, line=None, shape=MSO_SHAPE.RECTANGLE)
        text(s, x + 0.24, y + 0.26, w - 0.48, 1.9,
             [{"t": badge, "size": 8, "bold": True, "color": a, "space_after": 5},
              {"t": t, "size": 13, "bold": True, "color": INK, "space_after": 4},
              {"t": price, "size": 14, "bold": True, "color": a, "space_after": 8},
              {"t": b, "size": 9.4, "color": BODY, "line": 1.28}])

    y2 = y + 2.36
    fw = (CONTENT_W - 0.4) / 3
    box(s, M, y2, fw, 1.4, fill=RGBColor(0xFE, 0xF3, 0xC7),
        line=RGBColor(0xF5, 0xD9, 0x8A))
    text(s, M + 0.28, y2 + 0.18, fw - 0.56, 1.06,
         [{"t": "₹370", "size": 25, "bold": True, "color": AMBER, "space_after": 2},
          {"t": "per fully active learner per year — the floor",
           "size": 10.5, "bold": True, "color": INK, "space_after": 5},
          {"t": "~₹330 AI inference (verified, with cached grounding and Haiku for "
                "batch) + ~₹40 infrastructure. No institutional licence is priced "
                "below it.", "size": 9.2, "color": BODY, "line": 1.24}])

    box(s, M + fw + 0.2, y2, fw, 1.4, fill=PRIMARY_WASH, line=PRIMARY_SOFT)
    text(s, M + fw + 0.48, y2 + 0.18, fw - 0.56, 1.06,
         [{"t": "1–2%", "size": 25, "bold": True, "color": PRIMARY_STRONG,
           "space_after": 2},
          {"t": "assumed free-to-paid conversion", "size": 10.5, "bold": True,
           "color": INK, "space_after": 5},
          {"t": "Duolingo converts 9.1% (12.5M paying of 137.8M) after four years of "
                "climbing from 5%, on a global and largely affluent base. Assuming "
                "that here would be fantasy.", "size": 9.2, "color": BODY, "line": 1.24}])

    box(s, M + 2 * (fw + 0.2), y2, fw, 1.4, fill=RGBColor(0xDC, 0xFC, 0xE7),
        line=RGBColor(0xA7, 0xE3, 0xBC))
    text(s, M + 2 * (fw + 0.2) + 0.28, y2 + 0.18, fw - 0.56, 1.06,
         [{"t": "₹10.6 Cr", "size": 25, "bold": True, "color": CORRECT,
           "space_after": 2},
          {"t": "Year-3 revenue at SOM (~$1.25M ARR)", "size": 10.5, "bold": True,
           "color": INK, "space_after": 5},
          {"t": "225,000 institutional at ₹450 + ~4,000 Plus + ~600 Mentor. Margin is "
                "thin by design and improves as inference costs fall — not by "
                "raising the institutional price.", "size": 9.2, "color": BODY,
           "line": 1.24}])

    source_note(s, SH - 0.86,
                "Sources: Duolingo investor materials (company strategy overview; Q3 FY2025 "
                "10-Q) — FY2025 revenue $1.04B, subscriptions 76% of revenue. Dagar unit "
                "costs: docs/DECISIONS.md D11, verified against Claude API pricing.")


def s13_testimonials(prs):
    s, y = slide_shell(prs, 14, "14 · What users said",
                       "Real feedback from real users.",
                       "Collected in-app from students, parents and teachers using "
                       "Dagar on their own phones. Replace the placeholders below "
                       "with actual quotes and the response count.")
    w, h, gx, gy = (CONTENT_W - 0.4) / 3, 1.56, 0.2, 0.2
    for i, (cx, cy) in enumerate(grid(M, y, 3, 2, w, h, gx, gy)):
        box(s, cx, cy, w, h, fill=WHITE, line=BORDER)
        box(s, cx, cy + 0.18, 0.045, h - 0.36, fill=PRIMARY_SOFT,
            shape=MSO_SHAPE.RECTANGLE)
        text(s, cx + 0.28, cy + 0.2, w - 0.5, h - 0.4,
             [{"t": "“", "size": 22, "bold": True, "color": PRIMARY_SOFT,
               "space_after": 0, "line": 0.7},
              {"t": "Quote goes here.", "size": 11, "italic": True, "color": BORDER,
               "space_after": 8, "line": 1.3},
              {"t": "— Name, role", "size": 9.5, "bold": True, "color": BORDER}])

    yb = y + 2 * h + gy + 0.22
    box(s, M, yb, CONTENT_W, 1.1, fill=PRIMARY_WASH, line=PRIMARY_SOFT)
    text(s, M + 0.32, yb + 0.16, 5.5, 0.86,
         [{"t": "How the feedback was collected", "size": 11.5, "bold": True,
           "color": PRIMARY_STRONG, "space_after": 5},
          {"t": "A five-question form inside the app, shown after a lesson is "
                "completed. Three tap-only questions, two optional written ones. No "
                "email address leaves the database.",
           "size": 9.8, "color": BODY, "line": 1.26}])
    for i, (n, label) in enumerate([("00", "responses"),
                                    ("00%", "said it helped them understand"),
                                    ("00%", "would come back")]):
        x = M + 6.3 + i * 1.95
        text(s, x, yb + 0.22, 1.85, 0.8,
             [{"t": n, "size": 22, "bold": True, "color": PRIMARY, "space_after": 2},
              {"t": label, "size": 9, "color": MUTED, "line": 1.2}])


# The deck, in order. `preview-deck.py` reads THIS rather than keeping its own
# copy — it had one, and a slide added here was simply missing from every
# preview until someone noticed. The one place a slide is registered.
SLIDES = [cover, s1_problem, s2_solution, s3_validation, s4_market_size, s5_persona,
          s6_features, s6b_screens, s7_how, s8_next, s9_roadmap, s10_adoption,
          s11_competitors, s12_pricing, s13_testimonials]


def main() -> None:
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(SW), Inches(SH)
    for fn in SLIDES:
        fn(prs)
    out = "docs/deck/Dagar-Pitch-Deck.pptx"
    prs.save(out)
    print(f"wrote {out} — {len(prs.slides.__iter__.__self__._sldIdLst)} slides")


if __name__ == "__main__":
    main()
