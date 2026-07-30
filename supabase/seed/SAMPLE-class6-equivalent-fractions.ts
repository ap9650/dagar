/**
 * SAMPLE — one concept, fully covered, so you can judge quality and format
 * before I author all 72 questions in slice 1.2.
 *
 * Class 6 · Fractions · concept: equivalent-fractions
 * 2 questions × 3 difficulties = 6 questions (the coverage saathi-content requires)
 *
 * English only here. Hindi goes into the `i18n` jsonb in slice 1.6.
 * This file is illustrative — delete it once the real seed exists.
 */

export const conceptEquivalentFractions = {
  slug: "equivalent-fractions",
  name: "Equivalent Fractions",
  order_index: 2,
};

export const questions = [
  // ─── Difficulty 1 — recognise ──────────────────────────────────────────────
  {
    concept_slug: "equivalent-fractions",
    kind: "practice",
    difficulty: 1,
    answer_type: "mcq",
    stem_md: "Which fraction is equal to $\\frac{1}{2}$?",
    choices: [
      { id: "a", label: "$\\frac{2}{3}$" }, // added 1 to top AND bottom
      { id: "b", label: "$\\frac{2}{4}$" }, // correct
      { id: "c", label: "$\\frac{1}{4}$" }, // doubled only the bottom
      { id: "d", label: "$\\frac{2}{2}$" }, // doubled only the top
    ],
    answer_value: "b",
    solution_md:
      "To make an equal fraction, multiply the top and the bottom by the **same** number.\n\n" +
      "$$\\frac{1}{2} = \\frac{1 \\times 2}{2 \\times 2} = \\frac{2}{4}$$\n\n" +
      "Adding to the top and bottom does not work. $\\frac{2}{3}$ is not the same as $\\frac{1}{2}$ — " +
      "half of 3 is 1.5, not 2.",
  },
  {
    concept_slug: "equivalent-fractions",
    kind: "practice",
    difficulty: 1,
    answer_type: "integer", // NOT fraction — see the note at the bottom of this file
    stem_md: "$\\frac{1}{3} = \\frac{\\square}{9}$\n\nWhat number goes in the box?",
    answer_value: "3",
    solution_md:
      "The bottom went from 3 to 9, so it was multiplied by 3.\n\n" +
      "Do the same to the top: $1 \\times 3 = 3$.\n\n" +
      "$$\\frac{1}{3} = \\frac{3}{9}$$",
  },

  // ─── Difficulty 2 — apply ──────────────────────────────────────────────────
  {
    concept_slug: "equivalent-fractions",
    kind: "practice",
    difficulty: 2,
    answer_type: "integer",
    stem_md: "$\\frac{4}{5} = \\frac{12}{\\square}$\n\nWhat number goes in the box?",
    answer_value: "15",
    solution_md:
      "The top went from 4 to 12, so it was multiplied by 3.\n\n" +
      "The bottom must be multiplied by 3 too: $5 \\times 3 = 15$.\n\n" +
      "$$\\frac{4}{5} = \\frac{12}{15}$$",
  },
  {
    concept_slug: "equivalent-fractions",
    kind: "practice",
    difficulty: 2,
    answer_type: "mcq",
    stem_md:
      "Sita says $\\frac{3}{4}$ and $\\frac{9}{12}$ are equal fractions.\n\nIs she right?",
    choices: [
      { id: "a", label: "Yes — because $3 \\times 3 = 9$ and $4 \\times 3 = 12$" },
      { id: "b", label: "Yes — because $9 - 3 = 6$ and $12 - 4 = 8$" }, // right answer, wrong reason
      { id: "c", label: "No — the numbers are all different" },
      { id: "d", label: "No — $\\frac{9}{12}$ is bigger because 9 is bigger than 3" },
    ],
    answer_value: "a",
    solution_md:
      "Sita is right, and the reason matters.\n\n" +
      "Both the top and the bottom were multiplied by the **same** number, 3:\n\n" +
      "$$\\frac{3}{4} = \\frac{3 \\times 3}{4 \\times 3} = \\frac{9}{12}$$\n\n" +
      "Option (d) is a common trap — a bigger top number does not mean a bigger fraction, " +
      "because the bottom number grew too.",
  },

  // ─── Difficulty 3 — reverse the reasoning ──────────────────────────────────
  {
    concept_slug: "equivalent-fractions",
    kind: "practice",
    difficulty: 3,
    answer_type: "integer",
    stem_md: "$\\frac{18}{24} = \\frac{3}{\\square}$\n\nWhat number goes in the box?",
    answer_value: "4",
    solution_md:
      "This one goes the other way — the fraction is being made *smaller*, not bigger.\n\n" +
      "The top went from 18 to 3. $18 \\div 6 = 3$, so it was divided by 6.\n\n" +
      "Divide the bottom by 6 as well: $24 \\div 6 = 4$.\n\n" +
      "$$\\frac{18}{24} = \\frac{3}{4}$$",
  },
  {
    concept_slug: "equivalent-fractions",
    kind: "practice",
    difficulty: 3,
    answer_type: "integer",
    stem_md:
      "A cricket team played 20 matches and won 15 of them.\n\n" +
      "Another team played 8 matches and won the same **fraction** of their matches.\n\n" +
      "How many matches did the second team win?",
    answer_value: "6",
    solution_md:
      "The first team won $\\frac{15}{20}$ of their matches. In its simplest form:\n\n" +
      "$$\\frac{15}{20} = \\frac{3}{4}$$\n\n" +
      "The second team won $\\frac{3}{4}$ of 8 matches.\n\n" +
      "$$\\frac{3}{4} \\text{ of } 8 = 6$$\n\n" +
      "So the second team won **6** matches.",
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY EVERY FILL-IN-THE-BLANK ABOVE IS `integer` AND NOT `fraction`
 *
 * D3 says the grader normalises fractions to lowest terms, so `2/4`, `1/2` and
 * `0.5` all grade correct against `1/2`. That rule is right — a learner who
 * writes 2/4 understood the maths.
 *
 * But it silently destroys two whole categories of NCERT question:
 *
 *   "Write 6/8 in its lowest terms."     → learner types 6/8 → graded CORRECT
 *   "What fraction of matches were won?" → learner types 15/20 → graded CORRECT
 *
 * In both cases the reducing IS the skill being tested, and the grader reduces
 * for them. The question becomes impossible to fail.
 *
 * Fix, and it costs nothing: ask for the missing NUMBER, not the fraction.
 * `18/24 = 3/□` with answer_type `integer` tests the identical skill and grades
 * exactly. Every question above is built that way.
 *
 * RULE: never author a question whose whole point is producing lowest terms
 * with answer_type `fraction`. Use `integer` fill-in-the-box instead.
 * ─────────────────────────────────────────────────────────────────────────────
 */
