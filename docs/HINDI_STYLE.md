# Dagar — Hindi Style Guide

Load this before any Hindi authoring or translation.

---

## The default: copy the NCERT Hindi textbook

> **Write the Hindi of the learner's own NCERT Hindi maths textbook.**

A Hindi-medium learner reads that book every day. It is already written for their
age by people who do this professionally, and matching it means the app and the
textbook reinforce each other instead of competing. Deviating from it adds
cognitive load for no gain.

This covers the large majority of Dagar's content: lesson bodies, question stems,
worked solutions, concept names.

**Anchor prompts to the real thing:** *"Write this the way the NCERT Class 6 Ganit
(Hindi) textbook writes it."* That is a checkable target — you can open the actual
book and compare.

### Maths vocabulary is NCERT's, always

भिन्न · पूर्णांक · समीकरण · हर · अंश · गुणनफल · भाजक · समतुल्य

Never simplify these into English transliterations ("फ्रैक्शन"). The learner needs
Dagar's words to match the words in their exam.

### Exercise instructions follow NCERT too

NCERT uses the polite imperative for exercises — **हल कीजिए**, **ज्ञात कीजिए**,
**सरल कीजिए**. Question stems use that form. It is what the learner already reads.

---

## The exception: content the textbook doesn't have

A textbook has no buttons, no error messages, no streak counter — and it never asks
the learner a question and waits. For these surfaces there is no NCERT register to
copy, so they are written **conversationally**.

| Surface | Register | Why |
|---|---|---|
| Lesson bodies, question stems, solutions | **NCERT textbook** | Direct equivalent exists — match it |
| Buttons, nav, labels, toasts, errors | **Everyday spoken** | No textbook equivalent |
| AI Tutor dialogue | **Everyday spoken, तुम** | It is a conversation, not a passage |
| Encouragement and feedback | **Everyday spoken, warm** | Textbooks don't cheer |
| Parent WhatsApp summary | **Everyday spoken, आप** | Adult reader, addressed respectfully |

So: a question reads **`हल कीजिए: 1/2 + 1/4`** (NCERT), while the tutor answering a
confused learner says **`कोई बात नहीं, फिर से देखते हैं`** (conversation). Both are
correct in their place. Mixing them up in either direction is the error.

### For the conversational surfaces only

- **तुम**, not आप — Dagar means *companion*, and आप is polite distance.
  (Parent-facing copy uses आप; that reader is an adult.)
- Everyday words: **सवाल** over प्रश्न, **जवाब** over उत्तर, **गलती** over त्रुटि,
  **फिर से** over पुनः. Drop **कृपया** entirely — it makes an app sound like a form.
- Keep the English words children genuinely say, written in Devanagari:
  **प्रैक्टिस · चैप्टर · लेवल · ट्राई करो**. Do not "correct" them into अभ्यास,
  अध्याय, स्तर — that is harder to read, not more correct.
- Never mix Latin script mid-sentence (`फिर से try करो` → `फिर से ट्राई करो`).

### Feedback copy

| Situation | Write |
|---|---|
| Correct | **सही! 🎉** / **बढ़िया!** / **शाबाश!** |
| Not quite | **अरे, थोड़ा सा रह गया — ये देखो** |
| Hint offered | **एक हिंट लोगे?** |
| Streak broken | **आज से नया शुरू करते हैं** |
| Struggling | **कोई बात नहीं, ये सबको मुश्किल लगता है** |
| System error | **कुछ गड़बड़ हो गई। फिर से कोशिश करो?** |

Never `असफल` or `आप असफल रहे`. The amber-not-red rule from `saathi-design` applies
to words as much as to colour.

---

## Mechanical rules (apply everywhere)

- **Numerals stay Arabic** — `1/2`, never `१/२`. NCERT Hindi maths editions use
  Arabic numerals and KaTeX renders them regardless.
- **KaTeX blocks pass through byte-identical** — `$x + 3 = 7$` is never touched.
- **`answer_value` is never translated** (D16). Hindi never touches the grading path.
- **Cultural contexts survive translation** — rupees and cricket, not dollars and pizza.
- **Missing translation falls back to English**, never an empty screen.

---

## Checklist before seeding a Hindi row

- [ ] Lesson/question text reads like the NCERT Class *N* Hindi textbook
- [ ] Maths terms are NCERT's, not transliterated English
- [ ] Conversational surfaces use तुम (learner) / आप (parent) — no mixing within one
- [ ] Numerals Arabic; KaTeX identical to the English source
- [ ] No Latin script mid-sentence
- [ ] `answer_value` untouched

## The check that actually matters

**Show it to one Hindi-medium student or their parent and watch them read.** Ten
minutes of that beats every rule above. If they hesitate or ask what a word means,
that sentence is wrong however correct it looks.
