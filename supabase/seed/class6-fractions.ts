import type { SeedChapter } from "./types.ts";

/**
 * Class 6 · Fractions · slice 1.2
 *
 * Concept order follows how the textbook TEACHES the material, not the chapter
 * numbering — the sequence is stable across editions, the numbering is not (D1):
 *
 *   parts of a whole → fractional units → number line → mixed fractions
 *   → EQUIVALENT FRACTIONS → simplest form → comparing → addition → subtraction
 *
 * Four concepts cannot hold nine sections. **Mixed fractions is the deliberate
 * cut** — it is the only one nothing else here depends on. Equivalent fractions
 * and simplest form are paired because NCERT teaches them back to back and
 * simplest form has no gradeable question type of its own (see the note at the
 * bottom of this file).
 *
 * Coverage: 2 practice questions at each difficulty for every concept, so
 * adaptivity (D3: 2 right → step up, 2 wrong → step down) always has somewhere to
 * go. Plus 8 quiz questions, 2 per concept.
 *
 * English only. Hindi goes into the `i18n` jsonb in slice 1.6 — and when an
 * English `body_md` changes, the Hindi changes in the SAME commit or the two drift.
 */
export const class6Fractions: SeedChapter = {
  slug: "class6-fractions",
  grade: 6,
  number: 7,
  title: "Fractions",
  summary:
    "What fractions mean, how to spot equal fractions, how to compare them, and how to add and subtract them.",
  ncert_ref:
    "Ganita Prakash Class 6 Ch 7 (Fractions) · old NCERT Class 6 Ch 7 (Fractions)",
  // 2, not 1: Fractions is Ganita Prakash Ch 7 and Data Handling is Ch 4, so a
  // Class 6 learner meets them in the order their own book has them.
  order_index: 2,

  concepts: [
    { slug: "fraction-basics", name: "Fraction Basics", order_index: 1 },
    { slug: "equivalent-fractions", name: "Equivalent Fractions", order_index: 2 },
    { slug: "comparing-fractions", name: "Comparing Fractions", order_index: 3 },
    {
      slug: "adding-subtracting-fractions",
      name: "Adding and Subtracting Fractions",
      order_index: 4,
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // LESSONS — one idea each. If a lesson needs "and also", it is two lessons.
  // ═══════════════════════════════════════════════════════════════════════════
  lessons: [
    {
      slug: "c6-fractions-l1",
      concept_slug: "fraction-basics",
      order_index: 1,
      title: "What a Fraction Really Means",
      est_minutes: 4,
      body_md: [
        "Two rotis, four people. Nobody gets a whole roti — so how do you say how much each person gets?",
        "",
        "That is what fractions are for. A fraction names **a part of a whole**.",
        "",
        "Cut one roti into 4 equal pieces and take 1 piece. You have taken $1/4$ of the roti.",
        "",
        "The two numbers do different jobs:",
        "",
        "- The **bottom** number (the *denominator*) says how many equal parts the whole was cut into.",
        "- The **top** number (the *numerator*) says how many of those parts you took.",
        "",
        "So in $3/8$, the whole was cut into 8 equal parts and you have 3 of them.",
        "",
        "**The word *equal* is doing real work here.** If you break a roti into 4 pieces and one is huge and three are tiny, no piece is $1/4$. The parts must be the same size.",
        "",
        "### Worked example",
        "",
        "A bottle holds 5 glasses of water when it is full. You pour out 2 glasses.",
        "",
        "The whole is 5 equal parts, and you took 2 of them:",
        "",
        "$$\n\\frac{2}{5} \\text{ of the bottle}\n$$",
        "",
        "And what is left in the bottle? 3 parts out of 5, so $3/5$.",
        "",
        "Notice that $2/5$ and $3/5$ together make the whole bottle — all 5 parts.",
        "",
        "Try a few in practice, then come back for the number line.",
      ].join("\n"),

      // ═══════════════════════════════════════════════════════════════════════
      // THE INTERACTIVE VERSION (D18).
      //
      // The prose above stays — it is the fallback, and it is what renders if
      // anything below fails validation. Nothing was deleted.
      //
      // Concrete → Pictorial → Abstract: the roti is cut before "1/4" is ever
      // written down. The old lesson said "cut one roti into 4 equal pieces"
      // and showed nothing, which is the sentence that started all of this.
      //
      // Inline fractions are SLASHED, not stacked (backlog 0c) — a stacked
      // \frac in running text has no good size on a 360px screen.
      // ═══════════════════════════════════════════════════════════════════════
      steps: [
        {
          kind: "see",
          md: "One roti. Four people. Nobody gets a whole one.",
          viz: { kind: "partWhole", shape: "circle", parts: 1, shaded: 1 },
        },
        {
          // First interaction is on step 2, before any notation. The learner
          // does the cutting the old lesson only described.
          kind: "build",
          md: "Cut it into 4 equal pieces. Tap one piece to take it.",
          viz: { kind: "partWhole", shape: "circle", parts: 4, shaded: 0, target: [0] },
        },
        {
          // Only NOW does the notation appear, on a picture that earned it.
          kind: "see",
          md: "You took 1 piece out of 4 equal pieces. We write that as $1/4$.",
          viz: { kind: "partWhole", shape: "circle", parts: 4, shaded: 1, label: "1/4" },
        },
        {
          // NCERT vocabulary is kept — हर and अंश are the words in their
          // textbook and their exam. Asked as a question rather than stated,
          // because a definition read is a definition skimmed.
          kind: "reveal",
          md: "In $1/4$, what is the 4 telling you?",
          answer: "How many equal parts the whole was cut into. Its name is the **denominator**.",
          viz: { kind: "partWhole", shape: "circle", parts: 4, shaded: 1, label: "1/4" },
        },
        {
          kind: "tap",
          md: "Which one shows $3/8$?",
          options: [
            // Wrong options encode real mistakes: right numerator wrong
            // denominator, and right denominator wrong numerator.
            { viz: { kind: "partWhole", shape: "bar", parts: 4, shaded: 3 } },
            { viz: { kind: "partWhole", shape: "bar", parts: 8, shaded: 3 } },
            { viz: { kind: "partWhole", shape: "bar", parts: 8, shaded: 5 } },
          ],
          answer: 1,
          why: "Eight equal parts, and three of them taken.",
        },
        {
          // The "equal" rule. No diagram, because PartWhole can only draw equal
          // parts — an unequal one would have to be faked, and a faked diagram
          // in a maths lesson is worse than none.
          kind: "reveal",
          md: "You break a roti into 4 pieces. One is huge, three are tiny. Is the big piece $1/4$?",
          answer: "No. The parts have to be **equal**, or it is not a fraction at all.",
        },
        {
          kind: "see",
          md: "A bottle holds 5 glasses. You pour out 2 glasses.",
          viz: { kind: "partWhole", shape: "bar", parts: 5, shaded: 2, label: "2/5" },
        },
        {
          kind: "reveal",
          md: "So how much is still in the bottle?",
          answer: "3 parts out of 5. That is $3/5$ — and $2/5$ and $3/5$ together make the whole bottle.",
          viz: { kind: "partWhole", shape: "bar", parts: 5, shaded: 3, label: "3/5" },
        },
      ],
    },
    {
      slug: "c6-fractions-l2",
      concept_slug: "fraction-basics",
      order_index: 2,
      title: "Fractions on the Number Line",
      est_minutes: 4,
      body_md: [
        "Fractions are not only pieces of roti. They are **numbers**, and every number has a place on the number line.",
        "",
        "$1/2$ is not a piece of something. It is a number that sits exactly halfway between 0 and 1.",
        "",
        "### How to find a fraction on the line",
        "",
        "To place $3/5$:",
        "",
        "1. Look at the **bottom** number, 5. Cut the gap from 0 to 1 into 5 equal parts.",
        "2. Look at the **top** number, 3. Count 3 parts along from 0.",
        "3. You have landed on $3/5$.",
        "",
        "```",
        "0 ....|....|....|....|....| 1",
        "     1/5  2/5  3/5  4/5",
        "```",
        "",
        "The bottom number tells you **how big each step is**. The top number tells you **how many steps to take**.",
        "",
        "### Something worth noticing",
        "",
        "The bigger the bottom number, the *smaller* each step. Cutting the same gap into 8 parts makes smaller steps than cutting it into 3.",
        "",
        "So $1/8$ sits closer to 0 than $1/3$ does — even though 8 is a bigger number than 3.",
        "",
        "This is the single most common place learners slip, and it is worth holding on to. A bigger bottom number means more parts, and more parts means each one is smaller.",
        "",
        "$$\n\\frac{5}{5} = 1 \\qquad \\frac{0}{5} = 0\n$$",
        "",
        "When the top and bottom are the same, you have taken every part — the whole thing.",
      ].join("\n"),
      // Lesson 2 moves fractions off the plate and onto the line — the shift
      // from "a piece of something" to "a number". Every step is a number line
      // for that reason; a roti here would undo the point.
      steps: [
        {
          kind: "see",
          md: "A fraction is not only a piece of roti. It is a **number**. $1/2$ sits exactly halfway between 0 and 1.",
          viz: { kind: "numberLine", from: 0, to: 1, step: 1, divisions: 2, marks: [{ at: 0.5, label: "1/2" }] },
        },
        {
          kind: "see",
          md: "To place $3/5$, first cut the gap from 0 to 1 into 5 equal steps.",
          viz: { kind: "numberLine", from: 0, to: 1, step: 1, divisions: 5 },
        },
        {
          kind: "reveal",
          md: "Now count 3 steps along from 0. Where do you land?",
          answer: "On $3/5$. The bottom number sets the step size; the top number says how many steps.",
          viz: { kind: "numberLine", from: 0, to: 1, step: 1, divisions: 5, marks: [{ at: 0.6, label: "3/5" }] },
        },
        {
          kind: "tap",
          md: "Which line shows $2/3$?",
          options: [
            { viz: { kind: "numberLine", from: 0, to: 1, step: 1, divisions: 3, marks: [{ at: 0.3333, label: "?" }] } },
            { viz: { kind: "numberLine", from: 0, to: 1, step: 1, divisions: 3, marks: [{ at: 0.6667, label: "?" }] } },
            { viz: { kind: "numberLine", from: 0, to: 1, step: 1, divisions: 2, marks: [{ at: 0.5, label: "?" }] } },
          ],
          answer: 1,
          why: "Three equal steps, and the mark is at the second one.",
        },
        {
          kind: "see",
          md: "The bigger the bottom number, the **smaller** each step. Here the same gap is cut into 8.",
          viz: { kind: "numberLine", from: 0, to: 1, step: 1, divisions: 8 },
        },
        {
          // The single most common slip in the chapter, so it is asked rather
          // than told — a learner who guesses wrong here remembers being wrong.
          kind: "reveal",
          md: "So which one sits closer to 0 — $1/8$ or $1/3$?",
          answer: "$1/8$, even though 8 is the bigger number. More parts means each part is smaller.",
          viz: {
            kind: "numberLine", from: 0, to: 1, step: 1,
            marks: [{ at: 0.125, label: "1/8" }, { at: 0.3333, label: "1/3", tone: "hint" }],
          },
        },
        {
          kind: "see",
          md: "When the top and bottom match, you have taken every part.",
          viz: { kind: "partWhole", shape: "bar", parts: 5, shaded: 5, label: "5/5 = 1" },
        },
        {
          kind: "reveal",
          md: "And $0/5$?",
          answer: "0. You took no parts at all.",
          viz: { kind: "partWhole", shape: "bar", parts: 5, shaded: 0, label: "0/5 = 0" },
        },
      ],
    },
    {
      slug: "c6-fractions-l3",
      concept_slug: "equivalent-fractions",
      order_index: 3,
      title: "Equal Fractions and Simplest Form",
      est_minutes: 5,
      body_md: [
        "Cut a roti in half and eat one half. Now cut the same roti into 4 pieces and eat 2. Did you eat more the second time?",
        "",
        "No — exactly the same amount. So:",
        "",
        "$$\n\\frac{1}{2} = \\frac{2}{4}\n$$",
        "",
        "Different numbers, same amount. These are called **equivalent fractions**.",
        "",
        "### The one rule",
        "",
        "> Multiply the top **and** the bottom by the same number, and the fraction does not change.",
        "",
        "$$\n\\frac{1}{2} = \\frac{1 \\times 3}{2 \\times 3} = \\frac{3}{6}\n$$",
        "",
        "It works going down as well, by dividing:",
        "",
        "$$\n\\frac{6}{8} = \\frac{6 \\div 2}{8 \\div 2} = \\frac{3}{4}\n$$",
        "",
        "**Adding does not work.** $1/2$ and $2/3$ are not equal, even though you added 1 to the top and 1 to the bottom. Only multiplying and dividing keep the value the same.",
        "",
        "### Simplest form",
        "",
        "A fraction is in its **simplest form** when the top and bottom have no common factor left to divide out.",
        "",
        "$$\n\\frac{12}{18} = \\frac{6}{9} = \\frac{2}{3}\n$$",
        "",
        "$2/3$ is as far as it goes — 2 and 3 share nothing. All three of those fractions are the same amount; $2/3$ is just the tidiest way to write it.",
        "",
        "### Worked example",
        "",
        "Fill the box: $2/5 = \\frac{\\square}{15}$",
        "",
        "The bottom went from 5 to 15, so it was multiplied by 3. Do the same on top: $2 \\times 3 = 6$.",
        "",
        "$$\n\\frac{2}{5} = \\frac{6}{15}\n$$",
      ].join("\n"),
      // Two shapes carry this whole lesson: the same roti cut two ways. The
      // `compare` prop is not used — showing them as two SEPARATE wholes is the
      // point, because the claim is that two different-looking things are one
      // amount.
      steps: [
        {
          kind: "see",
          md: "Cut a roti in half and eat one half.",
          viz: { kind: "partWhole", shape: "circle", parts: 2, shaded: 1, label: "1/2" },
        },
        {
          kind: "see",
          md: "Now cut the same roti into 4 and eat 2.",
          viz: { kind: "partWhole", shape: "circle", parts: 4, shaded: 2, label: "2/4" },
        },
        {
          kind: "tap",
          md: "Did you eat more the second time?",
          options: [
            { label: "Yes, 2 pieces beats 1" },
            { label: "No, exactly the same" },
          ],
          answer: 1,
          why: "Different numbers, same amount. These are **equivalent fractions**.",
        },
        {
          kind: "see",
          md: "The rule: multiply the top **and** the bottom by the same number, and nothing changes.",
          viz: { kind: "partWhole", shape: "bar", parts: 6, shaded: 3, label: "1/2 = 3/6" },
        },
        {
          kind: "reveal",
          md: "So does adding work too? Is $1/2$ the same as $2/3$?",
          answer: "No. Only multiplying and dividing keep the value. Adding 1 to each changes the amount.",
        },
        {
          kind: "tap",
          md: "Which one is another way of writing $1/2$?",
          options: [
            { viz: { kind: "partWhole", shape: "bar", parts: 5, shaded: 3 } },
            { viz: { kind: "partWhole", shape: "bar", parts: 6, shaded: 3 } },
            { viz: { kind: "partWhole", shape: "bar", parts: 8, shaded: 3 } },
          ],
          answer: 1,
          why: "Six parts, three taken. Half of 6 is 3.",
        },
        {
          kind: "see",
          md: "**Simplest form** is when nothing is left to divide out. $12/18 = 6/9 = 2/3$.",
          viz: { kind: "partWhole", shape: "grid", parts: 9, shaded: 6, label: "6/9 = 2/3" },
        },
        {
          kind: "reveal",
          md: "Fill the box: $2/5 = \\square/15$",
          answer: "6. The bottom was multiplied by 3, so the top is too: $2 \\times 3 = 6$.",
        },
      ],
    },
    {
      slug: "c6-fractions-l4",
      concept_slug: "comparing-fractions",
      order_index: 4,
      title: "Which Fraction Is Bigger?",
      est_minutes: 4,
      body_md: [
        "Anil ate $3/4$ of his roti. Bina ate $5/8$ of hers. Same size rotis. Who ate more?",
        "",
        "You cannot tell by looking, because the pieces are different sizes. Here is how to decide.",
        "",
        "### Case 1 — same bottom number",
        "",
        "Easy. The pieces are the same size, so just count them.",
        "",
        "$$\n\\frac{5}{7} > \\frac{3}{7}\n$$",
        "",
        "### Case 2 — same top number",
        "",
        "Compare the **bottom** numbers, and remember the rule from the number line: a bigger bottom means smaller pieces.",
        "",
        "$$\n\\frac{1}{4} > \\frac{1}{6}\n$$",
        "",
        "One piece out of 4 is bigger than one piece out of 6. This feels backwards, and it catches almost everybody the first time.",
        "",
        "### Case 3 — nothing matches",
        "",
        "Make the bottoms the same, using equivalent fractions. Back to Anil and Bina:",
        "",
        "$$\n\\frac{3}{4} = \\frac{6}{8}\n$$",
        "",
        "Now both are in eighths, so count: $6/8$ against $5/8$.",
        "",
        "$$\n\\frac{6}{8} > \\frac{5}{8}\n$$",
        "",
        "**Anil ate more.**",
        "",
        "### The trap",
        "",
        "It is tempting to say Bina ate more because both her numbers are bigger — 5 beats 3 and 8 beats 4. But a fraction is not two separate numbers. It is one amount, and the only way to compare amounts is to make the pieces the same size first.",
      ].join("\n"),
      // Bars throughout, not circles. Comparing is the entire lesson, and two
      // bars stack with the same left edge and the same width — two circles do
      // not compare at all.
      steps: [
        {
          kind: "see",
          md: "Anil ate $3/4$ of his roti.",
          viz: { kind: "partWhole", shape: "bar", parts: 4, shaded: 3, label: "3/4" },
        },
        {
          kind: "see",
          md: "Bina ate $5/8$ of hers. Same size roti.",
          viz: { kind: "partWhole", shape: "bar", parts: 8, shaded: 5, label: "5/8" },
        },
        {
          kind: "reveal",
          md: "Can you tell who ate more just by looking?",
          answer: "Not easily — the pieces are different sizes. Make the pieces match first.",
        },
        {
          kind: "see",
          md: "Same bottom number is easy. The pieces match, so just count them: $5/7 > 3/7$.",
          viz: { kind: "partWhole", shape: "bar", parts: 7, shaded: 5, label: "5/7" },
        },
        {
          // Catches almost everybody the first time, so it is a tap rather than
          // a sentence — being wrong here is what makes it stick.
          kind: "tap",
          md: "Which is bigger: $1/4$ or $1/6$?",
          options: [
            { viz: { kind: "partWhole", shape: "bar", parts: 4, shaded: 1 } },
            { viz: { kind: "partWhole", shape: "bar", parts: 6, shaded: 1 } },
          ],
          answer: 0,
          why: "One piece out of 4 is bigger than one out of 6. A bigger bottom means smaller pieces.",
        },
        {
          kind: "see",
          md: "Back to Anil. Rewrite $3/4$ in eighths so both are in the same pieces.",
          viz: { kind: "partWhole", shape: "bar", parts: 8, shaded: 6, label: "3/4 = 6/8" },
        },
        {
          kind: "tap",
          md: "Now who ate more?",
          options: [{ label: "Anil, $6/8$" }, { label: "Bina, $5/8$" }],
          answer: 0,
          why: "Six eighths against five eighths. Same size pieces, so just count.",
        },
        {
          kind: "reveal",
          md: "Bina's numbers are both bigger — 5 beats 3, 8 beats 4. So why is she not ahead?",
          answer: "A fraction is **one amount**, not two separate numbers. Only compare once the pieces match.",
        },
      ],
    },
    {
      slug: "c6-fractions-l5",
      concept_slug: "adding-subtracting-fractions",
      order_index: 5,
      title: "Adding and Subtracting Fractions",
      est_minutes: 5,
      body_md: [
        "You drink $1/5$ of a bottle in the morning and $2/5$ at lunch. How much have you drunk?",
        "",
        "The pieces are all fifths, so just count them: 1 fifth plus 2 fifths is 3 fifths.",
        "",
        "$$\n\\frac{1}{5} + \\frac{2}{5} = \\frac{3}{5}\n$$",
        "",
        "### The bottom number does not change",
        "",
        "> Same bottom number: add or subtract the tops, and keep the bottom as it is.",
        "",
        "$$\n\\frac{4}{7} - \\frac{1}{7} = \\frac{3}{7}\n$$",
        "",
        "The bottom is not telling you *how much* — it is telling you **what size piece** you are counting. Counting 3 fifths does not turn them into tenths.",
        "",
        "**This is the mistake to avoid:**",
        "",
        "$$\n\\frac{1}{5} + \\frac{2}{5} \\neq \\frac{3}{10}\n$$",
        "",
        "### Different bottom numbers",
        "",
        "You cannot add fifths to quarters any more than you can add 3 apples to 2 mangoes and call the answer 5 apples. Make the pieces the same size first, using equivalent fractions.",
        "",
        "$$\n\\frac{1}{2} + \\frac{1}{4}\n$$",
        "",
        "Rewrite $1/2$ in quarters: $1/2 = 2/4$. Now they match.",
        "",
        "$$\n\\frac{2}{4} + \\frac{1}{4} = \\frac{3}{4}\n$$",
        "",
        "### Worked example",
        "",
        "A jug has $3/4$ litre of milk. Amma pours $1/3$ litre into the tea. How much is left?",
        "",
        "Quarters and thirds do not match. Twelfths work for both:",
        "",
        "$$\n\\frac{3}{4} = \\frac{9}{12} \\qquad \\frac{1}{3} = \\frac{4}{12}\n$$",
        "",
        "$$\n\\frac{9}{12} - \\frac{4}{12} = \\frac{5}{12}\n$$",
        "",
        "So $5/12$ litre of milk is left in the jug.",
      ].join("\n"),
      // The bottle is one whole all the way through, so a bar of fifths is the
      // same object in every step — which is what makes "the bottom does not
      // change" visible rather than asserted.
      steps: [
        {
          kind: "see",
          md: "You drink $1/5$ of a bottle in the morning.",
          viz: { kind: "partWhole", shape: "bar", parts: 5, shaded: 1, label: "1/5" },
        },
        {
          kind: "see",
          md: "And $2/5$ more at lunch.",
          viz: { kind: "partWhole", shape: "bar", parts: 5, shaded: 2, label: "2/5" },
        },
        {
          kind: "reveal",
          md: "How much have you drunk altogether?",
          answer: "$3/5$. One fifth plus two fifths is three fifths — you are just counting fifths.",
          viz: { kind: "partWhole", shape: "bar", parts: 5, shaded: 3, label: "3/5" },
        },
        {
          kind: "see",
          md: "The bottom does not change. It is not an amount — it says **what size piece** you are counting.",
          viz: { kind: "partWhole", shape: "bar", parts: 7, shaded: 3, label: "4/7 − 1/7 = 3/7" },
        },
        {
          kind: "tap",
          md: "So what is $1/5 + 2/5$?",
          options: [{ label: "$3/5$" }, { label: "$3/10$" }],
          answer: 0,
          why: "Counting three fifths does not turn them into tenths. The bottom stays.",
        },
        {
          kind: "see",
          md: "Different bottoms cannot be added — like adding 3 apples to 2 mangoes and calling it 5 apples.",
          viz: { kind: "partWhole", shape: "bar", parts: 4, shaded: 1, label: "1/4" },
        },
        {
          kind: "reveal",
          md: "$1/2 + 1/4$. Rewrite $1/2$ in quarters first.",
          answer: "$1/2 = 2/4$. Now they match: $2/4 + 1/4 = 3/4$.",
          viz: { kind: "partWhole", shape: "bar", parts: 4, shaded: 3, label: "3/4" },
        },
        {
          kind: "reveal",
          md: "A jug holds $3/4$ litre. Amma pours out $1/3$ litre. How much is left?",
          answer: "Twelfths fit both: $9/12 - 4/12 = 5/12$ litre.",
          viz: { kind: "partWhole", shape: "grid", parts: 12, shaded: 5, label: "5/12" },
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  questions: [
    {
      slug: "c6-eqf-d2-q4",
      concept_slug: "equivalent-fractions",
      kind: "practice",
      difficulty: 2,
      answer_type: "fraction",
      stem_md: "Which picture shows $6/8$?",
      answer_value: "6/8",
      input: {
        kind: "choiceViz",
        options: [
          { value: "6/8", viz: { kind: "partWhole", shape: "bar", parts: 8, shaded: 6 } },
          // Shaded what is LEFT OVER. The single most common slip in the whole
          // chapter, and the one worth meeting again at difficulty 2 — knowing
          // the rule and still reading the wrong part of the picture are
          // different failures.
          { value: "2/8", viz: { kind: "partWhole", shape: "bar", parts: 8, shaded: 2 } },
          // Miscounted by one. Not a misunderstanding — just what happens when
          // eight narrow pieces are counted with a thumb in the way, and worth
          // making the learner look twice.
          { value: "5/8", viz: { kind: "partWhole", shape: "bar", parts: 8, shaded: 5 } },
        ],
      },
      solution_md: [
        "Read the **bottom** first: how many equal pieces is the whole cut into? Eight.",
        "",
        "Then the **top**: how many are filled? Six.",
        "",
        "The two left empty are not part of the answer. They are what is *not* taken, and $2/8$ is the answer to a different question.",
      ].join("\n"),
    },
    {
      slug: "c6-add-d2-q3",
      concept_slug: "adding-subtracting-fractions",
      kind: "practice",
      difficulty: 2,
      answer_type: "fraction",
      stem_md: "$$\n\\frac{3}{4} - \\frac{1}{4}\n$$\n\nWhich picture shows the answer?",
      answer_value: "2/4",
      input: {
        kind: "choiceViz",
        options: [
          { value: "2/4", viz: { kind: "partWhole", shape: "bar", parts: 4, shaded: 2 } },
          // Subtracted the bottoms as well: 3-1 over 4-4... which is nothing, so
          // the nearest wrong picture a learner actually draws is quarters
          // turning into something smaller.
          { value: "2/8", viz: { kind: "partWhole", shape: "bar", parts: 8, shaded: 2 } },
          // Added instead of subtracting.
          { value: "4/4", viz: { kind: "partWhole", shape: "bar", parts: 4, shaded: 4 } },
        ],
      },
      solution_md: [
        "Both are **quarters**, so the pieces are already the same size. Start with 3 of them and take 1 away.",
        "",
        "$$\n\\frac{3}{4} - \\frac{1}{4} = \\frac{2}{4}\n$$",
        "",
        "The bottom stays 4 throughout. Taking pieces away does not make the remaining pieces smaller — there are just fewer of them.",
      ].join("\n"),
    },
    // ── SHADE — the learner MAKES the fraction rather than recognising one ────
    {
      slug: "c6-eqf-d1-q4",
      concept_slug: "equivalent-fractions",
      kind: "practice",
      // Difficulty 1, deliberately. MAKING a fraction is easier than naming one:
      // the learner fills parts until it looks like a half, which is a thing they
      // can do before they can read `2/4`. Putting the pictorial kinds behind two
      // correct answers would gate the easiest input on the hardest questions.
      difficulty: 1,
      answer_type: "fraction",
      stem_md: "Shade **half** of this bar.",
      answer_value: "1/2",
      // Four parts for a question about halves, deliberately. The learner shades
      // 2 and submits `2/4`, which D3 already grades correct against `1/2` — so
      // the equivalence they just learned is what makes their answer right,
      // rather than a rule they have to remember to apply.
      input: { kind: "shade", shape: "bar", parts: 4 },
      solution_md: [
        "Half means the filled part and the empty part are the **same size**.",
        "",
        "The bar is in 4 pieces, so half of it is **2** of them.",
        "",
        "$$\n\\frac{2}{4} = \\frac{1}{2}\n$$",
        "",
        "Both are right. $2/4$ is what you shaded; $1/2$ is the same amount written in fewer pieces.",
      ].join("\n"),
    },
    {
      slug: "c6-fb-d2-q4",
      concept_slug: "fraction-basics",
      kind: "practice",
      difficulty: 2,
      answer_type: "fraction",
      stem_md: "Shade $3/8$ of this grid.",
      answer_value: "3/8",
      input: { kind: "shade", shape: "grid", parts: 8 },
      solution_md: [
        "The **bottom** number is how many equal parts there are — the grid already has 8.",
        "",
        "The **top** number is how many to fill. That is 3.",
        "",
        "Which three you pick does not matter. A fraction counts parts; it does not care where they sit.",
      ].join("\n"),
    },
    // ─────────────────────────────────────────────────────────────────────────
    // PICTORIAL RECOGNITION (D18 slice 5.2)
    //
    // These are ADDITIONS, not conversions. Rewriting the comparison MCQs as
    // pictures was considered and rejected: a bar of 1/4 beside a bar of 1/6
    // hands over the answer, and the whole worth of that question is that it
    // catches the "6 is bigger than 4, so 1/6 is bigger" mistake by making the
    // learner reason. A picture would remove exactly the thinking it tests.
    //
    // What was missing instead is the other direction — read the notation, find
    // its picture. That is the concrete↔abstract link the entire slice is about,
    // and nothing in the bank tested it.
    //
    // Diagrams are never translated (D18 §6): a bar cut into eight is a bar cut
    // into eight in both languages. Only the stem and the solution have Hindi.
    // ─────────────────────────────────────────────────────────────────────────
    {
      slug: "c6-fb-d1-q3",
      concept_slug: "fraction-basics",
      kind: "practice",
      difficulty: 1,
      answer_type: "fraction",
      stem_md: "Which picture shows $3/8$?",
      answer_value: "3/8",
      input: {
        kind: "choiceViz",
        options: [
          { value: "3/8", viz: { kind: "partWhole", shape: "bar", parts: 8, shaded: 3 } },
          // Shaded what is LEFT rather than what is taken — the same slip as
          // answering 3/4 for the roti question.
          { value: "5/8", viz: { kind: "partWhole", shape: "bar", parts: 8, shaded: 5 } },
          // Right top number, wrong number of parts: read only the 3.
          { value: "3/5", viz: { kind: "partWhole", shape: "bar", parts: 5, shaded: 3 } },
        ],
      },
      solution_md: [
        "The **bottom** number says how many equal parts the whole is cut into. For $3/8$ that is 8 parts.",
        "",
        "The **top** number says how many of them to take. That is 3.",
        "",
        "So look for the bar cut into **8** pieces with **3** of them filled.",
      ].join("\n"),
    },
    {
      slug: "c6-eqf-d1-q3",
      concept_slug: "equivalent-fractions",
      kind: "practice",
      difficulty: 1,
      answer_type: "fraction",
      stem_md: "Which picture shows the same amount as $1/2$?",
      answer_value: "2/4",
      input: {
        kind: "choiceViz",
        options: [
          { value: "2/4", viz: { kind: "partWhole", shape: "bar", parts: 4, shaded: 2 } },
          // Added 1 to the top and the bottom — the most common way to make an
          // "equal" fraction that is not one.
          { value: "2/3", viz: { kind: "partWhole", shape: "bar", parts: 3, shaded: 2 } },
          // Doubled only the bottom.
          { value: "1/4", viz: { kind: "partWhole", shape: "bar", parts: 4, shaded: 1 } },
        ],
      },
      solution_md: [
        "Half means the filled part and the empty part are the **same size**.",
        "",
        "Cut the bar into 4 and fill 2, and you have filled exactly half of it:",
        "",
        "$$\n\\frac{1}{2} = \\frac{2}{4}\n$$",
        "",
        "Multiplying the top and the bottom by the same number never changes how much there is — it just cuts the same amount into more pieces.",
      ].join("\n"),
    },
    {
      slug: "c6-cmp-d1-q3",
      concept_slug: "comparing-fractions",
      kind: "practice",
      difficulty: 1,
      answer_type: "fraction",
      stem_md: "Which picture shows **more than half**?",
      answer_value: "3/5",
      input: {
        kind: "choiceViz",
        options: [
          { value: "3/5", viz: { kind: "partWhole", shape: "bar", parts: 5, shaded: 3 } },
          { value: "2/5", viz: { kind: "partWhole", shape: "bar", parts: 5, shaded: 2 } },
          { value: "1/4", viz: { kind: "partWhole", shape: "bar", parts: 4, shaded: 1 } },
        ],
      },
      solution_md: [
        "A fraction is more than half when the top number is more than **half of** the bottom one.",
        "",
        "Half of 5 is 2.5, so $3/5$ is past halfway and $2/5$ has not reached it. Half of 4 is 2, so $1/4$ is well short.",
        "",
        "On the pictures: look for the bar where the filled part is longer than the empty part.",
      ].join("\n"),
    },
    {
      slug: "c6-add-d1-q3",
      concept_slug: "adding-subtracting-fractions",
      kind: "practice",
      difficulty: 1,
      answer_type: "fraction",
      stem_md: "$$\n\\frac{1}{4} + \\frac{1}{4}\n$$\n\nWhich picture shows the answer?",
      answer_value: "2/4",
      input: {
        kind: "choiceViz",
        options: [
          { value: "2/4", viz: { kind: "partWhole", shape: "bar", parts: 4, shaded: 2 } },
          // Added the bottoms as well as the tops. The whole reason this
          // question is pictorial: 2/8 is visibly SMALLER than one of the
          // quarters you started with, and no rule has to be quoted to see it.
          { value: "2/8", viz: { kind: "partWhole", shape: "bar", parts: 8, shaded: 2 } },
          { value: "1/8", viz: { kind: "partWhole", shape: "bar", parts: 8, shaded: 1 } },
        ],
      },
      solution_md: [
        "Both pieces are **quarters**, so they are the same size. Take one, then take another — that is 2 quarters.",
        "",
        "$$\n\\frac{1}{4} + \\frac{1}{4} = \\frac{2}{4}\n$$",
        "",
        "The bottom number stays 4. It is not a count — it is the **size of the piece**, and adding two quarters does not make the pieces smaller.",
        "",
        "That is the trap in $2/8$: it is less than the single quarter you started with, so it cannot be two of them.",
      ].join("\n"),
    },
    // ─────────────────────────────────────────────────────────────────────────
    // CONCEPT 1 — fraction-basics
    // ─────────────────────────────────────────────────────────────────────────
    {
      slug: "c6-fb-d1-q1",
      concept_slug: "fraction-basics",
      kind: "practice",
      difficulty: 1,
      answer_type: "mcq",
      stem_md:
        "A roti is cut into 4 equal pieces. Riya eats 1 piece.\n\nWhat fraction of the roti did she eat?",
      choices: [
        { id: "a", label: "$1/4$" },
        { id: "b", label: "$3/4$" }, // the fraction LEFT, not eaten
        { id: "c", label: "$1/3$" }, // counted the 3 remaining pieces as the whole
        { id: "d", label: "$4/1$" }, // top and bottom swapped
      ],
      answer_value: "a",
      solution_md: [
        "The whole roti was cut into **4** equal parts, so 4 goes on the bottom.",
        "",
        "Riya took **1** of those parts, so 1 goes on top.",
        "",
        "$$\n\\frac{1}{4}\n$$",
        "",
        "$3/4$ is the fraction that is *left over* — a good thing to notice, but not what was asked.",
      ].join("\n"),
    },
    {
      slug: "c6-fb-d1-q2",
      concept_slug: "fraction-basics",
      kind: "practice",
      difficulty: 1,
      answer_type: "integer",
      stem_md:
        "A water bottle is $4/7$ full.\n\nInto how many equal parts has the bottle been divided?",
      answer_value: "7",
      input: { kind: "tiles", bank: ["1", "2", "3", "4", "7", "/"] },
      solution_md: [
        "The **bottom** number tells you how many equal parts the whole was divided into.",
        "",
        "In $4/7$ the bottom number is **7**, so the bottle is thought of as 7 equal parts — and 4 of them have water in.",
      ].join("\n"),
    },
    {
      slug: "c6-fb-d2-q1",
      concept_slug: "fraction-basics",
      kind: "practice",
      difficulty: 2,
      answer_type: "integer",
      stem_md:
        "A bag has 12 laddoos. Meera eats $1/4$ of them.\n\nHow many laddoos did she eat?",
      answer_value: "3",
      input: { kind: "tiles", bank: ["1", "2", "3", "4", "5", "/"] },
      solution_md: [
        "$1/4$ means the 12 laddoos are split into **4 equal groups**, and Meera eats **1** group.",
        "",
        "$$\n12 \\div 4 = 3\n$$",
        "",
        "So Meera ate **3** laddoos.",
      ].join("\n"),
    },
    {
      slug: "c6-fb-d2-q2",
      concept_slug: "fraction-basics",
      kind: "practice",
      difficulty: 2,
      answer_type: "mcq",
      stem_md:
        "Sunita has ₹60. She spends $1/3$ of it on a notebook.\n\nHow much money does she have **left**?",
      choices: [
        { id: "a", label: "₹40" },
        { id: "b", label: "₹20" }, // the amount SPENT
        { id: "c", label: "₹30" }, // treated 1/3 as a half
        { id: "d", label: "₹57" }, // subtracted 3 instead of a third
      ],
      answer_value: "a",
      solution_md: [
        "First find $1/3$ of ₹60 — split it into 3 equal parts:",
        "",
        "$$\n60 \\div 3 = 20\n$$",
        "",
        "She spent ₹20. The question asks what is **left**:",
        "",
        "$$\n60 - 20 = 40\n$$",
        "",
        "So ₹40 is left. Another way to see it: she spent one third, so two thirds are left, and $2/3$ of 60 is 40.",
      ].join("\n"),
    },
    {
      slug: "c6-fb-d3-q1",
      concept_slug: "fraction-basics",
      kind: "practice",
      difficulty: 3,
      answer_type: "integer",
      stem_md:
        "Ravi ate $2/5$ of a packet of biscuits. That was 8 biscuits.\n\nHow many biscuits were in the full packet?",
      answer_value: "20",
      input: { kind: "tiles", bank: ["0", "1", "2", "5", "8", "/"] },
      solution_md: [
        "This one runs backwards — you know the part and you need the whole.",
        "",
        "$2/5$ of the packet is 8 biscuits. So **2 parts = 8 biscuits**.",
        "",
        "One part is therefore $8 \\div 2 = 4$ biscuits.",
        "",
        "The whole packet is 5 parts:",
        "",
        "$$\n5 \\times 4 = 20\n$$",
        "",
        "So the packet had **20** biscuits.",
      ].join("\n"),
    },
    {
      slug: "c6-fb-d3-q2",
      concept_slug: "fraction-basics",
      kind: "practice",
      difficulty: 3,
      answer_type: "integer",
      stem_md:
        "A tank holds 40 litres when full. Right now it is $3/4$ full.\n\nHow many **more** litres are needed to fill it?",
      answer_value: "10",
      input: { kind: "tiles", bank: ["0", "1", "2", "3", "4", "/"] },
      solution_md: [
        "Two steps here.",
        "",
        "**Step 1 — how much is in the tank now?** Find $3/4$ of 40:",
        "",
        "$$\n40 \\div 4 = 10, \\qquad 10 \\times 3 = 30\n$$",
        "",
        "**Step 2 — how much is missing?**",
        "",
        "$$\n40 - 30 = 10\n$$",
        "",
        "So **10** more litres are needed.",
        "",
        "Shortcut: if the tank is $3/4$ full then $1/4$ is empty, and $1/4$ of 40 is 10.",
      ].join("\n"),
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CONCEPT 2 — equivalent-fractions
    // ─────────────────────────────────────────────────────────────────────────
    {
      slug: "c6-eqf-d1-q1",
      concept_slug: "equivalent-fractions",
      kind: "practice",
      difficulty: 1,
      answer_type: "mcq",
      stem_md: "Which fraction is equal to $1/2$?",
      choices: [
        { id: "a", label: "$2/3$" }, // added 1 to top AND bottom
        { id: "b", label: "$2/4$" },
        { id: "c", label: "$1/4$" }, // doubled only the bottom
        { id: "d", label: "$2/2$" }, // doubled only the top
      ],
      answer_value: "b",
      solution_md: [
        "To make an equal fraction, multiply the top and the bottom by the **same** number.",
        "",
        "$$\n\\frac{1}{2} = \\frac{1 \\times 2}{2 \\times 2} = \\frac{2}{4}\n$$",
        "",
        "Adding to the top and bottom does not work. $2/3$ is not the same as $1/2$ — half of 3 is 1.5, not 2.",
      ].join("\n"),
    },
    {
      slug: "c6-eqf-d1-q2",
      concept_slug: "equivalent-fractions",
      kind: "practice",
      difficulty: 1,
      answer_type: "integer",
      stem_md: "$1/3 = \\frac{\\square}{9}$\n\nWhat number goes in the box?",
      answer_value: "3",
      input: { kind: "tiles", bank: ["1", "2", "3", "4", "9", "/"] },
      solution_md: [
        "The bottom went from 3 to 9, so it was multiplied by 3.",
        "",
        "Do the same to the top: $1 \\times 3 = 3$.",
        "",
        "$$\n\\frac{1}{3} = \\frac{3}{9}\n$$",
      ].join("\n"),
    },
    {
      slug: "c6-eqf-d2-q1",
      concept_slug: "equivalent-fractions",
      kind: "practice",
      difficulty: 2,
      answer_type: "integer",
      stem_md: "$4/5 = \\frac{12}{\\square}$\n\nWhat number goes in the box?",
      answer_value: "15",
      input: { kind: "tiles", bank: ["1", "2", "3", "4", "5", "/"] },
      solution_md: [
        "The top went from 4 to 12, so it was multiplied by 3.",
        "",
        "The bottom must be multiplied by 3 too: $5 \\times 3 = 15$.",
        "",
        "$$\n\\frac{4}{5} = \\frac{12}{15}\n$$",
      ].join("\n"),
    },
    {
      slug: "c6-eqf-d2-q2",
      concept_slug: "equivalent-fractions",
      kind: "practice",
      difficulty: 2,
      answer_type: "mcq",
      stem_md:
        "Sita says $3/4$ and $9/12$ are equal fractions.\n\nIs she right?",
      choices: [
        { id: "a", label: "Yes — because $3 \\times 3 = 9$ and $4 \\times 3 = 12$" },
        { id: "b", label: "Yes — because $9 - 3 = 6$ and $12 - 4 = 8$" }, // right answer, wrong reason
        { id: "c", label: "No — the numbers are all different" },
        { id: "d", label: "No — $9/12$ is bigger because 9 is bigger than 3" },
      ],
      answer_value: "a",
      solution_md: [
        "Sita is right, and the reason matters.",
        "",
        "Both the top and the bottom were multiplied by the **same** number, 3:",
        "",
        "$$\n\\frac{3}{4} = \\frac{3 \\times 3}{4 \\times 3} = \\frac{9}{12}\n$$",
        "",
        "Option (d) is a common trap — a bigger top number does not mean a bigger fraction, because the bottom number grew too.",
      ].join("\n"),
    },
    {
      slug: "c6-eqf-d3-q1",
      concept_slug: "equivalent-fractions",
      kind: "practice",
      difficulty: 3,
      answer_type: "integer",
      stem_md: "$18/24 = \\frac{3}{\\square}$\n\nWhat number goes in the box?",
      answer_value: "4",
      input: { kind: "tiles", bank: ["1", "2", "3", "4", "8", "/"] },
      solution_md: [
        "This one goes the other way — the fraction is being made *simpler*, not bigger.",
        "",
        "The top went from 18 to 3. $18 \\div 6 = 3$, so it was divided by 6.",
        "",
        "Divide the bottom by 6 as well: $24 \\div 6 = 4$.",
        "",
        "$$\n\\frac{18}{24} = \\frac{3}{4}\n$$",
      ].join("\n"),
    },
    {
      slug: "c6-eqf-d3-q2",
      concept_slug: "equivalent-fractions",
      kind: "practice",
      difficulty: 3,
      answer_type: "integer",
      stem_md: [
        "A cricket team played 20 matches and won 15 of them.",
        "",
        "Another team played 8 matches and won the same **fraction** of their matches.",
        "",
        "How many matches did the second team win?",
      ].join("\n"),
      answer_value: "6",
      input: { kind: "tiles", bank: ["1", "2", "3", "4", "6", "/"] },
      solution_md: [
        "The first team won $15/20$ of their matches. In its simplest form:",
        "",
        "$$\n\\frac{15}{20} = \\frac{3}{4}\n$$",
        "",
        "The second team won $3/4$ of 8 matches.",
        "",
        "$$\n8 \\div 4 = 2, \\qquad 2 \\times 3 = 6\n$$",
        "",
        "So the second team won **6** matches.",
      ].join("\n"),
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CONCEPT 3 — comparing-fractions
    // ─────────────────────────────────────────────────────────────────────────
    {
      slug: "c6-cmp-d1-q1",
      concept_slug: "comparing-fractions",
      kind: "practice",
      difficulty: 1,
      answer_type: "mcq",
      stem_md: "Which is bigger?",
      choices: [
        { id: "a", label: "$5/7$" },
        { id: "b", label: "$3/7$" },
        { id: "c", label: "They are equal" },
        { id: "d", label: "You cannot compare them" },
      ],
      answer_value: "a",
      solution_md: [
        "Both fractions are in **sevenths**, so the pieces are exactly the same size. All you have to do is count them.",
        "",
        "5 pieces is more than 3 pieces:",
        "",
        "$$\n\\frac{5}{7} > \\frac{3}{7}\n$$",
      ].join("\n"),
    },
    {
      slug: "c6-cmp-d1-q2",
      concept_slug: "comparing-fractions",
      kind: "practice",
      difficulty: 1,
      answer_type: "mcq",
      stem_md: "Which is bigger, $1/4$ or $1/6$?",
      choices: [
        { id: "a", label: "$1/4$" },
        { id: "b", label: "$1/6$, because 6 is bigger than 4" }, // THE classic error
        { id: "c", label: "They are equal — both have 1 on top" },
        { id: "d", label: "You cannot compare them" },
      ],
      answer_value: "a",
      solution_md: [
        "Picture two rotis of the same size. Cut one into **4** pieces and the other into **6**.",
        "",
        "Which single piece is bigger? The one from the roti cut into fewer pieces.",
        "",
        "$$\n\\frac{1}{4} > \\frac{1}{6}\n$$",
        "",
        "This feels backwards, and it catches nearly everyone the first time. A bigger bottom number means **more** parts, and more parts means each one is **smaller**.",
      ].join("\n"),
    },
    {
      slug: "c6-cmp-d2-q1",
      concept_slug: "comparing-fractions",
      kind: "practice",
      difficulty: 2,
      answer_type: "mcq",
      stem_md: "Which is bigger, $2/3$ or $3/5$?",
      choices: [
        { id: "a", label: "$2/3$" },
        { id: "b", label: "$3/5$, because both its numbers are bigger" },
        { id: "c", label: "They are equal" },
        { id: "d", label: "You cannot compare them" },
      ],
      answer_value: "a",
      solution_md: [
        "Nothing matches here, so make the bottoms the same. Both 3 and 5 divide into **15**:",
        "",
        "$$\n\\frac{2}{3} = \\frac{10}{15} \\qquad \\frac{3}{5} = \\frac{9}{15}\n$$",
        "",
        "Now the pieces are the same size, so count them: 10 fifteenths beats 9 fifteenths.",
        "",
        "$$\n\\frac{2}{3} > \\frac{3}{5}\n$$",
      ].join("\n"),
    },
    {
      slug: "c6-cmp-d2-q2",
      concept_slug: "comparing-fractions",
      kind: "practice",
      difficulty: 2,
      answer_type: "integer",
      stem_md: [
        "$$\n\\frac{\\square}{5} > \\frac{2}{5}\n$$",
        "",
        "What is the **smallest** whole number that can go in the box?",
      ].join("\n"),
      answer_value: "3",
      input: { kind: "tiles", bank: ["1", "2", "3", "4", "5", "/"] },
      solution_md: [
        "Both fractions are in fifths, so the box just has to beat 2.",
        "",
        "The whole numbers bigger than 2 are 3, 4, 5, … and the **smallest** of those is **3**.",
        "",
        "$$\n\\frac{3}{5} > \\frac{2}{5}\n$$",
        "",
        "2 itself does not work, because $2/5$ is *equal* to $2/5$, not bigger than it.",
      ].join("\n"),
    },
    {
      slug: "c6-cmp-d3-q1",
      concept_slug: "comparing-fractions",
      kind: "practice",
      difficulty: 3,
      answer_type: "mcq",
      stem_md: [
        "Anil ate $3/4$ of his roti. Bina ate $5/8$ of hers.",
        "",
        "The rotis were the same size. Who ate more?",
      ].join("\n"),
      choices: [
        { id: "a", label: "Anil" },
        { id: "b", label: "Bina, because 5 is more than 3 and 8 is more than 4" },
        { id: "c", label: "They ate the same amount" },
        { id: "d", label: "You cannot tell without knowing the size of the roti" },
      ],
      answer_value: "a",
      solution_md: [
        "Quarters and eighths are different sized pieces, so make them match. 4 divides into 8:",
        "",
        "$$\n\\frac{3}{4} = \\frac{6}{8}\n$$",
        "",
        "Now compare eighths with eighths:",
        "",
        "$$\n\\frac{6}{8} > \\frac{5}{8}\n$$",
        "",
        "**Anil ate more.**",
        "",
        "Option (b) is the trap. A fraction is one amount, not two separate numbers — you cannot compare the tops and bottoms separately.",
      ].join("\n"),
    },
    {
      slug: "c6-cmp-d3-q2",
      concept_slug: "comparing-fractions",
      kind: "practice",
      difficulty: 3,
      answer_type: "integer",
      stem_md: [
        "$$\n\\frac{\\square}{9} < \\frac{2}{3}\n$$",
        "",
        "What is the **largest** whole number that can go in the box?",
      ].join("\n"),
      answer_value: "5",
      input: { kind: "tiles", bank: ["1", "2", "3", "4", "5", "/"] },
      solution_md: [
        "First put both fractions in ninths. The bottom of $2/3$ goes from 3 to 9, so multiply by 3:",
        "",
        "$$\n\\frac{2}{3} = \\frac{6}{9}\n$$",
        "",
        "So the box must make a fraction **smaller than** $6/9$ — the number in it has to be less than 6.",
        "",
        "The largest whole number less than 6 is **5**.",
        "",
        "$$\n\\frac{5}{9} < \\frac{6}{9}\n$$",
        "",
        "6 itself does not work: $6/9$ is equal to $2/3$, not less than it.",
      ].join("\n"),
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CONCEPT 4 — adding-subtracting-fractions
    // ─────────────────────────────────────────────────────────────────────────
    {
      slug: "c6-add-d1-q1",
      concept_slug: "adding-subtracting-fractions",
      kind: "practice",
      difficulty: 1,
      answer_type: "fraction",
      stem_md: "$$\n\\frac{1}{5} + \\frac{2}{5}\n$$",
      answer_value: "3/5",
      input: { kind: "tiles", bank: ["1", "2", "3", "4", "5", "/"] },
      solution_md: [
        "Both fractions are in fifths, so the pieces are the same size. Add the tops and keep the bottom:",
        "",
        "$$\n\\frac{1}{5} + \\frac{2}{5} = \\frac{3}{5}\n$$",
        "",
        "The bottom number stays 5. It is not telling you how much — it is telling you **what size piece** you are counting.",
      ].join("\n"),
    },
    {
      slug: "c6-add-d1-q2",
      concept_slug: "adding-subtracting-fractions",
      kind: "practice",
      difficulty: 1,
      answer_type: "fraction",
      stem_md: "$$\n\\frac{4}{7} - \\frac{1}{7}\n$$",
      answer_value: "3/7",
      input: { kind: "tiles", bank: ["1", "2", "3", "4", "7", "/"] },
      solution_md: [
        "Same bottom number, so subtract the tops and keep the bottom:",
        "",
        "$$\n\\frac{4}{7} - \\frac{1}{7} = \\frac{3}{7}\n$$",
        "",
        "Four sevenths take away one seventh leaves three sevenths — you are just counting pieces of the same size.",
      ].join("\n"),
    },
    {
      slug: "c6-add-d2-q1",
      concept_slug: "adding-subtracting-fractions",
      kind: "practice",
      difficulty: 2,
      answer_type: "fraction",
      stem_md: "$$\n\\frac{1}{2} + \\frac{1}{4}\n$$",
      answer_value: "3/4",
      input: { kind: "tiles", bank: ["1", "2", "3", "4", "5", "/"] },
      solution_md: [
        "Halves and quarters are different sized pieces, so make them match first.",
        "",
        "$$\n\\frac{1}{2} = \\frac{2}{4}\n$$",
        "",
        "Now both are quarters:",
        "",
        "$$\n\\frac{2}{4} + \\frac{1}{4} = \\frac{3}{4}\n$$",
      ].join("\n"),
    },
    {
      slug: "c6-add-d2-q2",
      concept_slug: "adding-subtracting-fractions",
      kind: "practice",
      difficulty: 2,
      answer_type: "mcq",
      stem_md: [
        "Rahul worked out $1/2 + 1/3$ and got $2/5$.",
        "",
        "What went wrong?",
      ].join("\n"),
      choices: [
        {
          id: "a",
          label:
            "He added the tops and the bottoms. The bottoms must be made the same first",
        },
        { id: "b", label: "Nothing — $2/5$ is correct" },
        { id: "c", label: "He should have multiplied instead of adding" },
        { id: "d", label: "He should have got $2/6$" },
      ],
      answer_value: "a",
      solution_md: [
        "Rahul added straight across: $1 + 1 = 2$ on top and $2 + 3 = 5$ on the bottom. That is the most common fraction mistake there is.",
        "",
        "You cannot add halves to thirds any more than you can add apples to mangoes. Make the pieces the same size first — sixths work for both:",
        "",
        "$$\n\\frac{1}{2} = \\frac{3}{6} \\qquad \\frac{1}{3} = \\frac{2}{6}\n$$",
        "",
        "$$\n\\frac{3}{6} + \\frac{2}{6} = \\frac{5}{6}\n$$",
        "",
        "One quick check: $1/2$ on its own is already bigger than $2/5$, so adding something to it could not possibly give $2/5$.",
      ].join("\n"),
    },
    {
      slug: "c6-add-d3-q1",
      concept_slug: "adding-subtracting-fractions",
      kind: "practice",
      difficulty: 3,
      answer_type: "fraction",
      stem_md: "$$\n\\frac{5}{6} - \\frac{1}{4}\n$$",
      answer_value: "7/12",
      input: { kind: "tiles", bank: ["1", "2", "4", "5", "6", "7", "/"] },
      solution_md: [
        "Sixths and quarters do not match. Find a bottom number both go into — **12** works:",
        "",
        "$$\n\\frac{5}{6} = \\frac{10}{12} \\qquad \\frac{1}{4} = \\frac{3}{12}\n$$",
        "",
        "Now subtract the tops:",
        "",
        "$$\n\\frac{10}{12} - \\frac{3}{12} = \\frac{7}{12}\n$$",
        "",
        "7 and 12 share no common factor, so $7/12$ is already in its simplest form.",
      ].join("\n"),
    },
    {
      slug: "c6-add-d3-q2",
      concept_slug: "adding-subtracting-fractions",
      kind: "practice",
      difficulty: 3,
      answer_type: "fraction",
      stem_md: [
        "A jug has $3/4$ litre of milk. Amma pours $1/3$ litre into the tea.",
        "",
        "How much milk is left in the jug?",
      ].join("\n"),
      answer_value: "5/12",
      input: { kind: "tiles", bank: ["1", "2", "3", "4", "5", "/"] },
      solution_md: [
        "This is a subtraction: what was there, minus what was poured out.",
        "",
        "Quarters and thirds do not match, but twelfths work for both:",
        "",
        "$$\n\\frac{3}{4} = \\frac{9}{12} \\qquad \\frac{1}{3} = \\frac{4}{12}\n$$",
        "",
        "$$\n\\frac{9}{12} - \\frac{4}{12} = \\frac{5}{12}\n$$",
        "",
        "So **$5/12$ litre** of milk is left in the jug.",
      ].join("\n"),
    },

    // ═════════════════════════════════════════════════════════════════════════
    // CHAPTER QUIZ — 2 per concept, no hints shown at quiz time (SCREENS.md).
    // Fresh questions, not a replay of practice: a quiz that reuses the practice
    // set measures memory of those items, not understanding of the concept.
    // ═════════════════════════════════════════════════════════════════════════
    {
      slug: "c6-quiz-fb-1",
      concept_slug: "fraction-basics",
      kind: "quiz",
      difficulty: 2,
      answer_type: "integer",
      stem_md:
        "A class has 30 students. $2/5$ of them are girls.\n\nHow many girls are in the class?",
      answer_value: "12",
      solution_md: [
        "Split the 30 students into **5** equal groups:",
        "",
        "$$\n30 \\div 5 = 6\n$$",
        "",
        "Each group is 6 students. Take **2** of those groups:",
        "",
        "$$\n2 \\times 6 = 12\n$$",
        "",
        "So there are **12** girls.",
      ].join("\n"),
    },
    {
      slug: "c6-quiz-fb-2",
      concept_slug: "fraction-basics",
      kind: "quiz",
      difficulty: 3,
      answer_type: "integer",
      stem_md:
        "$3/8$ of a rope is 12 metres long.\n\nHow long is the whole rope, in metres?",
      answer_value: "32",
      solution_md: [
        "3 parts of the rope measure 12 m, so one part is:",
        "",
        "$$\n12 \\div 3 = 4 \\text{ m}\n$$",
        "",
        "The whole rope is 8 parts:",
        "",
        "$$\n8 \\times 4 = 32 \\text{ m}\n$$",
      ].join("\n"),
    },
    {
      slug: "c6-quiz-eqf-1",
      concept_slug: "equivalent-fractions",
      kind: "quiz",
      difficulty: 1,
      answer_type: "integer",
      stem_md: "$2/5 = \\frac{\\square}{20}$\n\nWhat number goes in the box?",
      answer_value: "8",
      solution_md: [
        "The bottom went from 5 to 20, so it was multiplied by 4.",
        "",
        "Do the same on top: $2 \\times 4 = 8$.",
        "",
        "$$\n\\frac{2}{5} = \\frac{8}{20}\n$$",
      ].join("\n"),
    },
    {
      slug: "c6-quiz-eqf-2",
      concept_slug: "equivalent-fractions",
      kind: "quiz",
      difficulty: 2,
      answer_type: "integer",
      stem_md: "$20/35 = \\frac{4}{\\square}$\n\nWhat number goes in the box?",
      answer_value: "7",
      solution_md: [
        "The top went from 20 to 4, so it was **divided** by 5.",
        "",
        "Divide the bottom by 5 as well:",
        "",
        "$$\n35 \\div 5 = 7\n$$",
        "",
        "$$\n\\frac{20}{35} = \\frac{4}{7}\n$$",
      ].join("\n"),
    },
    {
      slug: "c6-quiz-cmp-1",
      concept_slug: "comparing-fractions",
      kind: "quiz",
      difficulty: 1,
      answer_type: "mcq",
      stem_md: "Which is **smaller**, $2/9$ or $2/7$?",
      choices: [
        { id: "a", label: "$2/9$" },
        { id: "b", label: "$2/7$" },
        { id: "c", label: "They are equal — both have 2 on top" },
        { id: "d", label: "You cannot compare them" },
      ],
      answer_value: "a",
      solution_md: [
        "Both have 2 on top, so compare the bottoms. Cutting a whole into **9** parts makes smaller pieces than cutting it into 7.",
        "",
        "Two of the smaller pieces is less than two of the bigger ones:",
        "",
        "$$\n\\frac{2}{9} < \\frac{2}{7}\n$$",
      ].join("\n"),
    },
    {
      slug: "c6-quiz-cmp-2",
      concept_slug: "comparing-fractions",
      kind: "quiz",
      difficulty: 2,
      answer_type: "mcq",
      stem_md: "Which is bigger, $5/6$ or $7/9$?",
      choices: [
        { id: "a", label: "$5/6$" },
        { id: "b", label: "$7/9$, because 7 is bigger than 5" },
        { id: "c", label: "They are equal" },
        { id: "d", label: "You cannot compare them" },
      ],
      answer_value: "a",
      solution_md: [
        "Make the bottoms the same. Both 6 and 9 divide into **18**:",
        "",
        "$$\n\\frac{5}{6} = \\frac{15}{18} \\qquad \\frac{7}{9} = \\frac{14}{18}\n$$",
        "",
        "Now count eighteenths:",
        "",
        "$$\n\\frac{15}{18} > \\frac{14}{18}\n$$",
        "",
        "So $5/6$ is bigger — only just.",
      ].join("\n"),
    },
    {
      slug: "c6-quiz-add-1",
      concept_slug: "adding-subtracting-fractions",
      kind: "quiz",
      difficulty: 2,
      answer_type: "fraction",
      stem_md: "$$\n\\frac{2}{3} + \\frac{1}{6}\n$$",
      answer_value: "5/6",
      solution_md: [
        "Thirds and sixths do not match, but 3 divides into 6, so rewrite the first fraction:",
        "",
        "$$\n\\frac{2}{3} = \\frac{4}{6}\n$$",
        "",
        "Now add the tops:",
        "",
        "$$\n\\frac{4}{6} + \\frac{1}{6} = \\frac{5}{6}\n$$",
      ].join("\n"),
    },
    {
      slug: "c6-quiz-add-2",
      concept_slug: "adding-subtracting-fractions",
      kind: "quiz",
      difficulty: 3,
      answer_type: "fraction",
      stem_md: [
        "Ria read $1/3$ of a book on Monday and $2/5$ of it on Tuesday.",
        "",
        "What fraction of the book has she read altogether?",
      ].join("\n"),
      answer_value: "11/15",
      solution_md: [
        "Thirds and fifths do not match. Both 3 and 5 divide into **15**:",
        "",
        "$$\n\\frac{1}{3} = \\frac{5}{15} \\qquad \\frac{2}{5} = \\frac{6}{15}\n$$",
        "",
        "$$\n\\frac{5}{15} + \\frac{6}{15} = \\frac{11}{15}\n$$",
        "",
        "So Ria has read $11/15$ of the book — not quite three quarters.",
      ].join("\n"),
    },
  ],
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY EVERY FILL-IN-THE-BOX HERE IS `integer` AND NOT `fraction`
 *
 * D3's grader reduces fractions to lowest terms, so `2/4`, `1/2` and `0.5` all
 * grade correct against `1/2`. That rule is right — a learner who writes `2/4`
 * understood the maths.
 *
 * But it silently destroys a whole category of NCERT question:
 *
 *   "Write 6/8 in its lowest terms."  →  learner types 6/8  →  graded CORRECT
 *
 * Reducing IS the skill being tested, and the grader reduces for them. The
 * question becomes impossible to fail.
 *
 * Fix, at no cost: ask for the missing NUMBER, not the fraction. `18/24 = 3/□`
 * with answer_type `integer` tests the identical skill and grades exactly.
 *
 * RULE: never author a question whose point is producing lowest terms with
 * answer_type `fraction`. Use an `integer` fill-in-the-box instead.
 *
 * The `fraction` answers that DO appear here (`3/5`, `7/12`, `11/15`) are all
 * arithmetic results, where any equivalent form the learner writes is genuinely a
 * correct answer. That is the grader working as intended, not a hole.
 * ─────────────────────────────────────────────────────────────────────────────
 */
