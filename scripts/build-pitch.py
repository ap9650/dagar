#!/usr/bin/env python3
"""
The Dagar pitch deck — one editable .pptx, pitch and build story together.

    python3 scripts/build-pitch.py              # the whole deck
    python3 scripts/build-pitch.py --only 2     # one slide, as a PNG to look at

═══════════════════════════════════════════════════════════════════════════════
WHY THIS FILE EXISTS ALONGSIDE build-deck.py.

The old deck opened on the MVP: a maths app for Classes 6–8 on the NCERT
syllabus. True, and the wrong first sentence — it describes the pilot, not the
company, and an audience that hears the scope first hears a homework app rather
than a thesis about who education currently fails.

So this one opens on the vision and the mission, verbatim from PRD §1, and the
MVP scope arrives later as EVIDENCE that the thesis was executable in four days.

The "How we built it" document was a second file. Nobody reads the second file.
Sections 12–18 here are that document, laid out as slides, in the one deck.

Output is .pptx, which is editable in PowerPoint, Keynote and Google Slides.
═══════════════════════════════════════════════════════════════════════════════
"""

import importlib.util
import subprocess
import sys

from pptx import Presentation
from pptx.util import Inches
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

# The brand tokens and layout primitives are already correct in build-deck.py
# and belong to `saathi-design`. Loading them by path rather than copying keeps
# ONE definition of the teal — two decks drifting apart on colour is exactly the
# kind of thing nobody notices until both are on screen at once.
_spec = importlib.util.spec_from_file_location("builddeck", "scripts/build-deck.py")
bd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bd)

PRIMARY, PRIMARY_STRONG = bd.PRIMARY, bd.PRIMARY_STRONG
PRIMARY_SOFT, PRIMARY_WASH = bd.PRIMARY_SOFT, bd.PRIMARY_WASH
INK, BODY, MUTED = bd.INK, bd.BODY, bd.MUTED
BORDER, SURFACE, WHITE = bd.BORDER, bd.SURFACE, bd.WHITE
CORRECT, AMBER, HINT = bd.CORRECT, bd.AMBER, bd.HINT
CELEBRATE_BG = bd.CELEBRATE_BG
FONT, APP_URL, REPO_URL = bd.FONT, bd.APP_URL, bd.REPO_URL
SW, SH, M, CONTENT_W = bd.SW, bd.SH, bd.M, bd.CONTENT_W

box, text, card = bd.box, bd.text, bd.card
stat, chip, grid = bd.stat, bd.chip, bd.grid
slide_shell = bd.slide_shell


# Set by --only. Quick Look hangs indefinitely thumbnailing a .pptx that
# carries a notesSlide part, and a thumbnail cannot show notes anyway, so
# preview renders skip them. The saved deck always keeps them.
PREVIEW = False


def notes(slide, body):
    """
    The speaker notes pane, for what the slide should not have to say out loud.

    A slide has to survive being read cold, so anything load-bearing belongs on
    it. But a number always draws one follow-up question, and the answer to that
    question does not deserve slide space. It deserves to be in the presenter's
    hand when it is asked.

    Notes travel with the .pptx, so they are also where a reader who opens the
    file later finds the derivation without hunting through the repo.
    """
    if PREVIEW:
        return
    slide.notes_slide.notes_text_frame.text = body.strip()


def source(slide, y, *refs):
    """
    Where a number on this slide came from, and where anyone can go and check it.

    ── THE RULE, AND WHY IT CHANGED ────────────────────────────────────────────
    The old deck footnoted "Source: PRD §2". That cites ourselves. To a judge it
    reads as a number we wrote down in one of our own documents, which is not a
    source, it is a restatement. The PRD is where WE keep our reasoning; it is
    not evidence to anybody outside this room.

    So every figure now names the body that published it and a URL short enough
    to read off a projected slide. If a number has no external source it does
    not get a citation, it gets removed, or it is labelled as our own measured
    data and stands on that.
    """
    text(slide, M, y, CONTENT_W, 0.3,
         [{"t": "   ·   ".join(refs), "size": 8.5, "color": MUTED, "line": 1.25}])


# ── slides ───────────────────────────────────────────────────────────────────

def cover(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    box(s, 0, 0, SW, SH, fill=PRIMARY_WASH, shape=MSO_SHAPE.RECTANGLE)
    box(s, 0, 0, 0.22, SH, fill=PRIMARY, shape=MSO_SHAPE.RECTANGLE)

    text(s, 1.1, 1.72, 8.6, 1.0,
         [{"t": "Dagar", "size": 62, "bold": True, "color": PRIMARY_STRONG,
           "space_after": 6, "line": 1.0},
          {"t": "डगर  ·  the trail you walk", "size": 15, "color": PRIMARY,
           "space_after": 0}])
    box(s, 1.12, 3.28, 1.4, 0.05, fill=PRIMARY, shape=MSO_SHAPE.RECTANGLE)

    # ── the copy rule for this deck ──────────────────────────────────────────
    # No em dashes. Anywhere. They are the clearest fingerprint of generated
    # text and this deck is presented as a person's work because it is one.
    # Full stops and commas carry the same rhythm and read as though somebody
    # wrote them.
    #
    # The second line answers the first rather than restating it. "So we built
    # one" is what turns a statement about unfairness into evidence of action,
    # which is the job of a cover slide standing on 32 live learners.
    text(s, 1.1, 3.62, 10.2, 1.5,
         [{"t": "Every learner deserves a guide. Most never get one.",
           "size": 25, "bold": True, "color": INK, "space_after": 10, "line": 1.18},
          {"t": "So we built one. Dagar gives every learner a tutor that adapts "
                "to them, in their own language, at no cost.",
           "size": 14, "color": BODY, "line": 1.35}])

    # Proof, not promise. A cover claiming a live product with real learners on
    # it is checkable in the room, and every number here is queried from the
    # database rather than rounded upward from memory.
    for i, (big, label) in enumerate([("Live", "in learners' hands"),
                                      ("32", "learners signed up"),
                                      ("13", "responses collected"),
                                      ("100%", "said it helped")]):
        stat(s, 1.1 + i * 2.42, 5.42, 2.22, 0.86, big, label)

    text(s, 1.1, SH - 0.72, 10.6, 0.5,
         [{"t": APP_URL + "   ·   Buildathon MVP, August 2026   ·   Akriti Panwar",
           "size": 10, "color": MUTED}])


def s2_vision(prs):
    """
    The slide the old deck did not have, and the reason this file exists.

    A deck that opens on scope tells the room what you built. A deck that opens
    on vision tells them what you believe, and then everything after it is
    evidence. The MVP is stronger arriving on slide 9 as proof that four days
    was enough to start, than on slide 1 as the definition of the company.

    Deliberately no maths, no Classes 6 to 8, no NCERT, no feature list. Naming
    the pilot here would shrink the claim to the size of the pilot.
    """
    s = prs.slides.add_slide(prs.slide_layouts[6])
    box(s, 0, 0, SW, SH, fill=WHITE, shape=MSO_SHAPE.RECTANGLE)
    box(s, 0, 0, 0.16, SH, fill=PRIMARY, shape=MSO_SHAPE.RECTANGLE)

    box(s, M, 0.52, 0.34, 0.055, fill=PRIMARY, shape=MSO_SHAPE.RECTANGLE)
    text(s, M + 0.46, 0.42, 9.0, 0.3,
         [{"t": "02 · VISION", "size": 10.5, "bold": True, "color": PRIMARY}])

    # The vision IS the headline. Set at 30pt it is read from the back of the
    # room in one beat; set at 14 inside a paragraph it is a sentence nobody
    # remembers thirty seconds later.
    text(s, M, 1.15, CONTENT_W - 0.5, 1.6,
         [{"t": "Every learner reaches their full potential, whatever they can "
                "afford, wherever they start, however they learn.",
           "size": 30, "bold": True, "color": INK, "line": 1.16}])

    box(s, M, 2.86, 1.4, 0.05, fill=PRIMARY, shape=MSO_SHAPE.RECTANGLE)

    text(s, M, 3.16, CONTENT_W - 0.5, 0.4,
         [{"t": "Our mission is how we get there.", "size": 14.5, "bold": True,
           "color": PRIMARY_STRONG}])

    # The mission from PRD §1, broken into its four working parts. As one
    # sentence it reads as a paragraph to be endured; as four it reads as a
    # method somebody could hold you to.
    parts = [
        ("Curriculum aware", "We teach what the learner is actually studying, "
                             "not whatever a general model happens to know."),
        ("Accessible by design", "Built for a shared phone, a slow connection "
                                 "and a learner who reads in Hindi."),
        ("Engaging, not passive", "Lessons a learner taps and answers, rather "
                                  "than videos they watch and forget."),
        ("At their own pace", "The learner sets the speed. The product adapts "
                              "to them, never the other way round."),
    ]
    w, h, gx = 3.0, 1.42, 0.2
    for i, (t, b) in enumerate(parts):
        card(s, M + i * (w + gx), 3.66, w, h, t, b, title_size=12.5, body_size=10)

    # Who "underserved" means, named. Left abstract it is a word that lets an
    # audience picture whoever is most convenient, which is usually a learner
    # who was going to be fine anyway.
    yb = 5.34
    box(s, M, yb, CONTENT_W, 1.06, fill=PRIMARY_WASH, line=PRIMARY_SOFT)
    text(s, M + 0.34, yb + 0.16, CONTENT_W - 0.68, 0.74,
         [{"t": "The learners we mean when we say underserved.", "size": 12,
           "bold": True, "color": PRIMARY_STRONG, "space_after": 5},
          {"t": "Learners from economically disadvantaged families. Learners "
                "with disabilities. Neurodiverse learners whose needs are "
                "overlooked by a stretched system. Learners studying in Hindi, "
                "for whom an English-only product is not a missing feature but "
                "a locked door.",
           "size": 10.5, "color": BODY, "line": 1.28}])

    text(s, M, SH - 0.44, 6.0, 0.24,
         [{"t": "Dagar  ·  A personal guide for every learner's journey",
           "size": 8.5, "color": MUTED}])
    text(s, SW - M - 2.0, SH - 0.44, 2.0, 0.24,
         [{"t": "2", "size": 8.5, "color": MUTED}], align=PP_ALIGN.RIGHT)


def s3_problem(prs):
    """
    PRD §2. Four failures, not one, because the fix has to be four things.

    Amber for the two that are about the learner falling behind, blue for the
    two about the support around them being absent. Never red anywhere in this
    product, deck included: red is the colour of a system error, and none of
    these are errors, they are conditions.
    """
    # 247 million, from UDISE+ 2024-25, the most recent year published. The
    # earlier draft said 248 million from the 2023-24 report; a deck presented
    # in August 2026 quoting a superseded figure is the kind of small staleness
    # that makes an audience wonder what else was not checked.
    s, y = slide_shell(prs, 3, "03 · Problem",
                       "Enrolment was solved. Learning was not.",
                       "India has 247 million children in school. It has not put a "
                       "guide beside any of them.")
    cards = [
        ("Children move up a grade without mastering the last one",
         "Classrooms are crowded and the syllabus does not wait. A doubt raised "
         "in Monday's lesson is still a doubt in December, and Class 8 is built "
         "on Class 6. The gap compounds quietly until it looks like ability.",
         AMBER),
        ("Help exists, and it is priced out of reach",
         "Private tuition is the default answer to falling behind, and it costs "
         "more than the families who need it most can pay. The learner with the "
         "greatest need is structurally the one who cannot buy the solution.",
         AMBER),
        ("Parents want to help and have nothing to work with",
         "No time, no subject expertise, and no visibility beyond an exam mark "
         "that arrives months after the confusion started. Wanting to support a "
         "child is not the same as being able to.",
         HINT),
        ("The learners furthest from support are dropped first",
         "Economically disadvantaged, disabled and neurodiverse learners are who "
         "a stretched system loses first. They are also who almost nobody "
         "designs a product around.",
         HINT),
    ]
    w, h, gx, gy = 5.98, 1.66, 0.22, 0.2
    for (cx, cy), (t, b, a) in zip(grid(M, y, 2, 2, w, h, gx, gy), cards):
        card(s, cx, cy, w, h, t, b, accent=a)

    # The hinge into slide 6. One line here, the detail there. Making the
    # competitive argument twice is how a deck starts to feel repetitive.
    yb = y + 2 * h + gy + 0.24
    box(s, M, yb, CONTENT_W, 0.82, fill=PRIMARY_WASH, line=PRIMARY_SOFT)
    text(s, M + 0.34, yb + 0.13, CONTENT_W - 0.68, 0.58,
         [{"t": "Every existing product solves one fragment of this.", "size": 12.5,
           "bold": True, "color": PRIMARY_STRONG, "space_after": 4},
          {"t": "Video platforms deliver content but cannot personalise teaching. "
                "Generic AI answers a question but does not know the learner's "
                "curriculum or history. Practice apps assess without adapting "
                "instruction. Tutoring personalises but does not scale. Nobody "
                "joins them up.",
           "size": 10.5, "color": BODY, "line": 1.25}])

    source(s, SH - 0.76,
           "Enrolment: UDISE+ 2024-25, Ministry of Education  ·  udiseplus.gov.in")


def s4_validation(prs):
    """
    The research, and what each finding made us build.

    Every number here is from ASER (Pratham) or the Ministry of Education, and
    every one was checked against the current published year rather than lifted
    from our own PRD. A validation slide citing our own document would be the
    single easiest thing in this deck to pull apart.

    The right-hand column is the point. Anyone can put four statistics on a
    slide. Showing which product decision each one forced is what separates
    research from decoration.
    """
    s, y = slide_shell(prs, 4, "04 · Market validation",
                       "We did not guess. We checked.",
                       "Four findings shaped this product. Each one is public, "
                       "current, and led directly to something we built.")

    # Sub-lines kept to two rendered lines each. Longer copy clipped at the tile
    # edge, and the fix is shorter writing rather than a taller tile: the band
    # below is already at the foot of the slide.
    tiles = [
        ("30.7%", "of Class 5 children can solve a division problem",
         "Almost seven in ten cannot."),
        # "In Bihar, 70%." made the reader supply the verb, and 70% of what was
        # left to inference. Every line on a slide has to survive being read
        # cold, with nobody standing beside it explaining.
        ("30.5%", "of children already pay for private tuition",
         "Classes 1 to 8. In Bihar, 70% do."),
        ("67%", "of rural households have a smartphone",
         "Up from 36% in 2018."),
        ("63.6M", "children are in Classes 6 to 8",
         "Growing, while total enrolment falls."),
    ]
    w, gx = 3.02, 0.2
    for i, (big, label, sub) in enumerate(tiles):
        stat(s, M + i * (w + gx), y, w, 1.52, big, label, sub)

    y2 = y + 1.74
    text(s, M, y2, CONTENT_W, 0.3,
         [{"t": "WHAT EACH FINDING MADE US BUILD", "size": 10, "bold": True,
           "color": PRIMARY}])

    pairs = [
        ("Learning gaps are arithmetic, not literacy",
         "So we started with mathematics, and we teach for concept mastery "
         "rather than syllabus completion. Finishing a chapter is not the goal. "
         "Understanding it is."),
        ("Families already pay for personalised help",
         "The willingness to pay is proven. The price is the barrier. So the "
         "product is free, and the personalisation that tuition sells is what "
         "we give away."),
        ("The phone is shared, and it is the only device",
         "So Dagar is built mobile first at 360 pixels, works on a slow "
         "connection, and needs no download. The parent summary arrives on "
         "WhatsApp because that is where the parent already is."),
    ]
    w2, gx2 = 4.06, 0.22
    for i, (t, b) in enumerate(pairs):
        card(s, M + i * (w2 + gx2), y2 + 0.36, w2, 1.62, t, b,
             title_size=12.5, body_size=10)

    # Marking our own soft numbers. An audience trusts a deck that says which
    # figures are estimates far more than one presenting everything as fact,
    # and the question gets asked either way.
    yb = y2 + 2.16
    box(s, M, yb, CONTENT_W, 0.72, fill=CELEBRATE_BG, line=AMBER)
    text(s, M + 0.34, yb + 0.13, CONTENT_W - 0.68, 0.5,
         [{"t": "Where we are estimating, we say so.", "size": 11.5, "bold": True,
           "color": AMBER, "space_after": 3},
          {"t": "The figures above are published national data. Our market "
                "sizing on the next slide is a derived estimate, and the share "
                "of state boards aligned to NCERT is the softest input in it.",
           "size": 10, "color": BODY, "line": 1.25}])

    source(s, SH - 0.72,
           "ASER 2024 and ASER 2022, Pratham  ·  asercentre.org",
           "UDISE+ 2024-25, Ministry of Education  ·  udiseplus.gov.in")


def s5_market(prs):
    """
    TAM, SAM, SOM, with the arithmetic shown rather than asserted.

    Rebuilt on the verified UDISE+ 2024-25 figure of 63.6M in Classes 6 to 8.
    The PRD derived SAM from a rounder ~65M, which moved the answer by about
    half a million learners. Small, and worth correcting: the one question
    always asked of a sizing slide is how you got there, and the answer should
    survive being checked live.

    The funnel is on the slide on purpose. A single SAM number invites the
    suspicion that it was reverse-engineered from a pleasing revenue figure.
    Three multiplications anyone can redo removes that argument entirely.
    """
    s, y = slide_shell(prs, 5, "05 · Market opportunity",
                       "A large market, entered at its narrowest point.",
                       "We size it honestly, we show the arithmetic, and we start "
                       "where we can actually reach learners.")

    # The multiplication is shown, not the product alone. Reviewed cold, the
    # learner funnel below explained 29.6M while ₹1,480 Cr appeared from
    # nowhere, and the first question back was "where did that come from".
    # A money figure with no visible multiplier reads as asserted.
    #
    # SOM multiplies by ₹450, not ₹500: above 25,000 learners the institutional
    # tier prices at ₹450, and using the blended figure there would overstate it.
    tiers = [
        ("247M", "learners  ·  TAM",
         "Every school-going child in India, Classes 1 to 12.",
         "247M × ₹500  =  ₹12,350 Cr  ·  $1.40B", PRIMARY),
        ("29.6M", "learners  ·  SAM",
         "Classes 6 to 8 on NCERT-aligned curricula, with a smartphone at home.",
         "29.6M × ₹500  =  ₹1,480 Cr  ·  $168M", PRIMARY),
        ("250K", "learners  ·  SOM",
         "Three years, through NGO and CSR programmes, government pilots and word of mouth.",
         "250K × ₹450  =  ₹11 Cr  ·  $1.28M ARR", HINT),
    ]
    w, gx = 3.87, 0.24
    for i, (big, label, blurb, money, accent) in enumerate(tiers):
        x = M + i * (w + gx)
        box(s, x, y, w, 1.92, fill=WHITE, line=BORDER)
        box(s, x, y + 0.2, 0.05, 1.52, fill=accent, shape=MSO_SHAPE.RECTANGLE)
        text(s, x + 0.28, y + 0.18, w - 0.5, 1.6,
             [{"t": big, "size": 32, "bold": True, "color": accent,
               "space_after": 2, "line": 1.0},
              {"t": label, "size": 10.5, "bold": True, "color": MUTED,
               "space_after": 7},
              {"t": blurb, "size": 10.5, "color": BODY, "space_after": 7,
               "line": 1.22},
              {"t": money, "size": 11, "bold": True, "color": INK}])

    y2 = y + 2.14

    # The arithmetic, in public.
    box(s, M, y2, 7.3, 1.62, fill=SURFACE, line=BORDER)
    text(s, M + 0.3, y2 + 0.15, 6.8, 1.34,
         [{"t": "HOW WE GET TO 29.6 MILLION", "size": 9.5, "bold": True,
           "color": PRIMARY, "space_after": 7},
          {"t": "63.6M children in Classes 6 to 8   (UDISE+ 2024-25)",
           "size": 11, "color": INK, "space_after": 4},
          {"t": "×  62% follow NCERT or an NCERT-aligned state curriculum   "
                "=  39.4M", "size": 11, "color": INK, "space_after": 4},
          {"t": "×  75% have a smartphone in the household   =  29.6M",
           "size": 11, "bold": True, "color": PRIMARY_STRONG, "space_after": 6},
          {"t": "The 62% is our softest input. It moves SAM by roughly ten "
                "million learners either way, and it is the first number we "
                "would commission research to firm up.",
           "size": 9.5, "color": MUTED, "line": 1.22}])

    # The framing that makes a modest SOM a choice rather than a small ambition.
    box(s, M + 7.54, y2, 4.55, 1.62, fill=PRIMARY_WASH, line=PRIMARY_SOFT)
    text(s, M + 7.82, y2 + 0.18, 4.05, 1.3,
         [{"t": "Learners reached is the headline metric.", "size": 12.5,
           "bold": True, "color": PRIMARY_STRONG, "space_after": 6, "line": 1.1},
          {"t": "Revenue is the constraint that keeps Dagar alive, not the "
                "reason it exists. A product built for families who cannot "
                "afford tuition cannot be judged on what it extracts from "
                "them. We size the market to know it is fundable, and then we "
                "measure ourselves on children taught.",
           "size": 10, "color": BODY, "line": 1.24}])

    # Who actually pays. Without this the slide reads as a plan to charge
    # children for lessons, which is the opposite of the product, and the ₹370
    # floor is the evidence the thing was costed before it was priced.
    yb = y2 + 1.78
    box(s, M, yb, CONTENT_W, 0.76, fill=CELEBRATE_BG, line=AMBER)
    text(s, M + 0.34, yb + 0.14, CONTENT_W - 0.68, 0.54,
         [{"t": "No child pays anything in these numbers.", "size": 11.5,
           "bold": True, "color": AMBER, "space_after": 3},
          {"t": "Learners never pay for the core learning loop. Institutions "
                "buy reach: NGOs, CSR programmes and government. The ₹450 floor "
                "is set by cost, not by ambition, because an active learner "
                "costs about ₹370 a year to serve, most of it AI inference. "
                "Full tiers and unit economics on slide 22.",
           "size": 10, "color": BODY, "line": 1.24}])

    source(s, SH - 0.72,
           "Classes 6 to 8 enrolment: UDISE+ 2024-25  ·  udiseplus.gov.in",
           "Smartphone access: ASER 2024, Pratham  ·  asercentre.org",
           "Converted at ₹88 = $1, the rate lib/ai/pricing.ts bills at")

    notes(s, """
WHERE EVERY NUMBER ON THIS SLIDE COMES FROM

The ₹500 multiplier is a blended monetisable ARPU: the institutional tier runs
₹450 to ₹600 per learner per year, blended with a small share of consumer Plus
at ₹799 per year. It is a ceiling on what the market is worth if served, not a
price any family is asked to pay.

TAM   247M learners x ₹500 = ₹12,350 Cr, which is $1.40B at ₹88 = $1.
SAM   29.6M x ₹500 = ₹1,480 Cr, which is $168M.
SOM   250,000 x ₹450 = ₹11.25 Cr, which is $1.28M ARR.

SOM uses ₹450 rather than ₹500 because the institutional volume tier prices at
₹450 above 25,000 learners. Blending it at ₹500 would overstate the figure.

THE 250,000 IS A CHANNEL BUILD-UP, NOT A PERCENTAGE WE PICKED
  NGO and CSR programmes   ~150,000   15 to 25 partner orgs, 6 to 10k each
  Government school pilots  ~75,000   2 to 3 district-level pilots
  Organic and word of mouth ~25,000   no paid acquisition
  Total                     ~250,000  which is 0.84% of SAM

IF ASKED WHY DIRECT-TO-CONSUMER IS NOT THE ENGINE
Indian consumer edtech converts free to paid at roughly 2 to 5%. For a segment
defined by inability to afford tuition, assume 1 to 2%. A consumer-led model
would need around twenty times the user base for the same revenue, and paid
acquisition is not available to a product whose users are selected for having
no money to spend.

IF ASKED ABOUT THE COST FLOOR
About ₹370 per active learner per year: roughly ₹330 AI inference and ₹40
infrastructure. A free-tier learner costs about ₹120 because the tutor is
capped at 10 questions a day. Any institutional price below ₹370 loses money on
every active learner, which is why the tier starts at ₹450 and not lower.

THE SOFTEST NUMBER, IF CHALLENGED
The 62% NCERT alignment. It moves SAM by roughly ten million learners either
way and it is the first thing we would commission research to firm up. Say it
before they find it.
""")


def s6_competition(prs):
    """
    The last slide of the "why this should exist" block.

    ── CATEGORIES, NOT COMPANIES ───────────────────────────────────────────────
    Naming BYJU'S or ChatGPT invites an argument about a feature one of them
    shipped last month, and dates the deck the moment they ship another. The
    categories are stable; the products inside them move.

    ── THE ROW THAT MAKES THE SLIDE CREDIBLE ───────────────────────────────────
    Dagar takes every tick, which is exactly what a competitive matrix always
    shows and exactly why nobody believes one. So the band underneath concedes
    the real thing: a good human tutor beats Dagar at teaching. We are not
    better than a tutor. We are available to the learner who was never going to
    get one, which is a different and more honest claim.
    """
    s, y = slide_shell(prs, 6, "06 · Competitive gap",
                       "Everyone solves a piece. Nobody joins them up.",
                       "Six things a learner falling behind actually needs. Each "
                       "category delivers some of them.")

    cols = ["Knows the\nsyllabus", "Adapts to\nthe learner", "Teaches, not\njust answers",
            "Works in\nHindi", "Free", "Reaches\nthe parent"]
    rows = [
        ("Video platforms", "Recorded lessons, one pace for everyone",
         ["y", "n", "y", "p", "y", "n"]),
        ("Generic AI assistants", "Answer anything, know nothing about this learner",
         ["n", "n", "p", "y", "p", "n"]),
        ("Practice and test-prep apps", "Measure the gap, do not close it",
         ["y", "p", "n", "p", "p", "p"]),
        ("Private tuition", "Works, and costs more than the family has",
         ["y", "y", "y", "y", "n", "p"]),
        ("Dagar", "The combination, not the best of any one",
         ["y", "y", "y", "y", "y", "y"]),
    ]

    label_w, col_w, row_h = 3.9, 1.36, 0.58
    head_h = 0.5

    for i, col in enumerate(cols):
        text(s, M + label_w + i * col_w, y, col_w, head_h,
             [{"t": col, "size": 8.5, "bold": True, "color": MUTED, "line": 1.15}],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.BOTTOM)

    marks = {"y": ("✓", PRIMARY), "p": ("~", AMBER), "n": ("·", MUTED)}

    for r, (name, blurb, scores) in enumerate(rows):
        ry = y + head_h + r * row_h
        last = r == len(rows) - 1
        if last:
            box(s, M, ry, label_w + 6 * col_w, row_h, fill=PRIMARY_WASH, line=PRIMARY)
        text(s, M + 0.22, ry, label_w - 0.3, row_h,
             [{"t": name, "size": 11.5, "bold": True,
               "color": PRIMARY_STRONG if last else INK, "space_after": 1, "line": 1.05},
              {"t": blurb, "size": 8.5, "color": MUTED, "line": 1.1}],
             anchor=MSO_ANCHOR.MIDDLE)
        for c, score in enumerate(scores):
            glyph, colour = marks[score]
            text(s, M + label_w + c * col_w, ry, col_w, row_h,
                 [{"t": glyph, "size": 15 if score != "n" else 17, "bold": True,
                   "color": colour}],
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

    yl = y + head_h + len(rows) * row_h + 0.08
    text(s, M, yl, CONTENT_W, 0.24,
         [{"t": "✓  does this well            ~  partly, or only sometimes            ·  does not do this", "size": 8.5, "color": MUTED}])

    yb = yl + 0.34
    box(s, M, yb, CONTENT_W, 1.02, fill=CELEBRATE_BG, line=AMBER)
    text(s, M + 0.34, yb + 0.16, CONTENT_W - 0.68, 0.8,
         [{"t": "A good tutor still beats us. That is not the argument.",
           "size": 12, "bold": True, "color": AMBER, "space_after": 4},
          {"t": "A person in the room notices what no model can, and we do not "
                "claim otherwise. The learner in this deck was never going to get "
                "that person. What is hard to copy is not the AI, which anyone "
                "can call: it is curriculum grounding, a learning engine that "
                "decides what comes next, and content authored in two languages.",
           "size": 10.5, "color": BODY, "line": 1.26}])

    notes(s, """
IF ASKED TO NAME NAMES
Deliberately categories, not companies. Naming a product invites an argument
about a feature it shipped last month and dates the deck when it ships another.
If pressed: video platforms means YouTube and recorded course apps, generic AI
means the general assistants, practice apps means the test-prep category.

WHY GENERIC AI SCORES BADLY ON "KNOWS THE SYLLABUS"
It knows mathematics. It does not know that this learner is on NCERT Class 7
Integers, failed two questions on sign errors last Tuesday, and reads Hindi. It
will also hand over the answer when asked, which is the opposite of teaching.

WHY PRIVATE TUITION SCORES WELL
Because it does work. That is the point. It is the benchmark, and the only box
it fails is the one that decides whether this learner ever gets it.

THE HONEST CONCESSION, SAY IT BEFORE THEY DO
A good human tutor is better than Dagar at teaching. We are not competing with
the tutor a family can afford. We are competing with nothing at all, which is
what the learner in this deck currently has.
""")


def s7_persona(prs):
    """
    Two people, in the shape a persona is normally written.

    ── WHAT CHANGED FROM THE FIRST VERSION ─────────────────────────────────────
    It ran as two paragraphs of prose and it carried two things that did not
    belong on a slide.

    The first was a note that Lakshmi replaced a boy called Aarav. That is a
    real decision and it lives in the PRD, but on a pitch slide it is internal
    process shown to an audience who has no reason to care, and it spends
    attention that should go on the learner.

    The second was "not about a segment", which was simply wrong: Lakshmi and
    Suresh ARE two segments, and saying otherwise contradicts the market slides
    two ahead of it.

    Now it uses the standard persona frame, because a room reads that shape
    faster than prose: who they are, what they want, what is in the way, and one
    sentence in their own voice. Each card ends with the decision that person
    forced, which is what stops a persona slide being decoration.
    """
    # Kept under about 48 characters. The first version ran to 62 and wrapped
    # onto a second line, which the shell does not reserve room for, so it
    # printed straight through the subtitle.
    s, y = slide_shell(prs, 7, "07 · Who this is for",
                       "Lakshmi is twelve. She is why Dagar exists.",
                       "One learner and one parent. Every design decision in Dagar "
                       "was checked against these two.")

    w, gx = 5.94, 0.26
    card_h = 4.28

    people = [
        {
            "accent": PRIMARY,
            "badge": "PRIMARY  ·  THE LEARNER",
            "img": "docs/deck/persona-lakshmi.png",
            "name": "Lakshmi",
            "role": "12 years old, Class 7",
            "chips": ["Hindi medium", "Government school", "Shared Android"],
            "goals": [
                "Understand a concept, not just finish the homework",
                "Keep up with the class instead of slipping further behind",
                "Feel capable at maths again",
            ],
            "pains": [
                "The lesson moves on before her doubt is resolved",
                "Tuition would help, and costs more than the family has",
                "Almost every explanation online is in English",
            ],
            "quote": "\u201cI understood it in class. By the time I got home, I didn\u2019t.\u201d",
            "built": "So we built it bilingual in the MVP, and made lessons "
                     "something she taps through rather than watches.",
        },
        {
            "accent": HINT,
            "badge": "SECONDARY  ·  THE PARENT",
            "img": "docs/deck/persona-suresh.png",
            "name": "Suresh",
            "role": "Her father, cook at a restaurant",
            "chips": ["800 km away", "Split shifts", "WhatsApp only"],
            "goals": [
                "Know whether she is actually studying",
                "Be included in her progress, not notified about it",
                "Support her without having to teach the maths",
            ],
            "pains": [
                "No visibility beyond an exam mark months too late",
                "No subject knowledge to help, even from the same room",
                "Long shifts, and a distance he cannot close",
            ],
            "quote": "\u201cI ask if she studied. She says yes. That is the whole conversation.\u201d",
            "built": "So we built a weekly WhatsApp summary that needs no app and "
                     "no account, timed for the Sunday call.",
        },
    ]

    for i, person in enumerate(people):
        x = M + i * (w + gx)
        accent = person["accent"]
        box(s, x, y, w, card_h, fill=WHITE, line=BORDER)
        box(s, x, y + 0.22, 0.05, card_h - 0.44, fill=accent, shape=MSO_SHAPE.RECTANGLE)

        # Drawn, not photographed. A stock photo of a real child standing in for
        # "the underserved learner" is a licensing question and a dignity one.
        s.shapes.add_picture(person["img"], Inches(x + 0.26), Inches(y + 0.22),
                             Inches(1.16), Inches(1.16))

        text(s, x + 1.56, y + 0.26, w - 1.85, 1.1,
             [{"t": person["badge"], "size": 8, "bold": True, "color": accent,
               "space_after": 4},
              {"t": person["name"], "size": 19, "bold": True, "color": INK,
               "space_after": 3, "line": 1.0},
              {"t": person["role"], "size": 11, "color": BODY, "line": 1.15}])

        cx = x + 1.56
        for label in person["chips"]:
            cw = 0.17 + 0.075 * len(label)
            chip(s, cx, y + 1.14, cw, 0.26, label, size=8.5)
            cx += cw + 0.1

        # Goals and pain points side by side, the way a persona template sets
        # them: what they are reaching for, and what is in the way.
        sub_w = (w - 0.72) / 2
        for j, (heading, items, colour) in enumerate(
            [("GOALS", person["goals"], accent),
             ("PAIN POINTS", person["pains"], AMBER)]
        ):
            sx = x + 0.3 + j * (sub_w + 0.12)
            runs = [{"t": heading, "size": 8.5, "bold": True, "color": colour,
                     "space_after": 5}]
            for item in items:
                runs.append({"t": "\u2022  " + item, "size": 9.5, "color": BODY,
                             "space_after": 4, "line": 1.18})
            text(s, sx, y + 1.62, sub_w, 1.5, runs)

        box(s, x + 0.3, y + 3.2, w - 0.6, 0.46, fill=SURFACE, line=None)
        text(s, x + 0.44, y + 3.2, w - 0.88, 0.46,
             [{"t": person["quote"], "size": 10.5, "bold": True, "color": INK,
               "line": 1.2}])

        text(s, x + 0.3, y + 3.78, w - 0.6, 0.4,
             [{"t": person["built"], "size": 9.5, "color": MUTED, "line": 1.2}])

    notes(s, """
WHY A PARENT PERSONA AT ALL
Because learner consistency is the metric the whole product turns on, and the
adult is the strongest lever on it that we do not control. H6 in the hypothesis
list is exactly this: parent engagement improves learner consistency.

WHY HE DOES NOT GET AN APP
He would not install it, and the phone he reads on is not the phone she studies
on. The weekly summary is a WhatsApp message with no account and no download,
timed so he has something concrete to ask her about on the Sunday call. One
learner is linked to a parent today, which is honest and small.

THE LINE THAT MATTERS
Most parent features in edtech are built as if the parent needs persuading to
care. This one starts from a father who already cares and has nothing to work
with. That is a truer situation and a different product.

IF ASKED HOW REAL THESE ARE
Composites, drawn rather than photographed, and grounded in the segment data on
slide 4: Hindi medium, shared household smartphone, tuition unaffordable. The
quotes are written, not transcribed, and we would say so if asked.
""")


def s8_solution(prs):
    """
    What Dagar is, argued as a sequence rather than a feature list.

    The differentiating claim in the PRD is curriculum-aware adaptive teaching,
    and the thing that delivers it is the ORDER: a lesson, then practice on that
    same concept while it is still warm, then a quiz, then proof the week
    happened. A features grid would show the same six things and lose the only
    part that is hard to copy.

    The four rules underneath are stated as rules, not features, because each
    one is a decision somebody could have made the other way and most products
    did.
    """
    s, y = slide_shell(prs, 8, "08 · Solution",
                       "Not a chatbot with a syllabus attached.",
                       "A guided journey through the curriculum, where the order "
                       "of things is the product.")

    steps = [
        ("01", "Chapter path", "She sees where she is, and the one thing to do next."),
        ("02", "Micro-lesson", "Taps and answers her way through it, rather than scrolling past."),
        ("03", "Guided practice", "The same concept, immediately, while it is still warm."),
        ("04", "Chapter quiz", "Proves the chapter, and sets the mastery band."),
        ("05", "Progress", "Streak, week strip and what moved. Yesterday was real."),
    ]
    sw, sgx = 2.21, 0.24
    for i, (n, title, body) in enumerate(steps):
        x = M + i * (sw + sgx)
        box(s, x, y, sw, 1.34, fill=PRIMARY_WASH, line=PRIMARY_SOFT)
        text(s, x + 0.22, y + 0.14, sw - 0.4, 1.1,
             [{"t": n, "size": 9, "bold": True, "color": PRIMARY, "space_after": 3},
              {"t": title, "size": 12.5, "bold": True, "color": INK,
               "space_after": 4, "line": 1.05},
              {"t": body, "size": 9.5, "color": BODY, "line": 1.2}])
        # A chevron in the gap, so the row reads as a sequence and not a menu.
        if i < len(steps) - 1:
            text(s, x + sw, y + 0.42, sgx, 0.4,
                 [{"t": "\u203a", "size": 18, "bold": True, "color": PRIMARY}],
                 align=PP_ALIGN.CENTER)

    y2 = y + 1.54
    text(s, M, y2, CONTENT_W, 0.28,
         [{"t": "FOUR RULES THAT SHAPE ALL OF IT", "size": 10, "bold": True,
           "color": PRIMARY}])

    rules = [
        ("The tutor knows the lesson, not just mathematics",
         "Every call carries the text of the lesson she is on and her weakest "
         "concepts in that chapter. It teaches inside the curriculum and hints "
         "before it answers.", PRIMARY),
        ("Grading is code, never AI",
         "1/2, 2/4 and 0.5 all mark correct against 1/2. A model that grades is "
         "a model that is confidently wrong sometimes, and the learner pays for "
         "it in confidence.", PRIMARY),
        ("Hints escalate before answers",
         "A nudge, then the method, then a worked step, then the solution. A "
         "learner handed the answer straight away has learned nothing, which is "
         "how a general assistant fails at teaching.", HINT),
        ("Wrong answers are amber, never red",
         "Red is reserved for system errors. A child who is already behind must "
         "not see the colour of danger because she made a sign error.", AMBER),
    ]
    cw = (CONTENT_W - 3 * 0.22) / 4
    for i, (title, body, accent) in enumerate(rules):
        card(s, M + i * (cw + 0.22), y2 + 0.34, cw, 1.62, title, body,
             accent=accent, title_size=11.5, body_size=9.5)

    # ── SHIPPED vs BEING MEASURED, labelled ──────────────────────────────────
    # An earlier version put both of these in one sentence and implied Dagar
    # offers a human mentor. It does not. The route is capture-only (D8): there
    # is no mentor-side UI, no dispatch, and `status` moves by hand. What exists
    # is the OFFER and the record of who accepted it, which is how H7 gets an
    # answer before anybody builds a service.
    #
    # Splitting them is not modesty, it is the stronger slide. A team that can
    # show which parts are real and which are instrumented reads as one that
    # knows the difference.
    yb = y2 + 2.14
    half = (CONTENT_W - 0.22) / 2

    box(s, M, yb, half, 0.9, fill=SURFACE, line=BORDER)
    box(s, M, yb + 0.16, 0.05, 0.58, fill=CORRECT, shape=MSO_SHAPE.RECTANGLE)
    text(s, M + 0.3, yb + 0.14, half - 0.55, 0.68,
         [{"t": "LIVE  ·  THE PARENT LOOP", "size": 8.5, "bold": True,
           "color": CORRECT, "space_after": 4},
          {"t": "A weekly summary reaches her parent on WhatsApp. No app to "
                "download, no account to create, timed so he has something to "
                "ask her about on Sunday.",
           "size": 10.5, "color": BODY, "line": 1.24}])

    box(s, M + half + 0.22, yb, half, 0.9, fill=CELEBRATE_BG, line=AMBER)
    box(s, M + half + 0.22, yb + 0.16, 0.05, 0.58, fill=AMBER,
        shape=MSO_SHAPE.RECTANGLE)
    text(s, M + half + 0.52, yb + 0.14, half - 0.55, 0.68,
         [{"t": "BEING MEASURED  ·  HUMAN SUPPORT", "size": 8.5, "bold": True,
           "color": AMBER, "space_after": 4},
          {"t": "When the product can tell she is stuck it offers to put a "
                "person in touch, and records that she said yes. There is no "
                "mentor service behind it yet. How often learners ask is what "
                "decides whether one is worth building.",
           "size": 10.5, "color": BODY, "line": 1.24}])

    notes(s, """
THE SENTENCE TO LEAD WITH
The order is the product. Anyone can put a lesson and a chatbot in one app. The
thing that is hard is practice on the same concept while it is still warm, a
tutor that knows which concept that is, and a quiz that decides mastery from
both.

WHY GRADING IS NOT AI, IF PRESSED
Because a grader that is wrong 2% of the time tells a child who was right that
she was wrong, and there is no error message for that. Deterministic code in
lib/learning/grading.ts owns it, with the equivalence cases tested: unreduced
fractions, decimal forms, whitespace, sign errors staying wrong.

WHY AMBER MATTERS MORE THAN IT SOUNDS
It is the smallest decision on this slide and the one teachers respond to. The
learners we build for have been told they are bad at maths for years. Red is
the colour of that message.

THE MENTOR OFFER IS A DEMAND TEST, NOT A SERVICE. SAY THIS PLAINLY.
The route is capture-only. There is no mentor-side interface, nothing is
dispatched, and a request's status is moved by hand. What the learner sees is
an offer, and the copy deliberately promises a person rather than a timeframe,
because an app that says "someone will reply shortly" and then does not is
worse than one that never offered.

The three triggers are real and they fire: three wrong in a row, hints
exhausted twice, or a long tutor conversation with no practice attempt. Each
one records that a learner reached the point of being stuck, and whether she
took the offer.

That is hypothesis H7: learners who remain stuck will request human support.
Staffing mentors before knowing how often that happens would be building a
service on an assumption. The number decides it.

WHAT IS DELIBERATELY NOT HERE
No leaderboards, no ranks, no hearts or lives, no XP. Those mechanics invert
for a learner who is already behind: losing a life for a wrong answer punishes
exactly the child who needed another try.
""")


SLIDES = [cover, s2_vision, s3_problem, s4_validation, s5_market, s6_competition,
          s7_persona, s8_solution]


def main() -> None:
    global PREVIEW
    only = None
    if "--only" in sys.argv:
        only = int(sys.argv[sys.argv.index("--only") + 1])
        PREVIEW = True

    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(SW), Inches(SH)

    for i, fn in enumerate(SLIDES):
        if only is not None and i != only:
            continue
        fn(prs)

    if only is not None:
        # One slide, rendered to a PNG so it can be reviewed before the next one
        # is written. Building a deck blind and showing fifteen slides at the end
        # is how a deck ends up rewritten twice.
        out = f"/tmp/pitch-{only:02d}"
        prs.save(out + ".pptx")
        subprocess.run(["qlmanage", "-t", "-s", "2000", "-o", "/tmp", out + ".pptx"],
                       capture_output=True)
        subprocess.run(["mv", f"/tmp/pitch-{only:02d}.pptx.png", out + ".png"],
                       capture_output=True)
        subprocess.run(["rm", "-f", out + ".pptx"], check=False)
        print(f"wrote {out}.png")
        return

    out = "docs/deck/Dagar-Pitch-Deck.pptx"
    prs.save(out)
    print(f"wrote {out} — {len(SLIDES)} slides")


if __name__ == "__main__":
    main()
