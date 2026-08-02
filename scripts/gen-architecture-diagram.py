from PIL import Image, ImageDraw, ImageFont

W, H = 1800, 1180
SC = 2
img = Image.new("RGB", (W * SC, H * SC), (255, 255, 255))
d = ImageDraw.Draw(img)

FB = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FR = "/System/Library/Fonts/Supplemental/Arial.ttf"
f_lbl = ImageFont.truetype(FB, 30 * SC)
f_sub = ImageFont.truetype(FR, 21 * SC)
f_band = ImageFont.truetype(FB, 18 * SC)
f_tag = ImageFont.truetype(FR, 18 * SC)

INK = (24, 32, 44)
MUTED = (95, 108, 125)
BAND = (152, 164, 180)
LINE = (140, 152, 170)

USERS = ((238, 242, 247), (150, 165, 185))
EXP = ((219, 234, 254), (62, 115, 200))
CORE = ((239, 249, 255), (80, 138, 195))
LIE = ((255, 243, 219), (201, 134, 18))
DATA = ((238, 242, 247), (132, 148, 168))
ANA = ((243, 244, 246), (138, 146, 158))
LLM = ((250, 246, 255), (150, 120, 190))


def s(v):
    return int(round(v * SC))


def ctext(cx, cy, txt, font, fill):
    lines = txt.split("\n")
    b0 = d.textbbox((0, 0), "Hg", font=font)
    lh = (b0[3] - b0[1]) + s(10)
    top = cy - (len(lines) - 1) * lh / 2
    for i, ln in enumerate(lines):
        b = d.textbbox((0, 0), ln, font=font)
        d.text((cx - (b[2] - b[0]) / 2 - b[0], top + i * lh - (b[3] - b[1]) / 2 - b[1]),
               ln, font=font, fill=fill)


def ttext(cx, top_y, txt, font, fill):
    """top-anchored, so 1-line and 2-line titles align"""
    b0 = d.textbbox((0, 0), "Hg", font=font)
    lh = (b0[3] - b0[1]) + s(10)
    for i, ln in enumerate(txt.split("\n")):
        b = d.textbbox((0, 0), ln, font=font)
        d.text((cx - (b[2] - b[0]) / 2 - b[0], top_y + i * lh - b[1]), ln, font=font, fill=fill)


def box(x1, y1, x2, y2, colors, label, sub=None, dash=False):
    fill, border = colors
    d.rounded_rectangle([s(x1), s(y1), s(x2), s(y2)], radius=s(10),
                        fill=fill, outline=border, width=s(3))
    if dash:  # overlay white dashes on the border to fake a dashed outline
        for x in range(int(x1) + 12, int(x2) - 8, 18):
            d.line([s(x), s(y1), s(x + 8), s(y1)], fill=(255, 255, 255), width=s(3))
            d.line([s(x), s(y2), s(x + 8), s(y2)], fill=(255, 255, 255), width=s(3))
        for y in range(int(y1) + 12, int(y2) - 8, 18):
            d.line([s(x1), s(y), s(x1), s(y + 8)], fill=(255, 255, 255), width=s(3))
            d.line([s(x2), s(y), s(x2), s(y + 8)], fill=(255, 255, 255), width=s(3))
    cx = s((x1 + x2) / 2)
    if sub:
        ctext(cx, s(y1 + (y2 - y1) * 0.37), label, f_lbl, INK)
        ctext(cx, s(y1 + (y2 - y1) * 0.72), sub, f_sub, MUTED)
    else:
        ctext(cx, s((y1 + y2) / 2), label, f_lbl, INK)


def head(cx, y):
    d.polygon([(s(cx), s(y)), (s(cx - 8), s(y - 13)), (s(cx + 8), s(y - 13))], fill=LINE)


def varrow(cx, y1, y2, dashed=False):
    if dashed:
        y = y1
        while y < y2 - 13:
            d.line([s(cx), s(y), s(cx), s(min(y + 9, y2 - 13))], fill=LINE, width=s(3))
            y += 17
    else:
        d.line([s(cx), s(y1), s(cx), s(y2 - 11)], fill=LINE, width=s(3))
    head(cx, y2)


def band(y, txt):
    d.text((s(24), s(y)), txt, font=f_band, fill=BAND, spacing=s(6))


L, R = 172, 1742
NB = 5
GAP = 22
BW = (R - L - GAP * (NB - 1)) / NB
def bx(i): return L + i * (BW + GAP)
def bc(i): return bx(i) + BW / 2

BUS = (bc(0) + bc(3)) / 2

# ---- Users ----
band(74, "USERS")
box(L, 52, 855, 152, USERS, "Student", "Classes 6–8")
box(1060, 52, R, 152, USERS, "Parent / Guardian", "Progress, milestones, weekly summary")
varrow((L + 855) / 2, 152, 232)
varrow((1060 + R) / 2, 152, 232)

# ---- Experience ----
band(272, "EXPERIENCE")
box(L, 232, R, 342, EXP, "Dagar Learning Experience",
    "Mobile-first web app  ·  curriculum dashboard, micro-lessons, practice, quiz, progress, parent view")

# distribution bus into core services
varrow(BUS, 342, 386)
d.line([s(bc(0)), s(396), s(bc(3)), s(396)], fill=LINE, width=s(3))
d.line([s(BUS), s(386), s(BUS), s(396)], fill=LINE, width=s(3))
for i in range(4):
    varrow(bc(i), 396, 432)

# ---- Core services ----
band(486, "CORE\nSERVICES")
specs = [
    ("Curriculum\nEngine", "Organises grade,\nchapter and lesson"),
    ("AI Tutor", "Contextual explanations\nand guidance"),
    ("Assessment\nEngine", "Delivers and evaluates\npractice and quizzes"),
    ("Progress\nEngine", "Tracks progress, mastery\nand consistency"),
]
TOP, BOT = 432, 578
for i, (lab, sub) in enumerate(specs):
    d.rounded_rectangle([s(bx(i)), s(TOP), s(bx(i) + BW), s(BOT)], radius=s(10),
                        fill=CORE[0], outline=CORE[1], width=s(3))
    ttext(s(bc(i)), s(452), lab, f_lbl, INK)
    ctext(s(bc(i)), s(538), sub, f_sub, MUTED)

box(bx(4), TOP, R, BOT, LLM, "Claude LLM",
    "External  ·  powers\nthe AI Tutor", dash=True)

# collect from core -> LIE
for i in range(4):
    d.line([s(bc(i)), s(BOT), s(bc(i)), s(614)], fill=LINE, width=s(3))
d.line([s(bc(0)), s(614), s(bc(3)), s(614)], fill=LINE, width=s(3))
varrow(BUS, 614, 656)

# ---- Learning Intelligence Engine ----
band(704, "INTELLIGENCE")
box(L, 656, R, 778, LIE, "Learning Intelligence Engine",
    "Maintains the learner profile and personalises every stage — next lesson, explanation depth,\npractice difficulty, revision and mentor escalation")
varrow(BUS, 778, 852)

# ---- Data ----
band(902, "DATA")
box(L, 852, R, 962, DATA, "Curriculum Content        ·        Learner Profile & Concept Mastery",
    "Chapters, lessons, question bank  ·  attempts, quiz history, streaks, milestones")

# ---- Analytics (dashed: fed by every layer) ----
varrow(BUS, 962, 1036, dashed=True)
d.text((s(BUS + 18), s(978)), "events from every layer", font=f_tag, fill=BAND)
band(1084, "MEASUREMENT")
box(L, 1036, R, 1146, ANA, "Analytics Layer",
    "Captures product events for continuous improvement  ·  feeds the MVP validation plan")

img.resize((W, H), Image.LANCZOS).save("architecture.png")
print("saved architecture.png", W, "x", H)
