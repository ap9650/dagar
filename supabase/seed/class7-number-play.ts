import type { SeedChapter } from "./types.ts";

/**
 * Class 7 · Number Play · Ganita Prakash Ch 6
 *
 * ── THE ARGUMENT OF THE CHAPTER ─────────────────────────────────────────────
 * Every idea here is the same idea: **you can know something about a number
 * without working the number out.** Odd + odd is even, and you never add them.
 * A magic square's missing cell is forced, and you never guess it. A pattern's
 * next term follows from the two before it, and you never count.
 *
 * That is a genuine shift for Class 7 — up to here, maths has mostly meant
 * "calculate". So the lessons deliberately keep asking the same question in
 * different clothes: *what can you say before you compute?*
 * ────────────────────────────────────────────────────────────────────────────
 *
 * WHICH "Number Play" this is. There are three chapters with this exact name —
 * Class 6 Ch 3, Class 7 Ch 6 and Class 8 Ch 5 — and they teach different
 * material. This is the CLASS 7 one: parity, magic squares, Virahāṅka numbers
 * and cryptarithms. Confirmed with the teacher on 3 Aug before a word was
 * written, because authoring the wrong one costs a whole chapter.
 *
 * Parity reuses `tokenRow` with the new `plain` flag rather than a new shape:
 * seven counters wrapped in twos leave one stranded, and the stranded one IS
 * oddness. `plain` drops the `+` glyph — those chips would assert "positive
 * seven", which is a different and irrelevant fact about seven students.
 *
 * English only here. Hindi lives in `seed/translations/hi.json`.
 */
export const class7NumberPlay: SeedChapter = {
  slug: "class7-number-play",
  grade: 7,
  number: 6,
  title: "Number Play",
  summary:
    "How to know whether an answer is odd or even before you work it out, how a magic square forces its own missing number, and how patterns build themselves.",
  ncert_ref: "Ganita Prakash Class 7 Part 1 Ch 6 (Number Play)",
  // Ch 6 comes before Operations with Integers, which is Part 2 Ch 2.
  order_index: 1,

  concepts: [
    { slug: "parity", name: "Odd and Even", order_index: 1 },
    { slug: "parity-rules", name: "Parity of Sums", order_index: 2 },
    { slug: "magic-squares", name: "Magic Squares", order_index: 3 },
    { slug: "number-patterns", name: "Number Patterns", order_index: 4 },
  ],

  lessons: [
    {
      slug: "c7-np-l1",
      concept_slug: "parity",
      order_index: 1,
      title: "What Makes a Number Odd",
      est_minutes: 4,
      body_md: [
        "Eight students are going to sit in pairs for a project. Everyone gets a partner.",
        "",
        "Seven students, and one is left sitting alone. However you arrange them, somebody is always left over.",
        "",
        "That is the whole of **parity**:",
        "",
        "- A number is **even** if it can be split into pairs with nothing left over.",
        "- A number is **odd** if one is always left over.",
        "",
        "### The test you already know",
        "",
        "Look at the last digit. If it is 0, 2, 4, 6 or 8, the number is even. If it is 1, 3, 5, 7 or 9, it is odd.",
        "",
        "That works for 7 and it works for 4,286,391, you never look at the other digits, because pairing off happens in the ones column.",
        "",
        "### Zero, and negative numbers",
        "",
        "**Zero is even.** Nothing left over is exactly what even means.",
        "",
        "And $-7$ is odd, the same as $7$. Parity does not care about the sign. It is about whether things pair up, and seven debts pair up no better than seven students.",
      ].join("\n"),

      steps: [
        {
          kind: "see",
          md: "Eight students sitting in pairs for a project. Everyone has a partner.",
          viz: { kind: "tokenRow", positive: 8, negative: 0, groupsOf: 2, plain: true },
        },
        {
          kind: "see",
          md: "Now seven. Rearrange them however you like, somebody is always left sitting alone.",
          viz: { kind: "tokenRow", positive: 7, negative: 0, groupsOf: 2, plain: true },
        },
        {
          kind: "reveal",
          md: "That is the whole idea. What makes a number **odd**?",
          answer: "One is always left over when you pair them up. **Even** means nothing is left over.",
        },
        {
          kind: "worked",
          md: "You do not have to draw counters to know. Look at the last digit.",
          lines: [
            "Last digit 0, 2, 4, 6 or 8 → even.",
            "Last digit 1, 3, 5, 7 or 9 → odd.",
            "It works for 7, and it works for 4,286,391, pairing happens in the ones column.",
          ],
        },
        {
          kind: "tap",
          md: "Is 4,286,391 odd or even?",
          options: [{ label: "Odd" }, { label: "Even" }, { label: "You would have to divide it" }],
          answer: 0,
          why: "The last digit is 1, so it is odd. The other six digits never mattered.",
        },
        {
          // Both the cases learners get wrong, in one step each.
          kind: "reveal",
          md: "Two tricky ones. Is **zero** odd or even?",
          answer: "Even. Nothing left over is exactly what even means, zero pairs perfectly, with nothing spare.",
          viz: { kind: "tokenRow", positive: 0, negative: 0, groupsOf: 2, plain: true },
        },
        {
          // The distractor offers "it is negative" as a category, so the steps
          // have to have said what a negative number is. It was said only in
          // the prose, which the step player hides.
          kind: "see",
          md: "Numbers below zero are **negative**, you write them with a minus sign, like $-7$. Seven owed instead of seven owned.",
        },
        {
          kind: "tap",
          md: "So is $-7$ odd or even?",
          options: [{ label: "Odd" }, { label: "Even" }, { label: "Neither. It is negative" }],
          answer: 0,
          why: "Odd, the same as 7. Odd and even take no notice of the minus sign: seven debts pair up no better than seven students.",
        },
      ],
    },

    {
      slug: "c7-np-l2",
      concept_slug: "parity-rules",
      order_index: 2,
      title: "Knowing the Answer Before You Add",
      est_minutes: 4,
      body_md: [
        "Is $47 + 83$ odd or even?",
        "",
        "You can add them. Or you can notice that both are odd, and know the answer is even without adding anything.",
        "",
        "### The four rules",
        "",
        "- even + even = **even**",
        "- odd + odd = **even**",
        "- even + odd = **odd**",
        "- odd + even = **odd**",
        "",
        "### Why odd + odd is even",
        "",
        "An odd number is pairs with one left over. Two odd numbers are pairs with one left over, and pairs with one left over.",
        "",
        "Those two leftovers pair up with each other. Nothing is left, so the total is even.",
        "",
        "That is not a rule to memorise. It is a picture, and once you have seen it you cannot forget it.",
        "",
        "### Subtraction behaves the same way",
        "",
        "odd − odd is even, even − even is even, and a mix is odd. Taking away pairs never disturbs the leftover.",
        "",
        "### Worked example",
        "",
        "$47 + 83$: odd + odd, so the answer is even. (It is 130, but you knew it was even before you knew it was 130.)",
      ].join("\n"),

      steps: [
        {
          kind: "see",
          md: "Is $47 + 83$ odd or even? You can add them, or you can just look at them.",
        },
        {
          // Was a third `see` in a row, which the seed guard rejects — and it
          // was right to. Three screens of being told, before being asked
          // anything, is where a learner stops reading.
          kind: "reveal",
          md: "Here are five. Pair them up, how many are left over?",
          answer: "One. That is what odd means, and it is the leftover that decides everything here.",
          viz: { kind: "tokenRow", positive: 5, negative: 0, groupsOf: 2, plain: true },
        },
        {
          kind: "see",
          md: "Three is odd too: one pair, one left over.",
          viz: { kind: "tokenRow", positive: 3, negative: 0, groupsOf: 2, plain: true },
        },
        {
          kind: "reveal",
          md: "Put them together, 8 in all. What happened to the two leftovers?",
          answer: "They paired up with each other. Nothing is left over, so odd + odd is **even**.",
          viz: { kind: "tokenRow", positive: 8, negative: 0, groupsOf: 2, plain: true },
        },
        {
          kind: "worked",
          md: "That gives all four rules, and none of them need adding.",
          lines: [
            "even + even = even, no leftovers at all.",
            "odd + odd = even, the two leftovers pair with each other.",
            "even + odd = odd, one leftover, and nothing to pair it with.",
            "odd + even = odd, the same thing, the other way round.",
          ],
        },
        {
          kind: "tap",
          md: "So is $47 + 83$ odd or even?",
          options: [{ label: "Odd" }, { label: "Even" }, { label: "It depends on the total" }],
          answer: 1,
          why: "Both are odd, so the total is even. It is 130, but you knew it was even before you knew it was 130.",
        },
        {
          kind: "tap",
          md: "And $128 - 45$?",
          options: [{ label: "Odd" }, { label: "Even" }],
          answer: 0,
          why: "Even − odd = odd. Taking away pairs never disturbs the one left over.",
        },
      ],
    },

    {
      slug: "c7-np-l3",
      concept_slug: "parity-rules",
      order_index: 3,
      title: "Three Odds, and What Breaks",
      est_minutes: 3,
      body_md: [
        "Odd + odd is even. So what is odd + odd + odd?",
        "",
        "Most people guess even, because two odds made an even. Try it: $1 + 3 + 5 = 9$, which is odd.",
        "",
        "### The real rule",
        "",
        "Pair the odd numbers off against each other. Every **pair of odds** cancels into an even.",
        "",
        "- An **even count** of odd numbers → the sum is even.",
        "- An **odd count** of odd numbers → the sum is odd.",
        "",
        "The even numbers in the sum never matter at all. They contribute no leftover, so they cannot change the answer.",
        "",
        "### Worked example",
        "",
        "$2 + 7 + 4 + 9 + 6 + 11$",
        "",
        "Ignore 2, 4 and 6. They are even and change nothing.",
        "",
        "That leaves 7, 9 and 11: **three** odd numbers. Three is an odd count, so the total is odd.",
        "",
        "(It is 39. But the counting was the quick part.)",
      ].join("\n"),

      steps: [
        {
          kind: "reveal",
          md: "Odd + odd is even. So what do you think odd + odd + odd is?",
          answer: "Odd. $1 + 3 + 5 = 9$. Two odds made an even, and then the third one is left over again.",
        },
        {
          kind: "see",
          md: "Three odd numbers: two of them pair off, and the third has nothing to pair with.",
          viz: { kind: "tokenRow", positive: 9, negative: 0, groupsOf: 2, plain: true },
        },
        {
          kind: "worked",
          md: "So the rule is about how MANY odd numbers there are.",
          lines: [
            "An even count of odd numbers → even.",
            "An odd count of odd numbers → odd.",
            "The even numbers never matter, they add no leftover.",
          ],
        },
        {
          kind: "tap",
          md: "Is $2 + 7 + 4 + 9 + 6 + 11$ odd or even?",
          options: [{ label: "Odd" }, { label: "Even" }],
          answer: 0,
          why: "Ignore 2, 4 and 6. That leaves three odd numbers, and three is an odd count, so the total is odd.",
        },
        {
          kind: "reveal",
          md: "Last one. Add up every number from 1 to 10. Odd or even?",
          answer: "Odd. The odd numbers are 1, 3, 5, 7, 9, five of them, an odd count. (The total is 55.)",
        },
      ],
    },

    {
      slug: "c7-np-l4",
      concept_slug: "magic-squares",
      order_index: 4,
      title: "Magic Squares",
      est_minutes: 5,
      body_md: [
        "A **magic square** is a grid where every row and every column adds up to the same number.",
        "",
        "The most famous one uses 1 to 9, and every line makes 15:",
        "",
        "$$\n\\begin{matrix} 8 & 1 & 6 \\\\ 3 & 5 & 7 \\\\ 4 & 9 & 2 \\end{matrix}\n$$",
        "",
        "### Finding a missing number",
        "",
        "If a cell is blank, you do not guess it. **A completed row or column tells you the magic total**, and then any line with one gap is a subtraction.",
        "",
        "### Worked example",
        "",
        "Suppose the top row reads 8, 1, 6. That is 15, so the magic total is 15.",
        "",
        "The middle row reads 3, ?, 7. That is $3 + 7 = 10$ so far, and the row must make 15.",
        "",
        "$$\n15 - 10 = 5\n$$",
        "",
        "The missing number is 5, and there was never a choice about it. Every gap in a magic square is **forced**.",
        "",
        "### Why the total is not arbitrary",
        "",
        "For a 3×3 square using 1 to 9: all nine numbers add to 45, and they fall into three rows that each total the same. So each row must make $45 \\div 3 = 15$.",
      ].join("\n"),

      steps: [
        {
          kind: "see",
          md: "A **magic square**: every row and every column adds to the same number. The totals are printed beside it.",
          viz: {
            kind: "numberGrid",
            rows: 3,
            cols: 3,
            showSums: true,
            cells: [8, 1, 6, 3, 5, 7, 4, 9, 2].map((value) => ({ value })),
          },
        },
        {
          kind: "reveal",
          md: "Every line makes 15. Why 15, and not some other number?",
          answer:
            "1 to 9 add up to 45, and they sit in three equal rows. So each row must make $45 \\div 3 = 15$.",
        },
        {
          kind: "see",
          md: "Now one cell is missing. Its row shows **?**, a row with a gap has no total yet.",
          viz: {
            kind: "numberGrid",
            rows: 3,
            cols: 3,
            showSums: true,
            cells: [
              { value: 8 },
              { value: 1 },
              { value: 6 },
              { value: 3 },
              {},
              { value: 7 },
              { value: 4 },
              { value: 9 },
              { value: 2 },
            ],
          },
        },
        {
          kind: "worked",
          md: "You do not guess it. You work it out.",
          lines: [
            "The top row is complete: $8 + 1 + 6 = 15$. So the magic total is 15.",
            "The middle row so far: $3 + 7 = 10$.",
            "$15 - 10 = 5$.",
          ],
        },
        {
          kind: "tap",
          md: "So what belongs in the blank cell?",
          options: [{ label: "4" }, { label: "5" }, { label: "6" }, { label: "It could be several" }],
          answer: 1,
          why: "5, and there was never a choice. Every gap in a magic square is forced by the lines around it.",
        },
        {
          kind: "see",
          md: "Filled in, and every row and column makes 15 again.",
          viz: {
            kind: "numberGrid",
            rows: 3,
            cols: 3,
            showSums: true,
            cells: [8, 1, 6, 3, 5, 7, 4, 9, 2].map((value, i) => ({
              value,
              tone: i === 4 ? ("correct" as const) : undefined,
            })),
          },
        },
        {
          // The rule stated properly: a gap is forced by a line that has only
          // ONE gap in it. Not "two blanks are impossible" — a second blank in
          // another line is usually still forced by its column.
          kind: "reveal",
          md: "A smaller one. Every row and column here adds to the same number. Where do you start?",
          answer:
            "With a line that is already complete, the bottom row makes 10. Then the top row has one gap: $10 - 6 = 4$.",
          viz: {
            kind: "numberGrid",
            rows: 2,
            cols: 2,
            showSums: true,
            cells: [{ value: 6 }, {}, { value: 4 }, { value: 6 }],
          },
        },
      ],
    },

    {
      slug: "c7-np-l5",
      concept_slug: "number-patterns",
      order_index: 5,
      title: "Patterns That Build Themselves",
      est_minutes: 4,
      body_md: [
        "Some sequences do not have a formula. They have a **rule that makes the next term out of the ones before it**.",
        "",
        "### Virahāṅka numbers",
        "",
        "$$\n1,\\; 1,\\; 2,\\; 3,\\; 5,\\; 8,\\; 13,\\; 21,\\; \\ldots\n$$",
        "",
        "Each number is the sum of the two before it. $2 = 1 + 1$, $3 = 1 + 2$, $5 = 2 + 3$, $8 = 3 + 5$.",
        "",
        "These were described by the Indian mathematician **Virahāṅka** more than a thousand years ago, while he was counting the ways of arranging short and long syllables in poetry.",
        "",
        "You never need a formula. To get the next one, you add the last two.",
        "",
        "### Parity has a pattern too",
        "",
        "Look at the odd and even of that sequence: odd, odd, even, odd, odd, even, odd, odd, even…",
        "",
        "It repeats every three terms, forever, and you can see why from the rules you already know: odd + odd is even, then even + odd is odd, then odd + even is odd.",
        "",
        "### Cryptarithms",
        "",
        "A puzzle where letters stand for digits, and each letter is always the same digit.",
        "",
        "$$\nAB + B = 68\n$$",
        "",
        "Work from what is forced, exactly as in a magic square, never from guessing.",
      ].join("\n"),

      steps: [
        {
          kind: "see",
          md: "Some sequences have no formula. They have a rule that builds each term from the ones before it.",
        },
        {
          kind: "reveal",
          md: "Look at $1, 1, 2, 3, 5, 8, 13$. What is the rule?",
          answer:
            "Each number is the sum of the two before it. $2 = 1 + 1$, $3 = 1 + 2$, $5 = 2 + 3$, $8 = 3 + 5$.",
        },
        {
          kind: "see",
          md: "These are **Virahāṅka numbers**, described in India over a thousand years ago, from counting syllable patterns in poetry.",
        },
        {
          kind: "tap",
          md: "What comes after 21?",
          options: [{ label: "26" }, { label: "34" }, { label: "42" }],
          answer: 1,
          why: "$13 + 21 = 34$. Add the last two, you never need a formula.",
        },
        {
          // Ties the chapter's two halves together.
          kind: "reveal",
          md: "Now mark each one odd or even: 1, 1, 2, 3, 5, 8, 13, 21. What do you notice?",
          answer:
            "odd, odd, even, odd, odd, even… it repeats every three, forever, because odd + odd is even, then even + odd is odd.",
        },
        {
          kind: "worked",
          md: "One cryptarithm, worked the way you worked the magic square: from what is forced.",
          lines: [
            "$AB + B = 68$, where $AB$ is a two-digit number.",
            "The ones column: $B + B$ ends in 8, so $B$ is 4 or 9.",
            "If $B = 9$ the ones column carries, and the tens would not reach 6. So $B = 4$.",
            "Then $A4 + 4 = 68$, so $A4 = 64$ and $A = 6$.",
          ],
        },
        {
          kind: "reveal",
          md: "Last question of the chapter. What did every idea here have in common?",
          answer:
            "You knew something before you calculated it, the parity, the missing cell, the next term. That is the whole chapter.",
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTIONS — 2 per difficulty per concept, plus 2 quiz questions per concept.
  // ═══════════════════════════════════════════════════════════════════════════
  questions: [
    // ── parity ─────────────────────────────────────────────────────────────
    {
      slug: "c7-np-par-p1",
      concept_slug: "parity",
      kind: "practice",
      difficulty: 1,
      stem_md: "Is 36 odd or even?",
      answer_type: "mcq",
      answer_value: "even",
      choices: [
        { id: "even", label: "Even" },
        { id: "odd", label: "Odd" },
      ],
      solution_md: "The last digit is 6, so 36 is even. It splits into 18 pairs with nothing left over.",
    },
    {
      slug: "c7-np-par-p2",
      concept_slug: "parity",
      kind: "practice",
      difficulty: 1,
      stem_md: "Is 0 odd or even?",
      answer_type: "mcq",
      answer_value: "even",
      choices: [
        { id: "even", label: "Even" },
        { id: "odd", label: "Odd" },
        { id: "neither", label: "Neither" },
      ],
      solution_md:
        "Even. Nothing left over is exactly what even means, zero pairs perfectly, with nothing spare.",
    },
    {
      slug: "c7-np-par-p3",
      concept_slug: "parity",
      kind: "practice",
      difficulty: 2,
      stem_md: "Is 4,286,391 odd or even?",
      answer_type: "mcq",
      answer_value: "odd",
      choices: [
        { id: "odd", label: "Odd" },
        { id: "even", label: "Even" },
      ],
      solution_md:
        "The last digit is 1, so it is odd. The other six digits never mattered, pairing happens in the ones column.",
    },
    {
      slug: "c7-np-par-p4",
      concept_slug: "parity",
      kind: "practice",
      difficulty: 2,
      stem_md: "Is $-7$ odd or even?",
      answer_type: "mcq",
      answer_value: "odd",
      choices: [
        { id: "odd", label: "Odd" },
        { id: "even", label: "Even" },
        { id: "neither", label: "Neither, because it is negative" },
      ],
      solution_md:
        "Odd, the same as 7. Parity does not care about the sign, seven debts pair up no better than seven students.",
    },
    {
      slug: "c7-np-par-p5",
      concept_slug: "parity",
      kind: "practice",
      difficulty: 3,
      stem_md: "How many odd numbers are there from 1 to 20?",
      answer_type: "integer",
      answer_value: "10",
      solution_md:
        "They alternate, so exactly half of them are odd: 1, 3, 5, … 19. That is $20 \\div 2 = 10$ numbers.",
    },
    {
      slug: "c7-np-par-p6",
      concept_slug: "parity",
      kind: "practice",
      difficulty: 3,
      stem_md: "A number is even. What can you say for certain about the number just after it?",
      answer_type: "mcq",
      answer_value: "odd",
      choices: [
        { id: "odd", label: "It is odd" },
        { id: "even", label: "It is even" },
        { id: "depends", label: "It depends on the number" },
      ],
      solution_md:
        "It is odd. Odd and even alternate one after another, all the way along the number line, with no exceptions.",
    },

    // ── parity rules ───────────────────────────────────────────────────────
    {
      slug: "c7-np-rul-p1",
      concept_slug: "parity-rules",
      kind: "practice",
      difficulty: 1,
      stem_md: "Odd + odd = ?",
      answer_type: "mcq",
      answer_value: "even",
      choices: [
        { id: "even", label: "Even" },
        { id: "odd", label: "Odd" },
        { id: "depends", label: "It depends which numbers" },
      ],
      solution_md:
        "Even. Each odd number has one left over, and those two leftovers pair up with each other, so nothing is left.",
    },
    {
      slug: "c7-np-rul-p2",
      concept_slug: "parity-rules",
      kind: "practice",
      difficulty: 1,
      stem_md: "Is $12 + 7$ odd or even?",
      answer_type: "mcq",
      answer_value: "odd",
      choices: [
        { id: "odd", label: "Odd" },
        { id: "even", label: "Even" },
      ],
      solution_md: "Even + odd = odd. You do not need the total, but it is 19.",
    },
    {
      slug: "c7-np-rul-p3",
      concept_slug: "parity-rules",
      kind: "practice",
      difficulty: 2,
      stem_md: "Is $47 + 83$ odd or even?",
      answer_type: "mcq",
      answer_value: "even",
      choices: [
        { id: "even", label: "Even" },
        { id: "odd", label: "Odd" },
      ],
      solution_md:
        "Both are odd, so the total is even. It is 130, but you knew it was even before you knew it was 130.",
    },
    {
      slug: "c7-np-rul-p4",
      concept_slug: "parity-rules",
      kind: "practice",
      difficulty: 2,
      stem_md: "Is $128 - 45$ odd or even?",
      answer_type: "mcq",
      answer_value: "odd",
      choices: [
        { id: "odd", label: "Odd" },
        { id: "even", label: "Even" },
      ],
      solution_md:
        "Even − odd = odd. Subtraction behaves the same way as addition: taking away pairs never disturbs the leftover.",
    },
    {
      slug: "c7-np-rul-p5",
      concept_slug: "parity-rules",
      kind: "practice",
      difficulty: 3,
      stem_md: "Is $1 + 3 + 5$ odd or even?",
      answer_type: "mcq",
      answer_value: "odd",
      choices: [
        { id: "odd", label: "Odd" },
        { id: "even", label: "Even" },
      ],
      solution_md:
        "Three odd numbers is an **odd count** of them, so the total is odd. It is 9. Two odds make an even, and then the third is left over again.",
    },
    {
      slug: "c7-np-rul-p6",
      concept_slug: "parity-rules",
      kind: "practice",
      difficulty: 3,
      stem_md: "Is $2 + 7 + 4 + 9 + 6 + 11$ odd or even?",
      answer_type: "mcq",
      answer_value: "odd",
      choices: [
        { id: "odd", label: "Odd" },
        { id: "even", label: "Even" },
      ],
      solution_md:
        "Ignore 2, 4 and 6, even numbers add no leftover. That leaves 7, 9 and 11: three odd numbers, an odd count, so the total is odd.",
    },

    // ── magic squares ──────────────────────────────────────────────────────
    {
      slug: "c7-np-mag-p1",
      concept_slug: "magic-squares",
      kind: "practice",
      difficulty: 1,
      stem_md: "In a magic square, what is the same about every row and every column?",
      answer_type: "mcq",
      answer_value: "total",
      choices: [
        { id: "total", label: "They all add up to the same number" },
        { id: "same", label: "They all contain the same numbers" },
        { id: "order", label: "They are all in order" },
      ],
      solution_md: "Every row and every column adds up to the same total. That is what makes it magic.",
    },
    {
      slug: "c7-np-mag-p2",
      concept_slug: "magic-squares",
      kind: "practice",
      difficulty: 1,
      stem_md: "A magic square's rows each add to 15. One row so far is $8 + 1$. What is missing?",
      answer_type: "integer",
      answer_value: "6",
      solution_md: "$8 + 1 = 9$, and the row must make 15. So $15 - 9 = 6$.",
    },
    {
      slug: "c7-np-mag-p3",
      concept_slug: "magic-squares",
      kind: "practice",
      difficulty: 2,
      stem_md: "What number belongs in the blank cell?",
      stem_viz: {
        kind: "numberGrid",
        rows: 3,
        cols: 3,
        showSums: true,
        cells: [
          { value: 8 },
          { value: 1 },
          { value: 6 },
          { value: 3 },
          {},
          { value: 7 },
          { value: 4 },
          { value: 9 },
          { value: 2 },
        ],
      },
      answer_type: "integer",
      answer_value: "5",
      solution_md:
        "The top row is complete: $8 + 1 + 6 = 15$, so the magic total is 15. The middle row has $3 + 7 = 10$, and $15 - 10 = 5$.",
    },
    {
      slug: "c7-np-mag-p4",
      concept_slug: "magic-squares",
      kind: "practice",
      difficulty: 2,
      stem_md: "Every row and column adds to 10. What number belongs in the blank cell?",
      stem_viz: {
        kind: "numberGrid",
        rows: 2,
        cols: 2,
        showSums: true,
        cells: [{ value: 7 }, {}, { value: 3 }, { value: 7 }],
      },
      answer_type: "integer",
      answer_value: "3",
      solution_md: "The top row must make 10, and it has 7 so far. $10 - 7 = 3$.",
    },
    {
      slug: "c7-np-mag-p5",
      concept_slug: "magic-squares",
      kind: "practice",
      difficulty: 3,
      stem_md:
        "A 3×3 magic square uses each of 1 to 9 exactly once. What must every row add up to?",
      answer_type: "integer",
      answer_value: "15",
      solution_md:
        "1 to 9 add up to 45, and they sit in three rows that each total the same. So each row makes $45 \\div 3 = 15$.",
    },
    {
      slug: "c7-np-mag-p6",
      concept_slug: "magic-squares",
      kind: "practice",
      difficulty: 3,
      stem_md:
        "A row of a magic square has TWO blank cells. Can you work out either one from that row alone?",
      answer_type: "mcq",
      answer_value: "no",
      choices: [
        { id: "no", label: "No, you need a line with only one gap" },
        { id: "yes", label: "Yes, halve what is left" },
        { id: "sometimes", label: "Only if the total is even" },
      ],
      solution_md:
        "No. Two gaps in one line leaves a choice. Look for a line that is nearly finished, a gap is only forced when it is the last one.",
    },

    // ── number patterns ────────────────────────────────────────────────────
    {
      slug: "c7-np-pat-p1",
      concept_slug: "number-patterns",
      kind: "practice",
      difficulty: 1,
      stem_md: "In the sequence $1, 1, 2, 3, 5, 8, \\ldots$ what is the rule?",
      answer_type: "mcq",
      answer_value: "sum2",
      choices: [
        { id: "sum2", label: "Add the two numbers before it" },
        { id: "double", label: "Double the number before it" },
        { id: "add2", label: "Add 2 each time" },
      ],
      solution_md: "Each number is the sum of the two before it: $2 = 1 + 1$, $3 = 1 + 2$, $5 = 2 + 3$.",
    },
    {
      slug: "c7-np-pat-p2",
      concept_slug: "number-patterns",
      kind: "practice",
      difficulty: 1,
      stem_md: "What comes next: $1, 1, 2, 3, 5, 8, ?$",
      answer_type: "integer",
      answer_value: "13",
      solution_md: "Add the last two: $5 + 8 = 13$.",
    },
    {
      slug: "c7-np-pat-p3",
      concept_slug: "number-patterns",
      kind: "practice",
      difficulty: 2,
      stem_md: "What comes after 21 in $1, 1, 2, 3, 5, 8, 13, 21, ?$",
      answer_type: "integer",
      answer_value: "34",
      solution_md: "$13 + 21 = 34$. You never need a formula, just the two before it.",
    },
    {
      slug: "c7-np-pat-p4",
      concept_slug: "number-patterns",
      kind: "practice",
      difficulty: 2,
      stem_md:
        "The Virahāṅka numbers run odd, odd, even, odd, odd, even… How often does the pattern repeat?",
      answer_type: "integer",
      answer_value: "3",
      solution_md:
        "Every 3 terms. It follows from the parity rules: odd + odd = even, then even + odd = odd, then odd + even = odd.",
    },
    {
      slug: "c7-np-pat-p5",
      concept_slug: "number-patterns",
      kind: "practice",
      difficulty: 3,
      stem_md: "In $AB + B = 68$, each letter is a digit and $AB$ is a two-digit number. What is $B$?",
      answer_type: "integer",
      answer_value: "4",
      solution_md:
        "The ones column: $B + B$ ends in 8, so $B$ is 4 or 9. If $B = 9$ the ones column carries and the tens cannot reach 6. So $B = 4$.",
    },
    {
      slug: "c7-np-pat-p6",
      concept_slug: "number-patterns",
      kind: "practice",
      difficulty: 3,
      stem_md: "In $AB + B = 68$, what is $A$?",
      answer_type: "integer",
      answer_value: "6",
      solution_md: "Once $B = 4$, the sum reads $A4 + 4 = 68$, so $A4 = 64$ and $A = 6$.",
    },

    // ── quiz ───────────────────────────────────────────────────────────────
    {
      slug: "c7-np-q1",
      concept_slug: "parity",
      kind: "quiz",
      difficulty: 1,
      stem_md: "Is 154 odd or even?",
      answer_type: "mcq",
      answer_value: "even",
      choices: [
        { id: "even", label: "Even" },
        { id: "odd", label: "Odd" },
      ],
      solution_md: "The last digit is 4, so it is even.",
    },
    {
      slug: "c7-np-q2",
      concept_slug: "parity",
      kind: "quiz",
      difficulty: 2,
      stem_md: "Is $-12$ odd or even?",
      answer_type: "mcq",
      answer_value: "even",
      choices: [
        { id: "even", label: "Even" },
        { id: "odd", label: "Odd" },
      ],
      solution_md: "Even, the same as 12. Parity does not care about the sign.",
    },
    {
      slug: "c7-np-q3",
      concept_slug: "parity-rules",
      kind: "quiz",
      difficulty: 1,
      stem_md: "Is $9 + 6$ odd or even?",
      answer_type: "mcq",
      answer_value: "odd",
      choices: [
        { id: "odd", label: "Odd" },
        { id: "even", label: "Even" },
      ],
      solution_md: "Odd + even = odd. The 9 leaves one over and there is nothing to pair it with.",
    },
    {
      slug: "c7-np-q4",
      concept_slug: "parity-rules",
      kind: "quiz",
      difficulty: 3,
      stem_md: "Is $3 + 5 + 7 + 9$ odd or even?",
      answer_type: "mcq",
      answer_value: "even",
      choices: [
        { id: "even", label: "Even" },
        { id: "odd", label: "Odd" },
      ],
      solution_md: "Four odd numbers is an even count of them, so the total is even. It is 24.",
    },
    {
      slug: "c7-np-q5",
      concept_slug: "magic-squares",
      kind: "quiz",
      difficulty: 2,
      stem_md: "Every row adds to 15. A row reads 4, 9 and one blank. What is the blank?",
      answer_type: "integer",
      answer_value: "2",
      solution_md: "$4 + 9 = 13$, and $15 - 13 = 2$.",
    },
    {
      slug: "c7-np-q6",
      concept_slug: "magic-squares",
      kind: "quiz",
      difficulty: 3,
      stem_md: "What number belongs in the blank cell?",
      stem_viz: {
        kind: "numberGrid",
        rows: 3,
        cols: 3,
        showSums: true,
        cells: [
          { value: 2 },
          { value: 7 },
          { value: 6 },
          { value: 9 },
          { value: 5 },
          {},
          { value: 4 },
          { value: 3 },
          { value: 8 },
        ],
      },
      answer_type: "integer",
      answer_value: "1",
      solution_md:
        "The top row is complete: $2 + 7 + 6 = 15$. The middle row has $9 + 5 = 14$, and $15 - 14 = 1$.",
    },
    {
      slug: "c7-np-q7",
      concept_slug: "number-patterns",
      kind: "quiz",
      difficulty: 1,
      stem_md: "What comes next: $2, 3, 5, 8, 13, ?$",
      answer_type: "integer",
      answer_value: "21",
      solution_md: "Add the last two: $8 + 13 = 21$.",
    },
    {
      slug: "c7-np-q8",
      concept_slug: "number-patterns",
      kind: "quiz",
      difficulty: 2,
      stem_md: "The next Virahāṅka number after 34 and 55 is what?",
      answer_type: "integer",
      answer_value: "89",
      solution_md: "$34 + 55 = 89$.",
    },
  ],
};
