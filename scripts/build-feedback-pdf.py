"""
The feedback report as a PDF, laid out to match the pitch deck.

    npm run feedback:export        # refresh the data first
    python3 scripts/build-feedback-pdf.py

    → docs/deck/Dagar-Feedback-Report.pdf

── WHERE THE DATA COMES FROM ───────────────────────────────────────────────────
`feedback-export/feedback.csv`, written by `scripts/export-feedback.ts`. That
script owns the query and, more importantly, the masking: no names, no email
addresses, and `user_ref` truncated to eight characters. Several respondents are
children, so this file re-reads that output rather than going back to the
database and risking a second, less careful, path to the same rows.

── WHAT IT IS FOR ──────────────────────────────────────────────────────────────
Submitted alongside the deck as the underlying evidence for slides 20 and 25.
Every response is printed in full, including the critical ones and the one
person who said they would not come back, because a feedback report with the
bad rows removed is not evidence of anything.
"""
import csv
import pathlib
from collections import Counter

from reportlab.lib.colors import Color
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

SRC = pathlib.Path("feedback-export/feedback.csv")
OUT = pathlib.Path("docs/deck/Dagar-Feedback-Report.pdf")

# The deck's palette, so the two documents look like they come from one place.
INK = Color(0.10, 0.15, 0.20)
BODY = Color(0.25, 0.29, 0.34)
MUTED = Color(0.36, 0.40, 0.45)
PRIMARY = Color(0.06, 0.46, 0.43)
AMBER = Color(0.71, 0.32, 0.04)
RULE = Color(0.85, 0.87, 0.89)
WASH = Color(0.94, 0.97, 0.96)

W, H = A4
M = 48
LEAD = 13

LABELS = {
    "yes": "Yes", "a_bit": "A bit", "no": "No", "not_really": "Not really",
    "student": "Student", "parent": "Parent", "teacher": "Teacher",
    "other": "Other", "chapters": "More chapters",
    "practice": "More practice questions", "tutor": "A better tutor",
}


def label(value):
    return LABELS.get((value or "").strip(), (value or "—").strip() or "—")


class Report:
    def __init__(self, path):
        self.c = canvas.Canvas(str(path), pagesize=A4)
        self.c.setTitle("Dagar — User Feedback Report")
        self.c.setAuthor("Akriti Panwar")
        self.y = H - M
        self.page = 1
        self._footer()

    def _footer(self):
        self.c.setFillColor(MUTED)
        self.c.setFont("Helvetica", 7.5)
        self.c.drawString(M, 24, "Dagar  ·  User feedback, collected in-app")
        self.c.drawRightString(W - M, 24, str(self.page))

    def space(self, need):
        """Start a new page when `need` points will not fit."""
        if self.y - need < M + 12:
            self.c.showPage()
            self.page += 1
            self.y = H - M
            self._footer()

    def heading(self, text, size=13, colour=INK, gap=8):
        self.space(size + gap + 6)
        self.c.setFillColor(colour)
        self.c.setFont("Helvetica-Bold", size)
        self.c.drawString(M, self.y - size, text)
        self.y -= size + gap

    def para(self, text, size=9.5, colour=BODY, indent=0, gap=6):
        for line in simpleSplit(text, "Helvetica", size, W - 2 * M - indent):
            self.space(LEAD)
            self.c.setFillColor(colour)
            self.c.setFont("Helvetica", size)
            self.c.drawString(M + indent, self.y - size, line)
            self.y -= LEAD
        self.y -= gap

    def bar(self, name, n, total, colour=PRIMARY):
        self.space(18)
        self.c.setFillColor(BODY)
        self.c.setFont("Helvetica", 9)
        self.c.drawString(M, self.y - 9, name)
        x, track = M + 150, 240
        self.c.setFillColor(WASH)
        self.c.rect(x, self.y - 10, track, 8, stroke=0, fill=1)
        if n:
            self.c.setFillColor(colour)
            self.c.rect(x, self.y - 10, track * n / max(total, 1), 8,
                        stroke=0, fill=1)
        self.c.setFillColor(colour if n else MUTED)
        self.c.setFont("Helvetica-Bold", 9)
        self.c.drawString(x + track + 8, self.y - 9, str(n))
        self.y -= 16

    def rule(self, gap=10):
        self.space(gap + 2)
        self.c.setStrokeColor(RULE)
        self.c.setLineWidth(0.6)
        self.c.line(M, self.y, W - M, self.y)
        self.y -= gap

    def save(self):
        self.c.save()


def main():
    if not SRC.exists():
        raise SystemExit("run `npm run feedback:export` first")
    rows = list(csv.DictReader(SRC.open()))

    r = Report(OUT)

    r.c.setFillColor(PRIMARY)
    r.c.setFont("Helvetica-Bold", 8)
    r.c.drawString(M, r.y - 8, "DAGAR")
    r.y -= 22
    r.heading("What our users told us", size=20, gap=6)
    r.para(
        f"Every one of the {len(rows)} responses below was left inside the "
        "product by a signed-in account that had used it. Nobody is reacting "
        "to a screenshot or a demo. Spelling and grammar are exactly as they "
        "were typed, and nothing has been left out, including the criticism.",
        size=10, colour=BODY, gap=4)
    r.para(
        "No names or email addresses appear in this report. Several "
        "respondents are children aged 11 to 14 and under the DPDP Act 2023 "
        "they are minors, so each row carries only a truncated reference, "
        "enough to show the responses came from distinct people.",
        size=9, colour=MUTED, gap=10)
    r.rule()

    understood = Counter(x["understood"] for x in rows)
    again = Counter(x["would_use_again"] for x in rows)
    improve = Counter(x["improve_most"] for x in rows)
    who = Counter(x["respondent"] for x in rows)
    total = len(rows)
    helped = understood["yes"] + understood["a_bit"]

    r.heading("The numbers", size=13)
    r.para(f"{helped} of {total} said Dagar helped them understand something. "
           f"{again['yes']} of {total} would use it again.",
           size=10, colour=INK, gap=10)

    r.heading("Did it help you understand something?", size=10, colour=MUTED,
              gap=6)
    for key in ("yes", "a_bit", "no"):
        r.bar(label(key), understood.get(key, 0), total,
              PRIMARY if key == "yes" else AMBER)
    r.y -= 6

    r.heading("Would you use Dagar again?", size=10, colour=MUTED, gap=6)
    for key in ("yes", "no"):
        r.bar(label(key), again.get(key, 0), total,
              PRIMARY if key == "yes" else AMBER)
    r.y -= 6

    r.heading("If we could do only ONE more thing", size=10, colour=MUTED,
              gap=6)
    for key, n in improve.most_common():
        r.bar(label(key), n, total)
    r.y -= 6

    r.heading("Who answered", size=10, colour=MUTED, gap=6)
    for key, n in who.most_common():
        r.bar(label(key), n, total)

    r.rule(gap=14)
    r.heading("Every response, in full", size=13)
    r.para("Ordered as collected. A dash means the question was left blank.",
           size=9, colour=MUTED, gap=10)

    for i, row in enumerate(rows, 1):
        worked = (row.get("what_worked") or "").strip()
        confused = (row.get("what_confused") or "").strip()
        block = 34 + (len(worked) + len(confused)) // 90 * LEAD
        r.space(block)

        r.c.setFillColor(PRIMARY)
        r.c.setFont("Helvetica-Bold", 9)
        r.c.drawString(M, r.y - 9,
                       f"{i:02d}  {label(row['respondent']).upper()}")
        r.c.setFillColor(MUTED)
        r.c.setFont("Helvetica", 8)
        r.c.drawRightString(
            W - M, r.y - 9,
            f"{row['date']}  ·  {row['language']}  ·  ref {row['user_ref']}")
        r.y -= 16

        # Separated with a middot, not runs of spaces: the line wrapper
        # collapses whitespace, so three fields ran together into one sentence.
        r.para(
            f"Understood: {label(row['understood'])}  ·  "
            f"Would use again: {label(row['would_use_again'])}  ·  "
            f"Wants most: {label(row['improve_most'])}",
            size=8.5, colour=BODY, gap=4)

        if worked:
            r.para(f"What worked:  “{worked}”", size=9, colour=INK,
                   indent=10, gap=3)
        if confused:
            r.para(f"What confused them:  “{confused}”", size=9, colour=INK,
                   indent=10, gap=3)
        if not worked and not confused:
            r.para("No written comment.", size=9, colour=MUTED, indent=10,
                   gap=3)
        r.rule(gap=8)

    r.save()
    size = OUT.stat().st_size / 1000
    print(f"wrote {OUT}  ({len(rows)} responses, {size:.0f} KB)")


if __name__ == "__main__":
    main()
