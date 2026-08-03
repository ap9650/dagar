import type { SeedChapter } from "./types.ts";

/**
 * Class 6 · Data Handling and Presentation · Ganita Prakash Ch 4
 *
 * Added 3 Aug 2026 because a real teacher is teaching this chapter tomorrow and
 * her students will use Dagar for the homework. That is the best distribution
 * this product has had, and it is why this chapter exists before any other.
 *
 * ── THE SHAPE OF THE CHAPTER ────────────────────────────────────────────────
 * Tally → pictograph → bar graph is not three topics. It is ONE idea climbing a
 * ladder of abstraction, and the reason to climb is practical each time:
 *
 *   raw marks   are hard to COUNT      → bundle them in fives
 *   tallies     are hard to COMPARE    → draw one symbol per few
 *   pictographs get silly at scale     → draw a bar and read a height
 *
 * So every lesson ends where the next begins, and the `chart` primitive draws
 * all three from the same numbers — a learner sees the SAME data change form,
 * rather than three unrelated pictures (see `viz/types.ts`).
 *
 * The fourth concept is the one the textbook actually cares about and the one
 * that is easiest to skip: a chart is for ANSWERING something. Reading a height
 * is a skill; knowing which question the height answers is the point.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Contexts are deliberately local — kabaddi and kho-kho, not baseball; rotis and
 * bus routes, not pizza (HINDI_STYLE: cultural contexts survive translation).
 *
 * English only here. Hindi lives in `seed/translations/hi.json`, added in the
 * same commit — if an English string changes, the Hindi changes with it or the
 * two drift silently for the learners least able to report it.
 */
export const class6DataHandling: SeedChapter = {
  slug: "class6-data-handling",
  grade: 6,
  number: 4,
  title: "Data Handling and Presentation",
  summary:
    "How to collect information, organise it with tally marks, show it as pictographs and bar graphs, and read the answer off the picture.",
  // New NCERT only. The old edition is no longer cited anywhere — see D1.
  ncert_ref: "Ganita Prakash Class 6 Ch 4 (Data Handling and Presentation)",
  order_index: 1,

  concepts: [
    { slug: "organising-data", name: "Organising Data", order_index: 1 },
    { slug: "pictographs", name: "Pictographs", order_index: 2 },
    { slug: "bar-graphs", name: "Bar Graphs", order_index: 3 },
    { slug: "reading-data", name: "Reading Data", order_index: 4 },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // LESSONS
  // ═══════════════════════════════════════════════════════════════════════════
  lessons: [
    {
      slug: "c6-dh-l1",
      concept_slug: "organising-data",
      order_index: 1,
      title: "What Data Is, and Why We Bundle It",
      est_minutes: 4,
      body_md: [
        "Your class is choosing one game to play on Saturday. You ask all 40 students which game they want.",
        "",
        "The answers come in a jumble: *kabaddi, cricket, cricket, kho-kho, cricket, chess, kabaddi…*",
        "",
        "That jumble is **data** — information you have collected. It is completely correct, and completely useless, because nobody can tell from it which game won.",
        "",
        "Data has to be **organised** before it can answer anything.",
        "",
        "### Tally marks",
        "",
        "As each answer comes in, you draw one mark. But a long row of marks is as hard to count as the jumble was — so marks are **bundled in fives**.",
        "",
        "Four upright marks, and the fifth drawn *across* them:",
        "",
        "That bundle is worth 5. Two bundles and two marks is $5 + 5 + 2 = 12$.",
        "",
        "**Why five?** Because you can see five at a glance without counting it. A bundle of seven would need counting, which is the problem tally marks exist to remove.",
        "",
        "### Worked example",
        "",
        "Kabaddi got 12 votes. As tally marks that is two full bundles and two singles.",
        "",
        "To read any tally back: count the bundles, multiply by 5, then add the leftover marks.",
      ].join("\n"),

      steps: [
        {
          kind: "see",
          md: "Your class is choosing a game for Saturday. You ask all 40 students. The answers arrive in a jumble.",
        },
        {
          // The chart carries no bundling yet — this is the mess, on purpose.
          kind: "see",
          md: "This is **data**: information you collected. Correct, and useless — you still cannot say which game won.",
          viz: {
            kind: "chart",
            variant: "tally",
            categories: [
              { label: "Kabaddi", value: 12 },
              { label: "Cricket", value: 17 },
              { label: "Kho-kho", value: 8 },
              { label: "Chess", value: 3 },
            ],
          },
        },
        {
          kind: "reveal",
          md: "Look at the kabaddi row. The marks are in groups. How many marks are in each full group?",
          answer:
            "Five. Four upright, and the fifth drawn across them — a bundle you can see at a glance without counting.",
        },
        {
          kind: "see",
          md: "That is why five: you recognise a bundle without counting it. A bundle of seven would need counting, which is the problem we are solving.",
          viz: {
            kind: "chart",
            variant: "tally",
            categories: [
              { label: "Kabaddi", value: 12, tone: "correct" },
              { label: "Chess", value: 3 },
            ],
          },
        },
        {
          kind: "worked",
          md: "So reading a tally back is arithmetic, not counting.",
          lines: [
            "Kabaddi has 2 full bundles and 2 single marks.",
            "Bundles first: $2 \\times 5 = 10$.",
            "Then the leftovers: $10 + 2 = 12$.",
          ],
        },
        {
          kind: "tap",
          md: "Cricket has 3 full bundles and 2 singles. How many votes is that?",
          options: [{ label: "15" }, { label: "17" }, { label: "32" }, { label: "5" }],
          answer: 1,
          why: "$3 \\times 5 = 15$, then add the 2 leftover marks to get 17.",
        },
        {
          kind: "reveal",
          md: "Now the question you actually asked. Which game should the class play on Saturday?",
          answer: "Cricket, with 17 votes — the most of any game. Organised data answers it in one look.",
          viz: {
            kind: "chart",
            variant: "tally",
            categories: [
              { label: "Kabaddi", value: 12 },
              { label: "Cricket", value: 17, tone: "correct" },
              { label: "Kho-kho", value: 8 },
              { label: "Chess", value: 3 },
            ],
          },
        },
      ],
    },

    {
      slug: "c6-dh-l2",
      concept_slug: "pictographs",
      order_index: 2,
      title: "Pictographs, and the Key That Decides Everything",
      est_minutes: 4,
      body_md: [
        "Tally marks are quick to write, but hard to compare. Which is bigger — 17 marks or 12 marks? You have to count both.",
        "",
        "A **pictograph** uses a picture for each thing, so comparing is just looking at which row is longer.",
        "",
        "### The problem with one picture per thing",
        "",
        "17 votes means drawing 17 pictures. For a whole school it would be hundreds.",
        "",
        "So one picture stands for **several** things, and a line called the **key** tells you how many:",
        "",
        "> Each circle stands for 5 students.",
        "",
        "**The key is the whole chart.** Read it as 1 instead of 5 and every single answer is wrong — not slightly wrong, five times wrong.",
        "",
        "### Reading a pictograph",
        "",
        "Count the whole pictures, multiply by the key, then add the part-picture.",
        "",
        "Three whole circles with a key of 5 is $3 \\times 5 = 15$. A half circle is worth half of 5, which is 2 and a half.",
        "",
        "### Worked example",
        "",
        "Cricket shows 3 whole circles and a bit more, with a key of 5.",
        "",
        "$3 \\times 5 = 15$, and the part-circle is about two fifths of 5, which is 2. So cricket is about 17.",
      ].join("\n"),

      steps: [
        {
          kind: "see",
          md: "Tally marks are quick to write and hard to compare. Which is more, 17 marks or 12? You have to count both.",
          viz: {
            kind: "chart",
            variant: "tally",
            categories: [
              { label: "Kabaddi", value: 12 },
              { label: "Cricket", value: 17 },
            ],
          },
        },
        {
          kind: "see",
          md: "Same votes, drawn as pictures. Now the longer row IS the bigger number — no counting needed.",
          viz: {
            kind: "chart",
            variant: "pictograph",
            each: 5,
            categories: [
              { label: "Kabaddi", value: 12 },
              { label: "Cricket", value: 17 },
              { label: "Kho-kho", value: 8 },
              { label: "Chess", value: 3 },
            ],
          },
        },
        {
          kind: "reveal",
          md: "Kabaddi got 12 votes but shows only about 2 and a half circles. Why not 12 circles?",
          answer:
            "Because one circle stands for 5 students. That line is called the **key**, and it is written above every pictograph.",
        },
        {
          kind: "worked",
          md: "So reading a pictograph is multiplying, then adding the bit left over.",
          lines: [
            "Cricket shows 3 whole circles.",
            "Each circle is 5, so $3 \\times 5 = 15$.",
            "The part-circle is about two fifths of 5, which is 2.",
            "$15 + 2 = 17$ votes.",
          ],
        },
        {
          kind: "tap",
          md: "Kho-kho shows 1 whole circle and a bit more. With a key of 5, which is closest?",
          options: [{ label: "1 vote" }, { label: "5 votes" }, { label: "8 votes" }, { label: "15 votes" }],
          answer: 2,
          why: "One whole circle is 5, and the part-circle adds about 3 more. $5 + 3 = 8$.",
        },
        {
          // The single most-missed idea in the chapter, asked directly.
          kind: "reveal",
          md: "Somebody reads that same chart thinking each circle means 1 student. What do they get for kho-kho?",
          answer:
            "About 1 instead of 8. Ignoring the key does not make you a little wrong — it makes you five times wrong.",
        },
        {
          kind: "see",
          md: "So always read the key first, before you count a single picture.",
          viz: {
            kind: "chart",
            variant: "pictograph",
            each: 5,
            categories: [
              { label: "Kho-kho", value: 8, tone: "correct" },
              { label: "Chess", value: 3 },
            ],
          },
        },
      ],
    },

    {
      slug: "c6-dh-l3",
      concept_slug: "bar-graphs",
      order_index: 3,
      title: "Bar Graphs: Reading a Height",
      est_minutes: 4,
      body_md: [
        "A pictograph with a key of 5 works for 17 votes. For 1,700 it would need 340 circles.",
        "",
        "A **bar graph** replaces the pictures with a single bar, and you read its **height** against a scale up the side.",
        "",
        "### The parts of a bar graph",
        "",
        "- Along the bottom: the **categories** — the things being compared.",
        "- Up the side: the **scale** — the numbers, with a line at each step.",
        "- The **bars** themselves, all the same width, standing on the bottom line.",
        "",
        "**All bars start at zero.** A bar that starts higher up makes a small difference look enormous, and that is how charts lie.",
        "",
        "### Reading a value",
        "",
        "Find the top of the bar, move straight across to the scale, and read the number.",
        "",
        "If the top sits between two lines, the value is between those two numbers.",
        "",
        "### Worked example",
        "",
        "The scale goes up in 5s. The cricket bar reaches a little above the line marked 15.",
        "",
        "So cricket is a bit more than 15 — it is 17.",
        "",
        "The bars are all the same width on purpose. Only the **height** carries the number; a wider bar does not mean more.",
      ].join("\n"),

      steps: [
        {
          kind: "see",
          md: "A key of 5 works for 17 votes. For 1,700 you would draw 340 circles. Pictures stop being practical.",
          viz: {
            kind: "chart",
            variant: "pictograph",
            each: 5,
            categories: [
              { label: "Cricket", value: 17 },
              { label: "Chess", value: 3 },
            ],
          },
        },
        {
          kind: "see",
          md: "Same four numbers, drawn as bars. Each bar's **height** is the number now — no counting at all.",
          viz: {
            kind: "chart",
            variant: "bar",
            categories: [
              { label: "Kabaddi", value: 12 },
              { label: "Cricket", value: 17 },
              { label: "Kho-kho", value: 8 },
              { label: "Chess", value: 3 },
            ],
          },
        },
        {
          kind: "reveal",
          md: "Look up the left side. The numbers go 0, 5, 10, 15, 20. What is that called, and what is it for?",
          answer:
            "The **scale**. You read a bar by finding its top and moving straight across to these numbers.",
        },
        {
          kind: "worked",
          md: "Reading the cricket bar, step by step.",
          lines: [
            "Find the top of the cricket bar.",
            "Move straight across to the scale on the left.",
            "It sits a little above the line marked 15.",
            "So cricket is a bit more than 15 — it is 17.",
          ],
        },
        {
          kind: "tap",
          md: "Now the kho-kho bar. Its top sits between 5 and 10. Which value is it?",
          options: [{ label: "5" }, { label: "8" }, { label: "12" }, { label: "20" }],
          answer: 1,
          why: "Between 5 and 10, and closer to 10 — it is 8. Every bar carries its number above it too.",
        },
        {
          kind: "see",
          md: "Every bar is the same width. Only the height carries the number — a wider bar does not mean more.",
          viz: {
            kind: "chart",
            variant: "bar",
            categories: [
              { label: "Kho-kho", value: 8, tone: "correct" },
              { label: "Chess", value: 3 },
            ],
          },
        },
        {
          kind: "reveal",
          md: "One more rule. Why must every bar start at zero and not somewhere higher up?",
          answer:
            "Because starting higher makes a small difference look enormous. Bars from zero is what makes the picture honest.",
        },
      ],
    },

    {
      slug: "c6-dh-l4",
      concept_slug: "bar-graphs",
      order_index: 4,
      title: "Choosing the Scale",
      est_minutes: 3,
      body_md: [
        "You have collected how many students in each of five classes walk to school: 30, 45, 25, 50 and 35.",
        "",
        "If the scale goes up in 1s, the graph needs 50 lines and will not fit on the page.",
        "",
        "If it goes up in 100s, every bar is a stub and you cannot tell them apart.",
        "",
        "### The rule",
        "",
        "Pick a scale where **the tallest bar nearly fills the height**, and where the numbers are easy to count in — 2s, 5s, 10s, 20s, 100s.",
        "",
        "For a largest value of 50, going up in 10s gives six lines: 0, 10, 20, 30, 40, 50. That is readable.",
        "",
        "### Why it matters",
        "",
        "The scale decides what the reader sees. The same data on a squashed scale looks like everyone is the same, and on a stretched one looks like a crisis.",
        "",
        "Choosing a fair scale is part of telling the truth with a graph.",
      ].join("\n"),

      steps: [
        {
          kind: "see",
          md: "Five classes, and how many walk to school: 30, 45, 25, 50, 35. These need a scale before they can be drawn.",
          viz: {
            kind: "chart",
            variant: "bar",
            categories: [
              { label: "6A", value: 30 },
              { label: "6B", value: 45 },
              { label: "6C", value: 25 },
              { label: "6D", value: 50 },
              { label: "6E", value: 35 },
            ],
          },
        },
        {
          kind: "reveal",
          md: "Why would a scale going up in 1s be a bad choice here?",
          answer: "It needs 50 lines. The graph would not fit on the page, and nobody could read it.",
        },
        {
          kind: "tap",
          md: "The largest value is 50. Which scale reads best?",
          options: [{ label: "Up in 1s" }, { label: "Up in 10s" }, { label: "Up in 100s" }],
          answer: 1,
          why: "Up in 10s gives 0, 10, 20, 30, 40, 50 — six lines, and the tallest bar fills the height.",
        },
        {
          kind: "see",
          md: "Up in 100s instead, and every bar becomes a stub. The data has not changed — only the scale has.",
          viz: {
            kind: "chart",
            variant: "bar",
            max: 100,
            categories: [
              { label: "6A", value: 30 },
              { label: "6B", value: 45 },
              { label: "6C", value: 25 },
              { label: "6D", value: 50, tone: "notquite" },
              { label: "6E", value: 35 },
            ],
          },
        },
        {
          kind: "reveal",
          md: "So what is a fair scale?",
          answer:
            "One where the tallest bar nearly fills the height, and the numbers count in 2s, 5s, 10s or 100s.",
        },
      ],
    },

    {
      slug: "c6-dh-l5",
      concept_slug: "reading-data",
      order_index: 5,
      title: "What the Picture Actually Tells You",
      est_minutes: 4,
      body_md: [
        "A graph is not the end of the work. It is a tool for answering a question, and the question came first.",
        "",
        "### The four things a chart is usually asked",
        "",
        "- **Which is most?** The tallest bar, the longest row.",
        "- **Which is least?** The shortest.",
        "- **How many altogether?** Add every value.",
        "- **How many more?** Subtract one from the other.",
        "",
        "That last one is where marks are lost. *How many more chose cricket than chess?* is a **subtraction**, not a reading. $17 - 3 = 14$.",
        "",
        "### What a chart cannot tell you",
        "",
        "The cricket bar says 17 students chose cricket. It does not say **why**, or who they were, or whether they would say the same next week.",
        "",
        "A graph answers exactly the question the data was collected for, and nothing beyond it.",
        "",
        "### Worked example",
        "",
        "Total students asked: $12 + 17 + 8 + 3 = 40$.",
        "",
        "That total is worth checking — if it does not match the number of students you asked, something was miscounted.",
      ].join("\n"),

      steps: [
        {
          kind: "see",
          md: "A graph is not the end of the work. Somebody asked a question first, and the graph is how you answer it.",
          viz: {
            kind: "chart",
            variant: "bar",
            categories: [
              { label: "Kabaddi", value: 12 },
              { label: "Cricket", value: 17 },
              { label: "Kho-kho", value: 8 },
              { label: "Chess", value: 3 },
            ],
          },
        },
        {
          kind: "tap",
          md: "Which game was chosen least?",
          options: [{ label: "Kabaddi" }, { label: "Kho-kho" }, { label: "Chess" }],
          answer: 2,
          why: "Chess, with 3 — the shortest bar. Least means shortest, exactly as most means tallest.",
        },
        {
          // The question type that actually loses marks.
          kind: "worked",
          md: "Now a harder one: how many MORE chose cricket than chess?",
          lines: [
            "This is not a reading — it is a subtraction.",
            "Cricket is 17. Chess is 3.",
            "$17 - 3 = 14$ more students.",
          ],
        },
        {
          kind: "tap",
          md: "How many more chose kabaddi than kho-kho?",
          options: [{ label: "4" }, { label: "8" }, { label: "12" }, { label: "20" }],
          answer: 0,
          why: "$12 - 8 = 4$. Reading both bars is only half the job; the question asks for the difference.",
        },
        {
          kind: "reveal",
          md: "Add all four values. Why is that total worth checking?",
          answer:
            "$12 + 17 + 8 + 3 = 40$, and 40 students were asked. If it did not match, something was miscounted.",
        },
        {
          kind: "reveal",
          md: "Last one, and it is the important one. Does this graph tell you WHY 17 students chose cricket?",
          answer:
            "No. It says how many, not why. A graph answers the question the data was collected for, and nothing beyond it.",
        },
      ],
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTIONS — 2 per difficulty per concept so adaptivity always has somewhere
  // to go (D3), plus 2 quiz questions per concept.
  //
  // Wrong MCQ options encode real mistakes: reading a pictograph as 1-per-icon,
  // counting bundles instead of multiplying them, answering "how many more" with
  // a reading instead of a difference.
  // ═══════════════════════════════════════════════════════════════════════════
  questions: [
    // ── organising data ────────────────────────────────────────────────────
    {
      slug: "c6-dh-org-p1",
      concept_slug: "organising-data",
      kind: "practice",
      difficulty: 1,
      stem_md: "How many marks are in one full tally bundle?",
      answer_type: "integer",
      answer_value: "5",
      solution_md:
        "A bundle is four upright marks with the fifth drawn across them, so a full bundle is 5.",
    },
    {
      slug: "c6-dh-org-p2",
      concept_slug: "organising-data",
      kind: "practice",
      difficulty: 1,
      stem_md: "A tally shows 1 full bundle and 3 single marks. What number is it?",
      answer_type: "integer",
      answer_value: "8",
      solution_md: "One bundle is 5. Then add the 3 singles: $5 + 3 = 8$.",
    },
    {
      slug: "c6-dh-org-p3",
      concept_slug: "organising-data",
      kind: "practice",
      difficulty: 2,
      stem_md: "How many votes did cricket get?",
      stem_viz: {
        kind: "chart",
        variant: "tally",
        categories: [
          { label: "Kabaddi", value: 9 },
          { label: "Cricket", value: 14 },
          { label: "Chess", value: 6 },
        ],
      },
      answer_type: "integer",
      answer_value: "14",
      solution_md: "Cricket has 2 full bundles and 4 singles: $2 \\times 5 = 10$, then $10 + 4 = 14$.",
    },
    {
      slug: "c6-dh-org-p4",
      concept_slug: "organising-data",
      kind: "practice",
      difficulty: 2,
      stem_md: "A tally has 4 full bundles and 1 single mark. What number is it?",
      answer_type: "integer",
      answer_value: "21",
      solution_md: "$4 \\times 5 = 20$, then add the single mark: $20 + 1 = 21$.",
    },
    {
      slug: "c6-dh-org-p5",
      concept_slug: "organising-data",
      kind: "practice",
      difficulty: 3,
      stem_md:
        "23 students voted for kabaddi. How many FULL bundles of five will the tally have?",
      answer_type: "integer",
      answer_value: "4",
      solution_md:
        "$23 = 4 \\times 5 + 3$, so there are 4 full bundles and 3 single marks left over. The question asks only for the full bundles: 4.",
    },
    {
      slug: "c6-dh-org-p6",
      concept_slug: "organising-data",
      kind: "practice",
      difficulty: 3,
      stem_md: "How many students were asked altogether?",
      stem_viz: {
        kind: "chart",
        variant: "tally",
        categories: [
          { label: "Bus", value: 11 },
          { label: "Cycle", value: 7 },
          { label: "Walk", value: 12 },
        ],
      },
      answer_type: "integer",
      answer_value: "30",
      solution_md: "Read each row, then add them all: $11 + 7 + 12 = 30$ students.",
    },

    // ── pictographs ────────────────────────────────────────────────────────
    {
      slug: "c6-dh-pic-p1",
      concept_slug: "pictographs",
      kind: "practice",
      difficulty: 1,
      stem_md:
        "On a pictograph, each circle stands for 10 books. How many books do 3 whole circles show?",
      answer_type: "integer",
      answer_value: "30",
      solution_md: "Each circle is 10, so $3 \\times 10 = 30$ books.",
    },
    {
      slug: "c6-dh-pic-p2",
      concept_slug: "pictographs",
      kind: "practice",
      difficulty: 1,
      stem_md: "What is the line above a pictograph that tells you what one picture is worth?",
      answer_type: "mcq",
      answer_value: "key",
      choices: [
        { id: "key", label: "The key" },
        { id: "scale", label: "The scale" },
        { id: "title", label: "The title" },
        { id: "axis", label: "The axis" },
      ],
      solution_md:
        "It is the **key**. A scale runs up the side of a bar graph; a key tells you what one picture stands for.",
    },
    {
      slug: "c6-dh-pic-p3",
      concept_slug: "pictographs",
      kind: "practice",
      difficulty: 2,
      stem_md: "Each circle stands for 5 students. How many chose cricket?",
      stem_viz: {
        kind: "chart",
        variant: "pictograph",
        each: 5,
        categories: [
          { label: "Cricket", value: 20 },
          { label: "Chess", value: 10 },
        ],
      },
      answer_type: "integer",
      answer_value: "20",
      solution_md: "Cricket shows 4 whole circles, and each is worth 5: $4 \\times 5 = 20$.",
    },
    {
      slug: "c6-dh-pic-p4",
      concept_slug: "pictographs",
      kind: "practice",
      difficulty: 2,
      stem_md:
        "Each circle stands for 4 mangoes. A row shows 5 whole circles. How many mangoes is that?",
      answer_type: "integer",
      answer_value: "20",
      solution_md: "$5 \\times 4 = 20$ mangoes. Count the pictures, then multiply by the key.",
    },
    {
      slug: "c6-dh-pic-p5",
      concept_slug: "pictographs",
      kind: "practice",
      difficulty: 3,
      stem_md:
        "Each circle stands for 5 students. 35 students chose kabaddi. How many whole circles will its row have?",
      answer_type: "integer",
      answer_value: "7",
      solution_md: "Divide by the key: $35 \\div 5 = 7$ whole circles.",
    },
    {
      slug: "c6-dh-pic-p6",
      concept_slug: "pictographs",
      kind: "practice",
      difficulty: 3,
      stem_md:
        "A pictograph has a key of 10. Ravi reads it as though each picture were 1, and gets 6. What is the real number?",
      answer_type: "integer",
      answer_value: "60",
      solution_md:
        "Ravi counted 6 pictures. Each is worth 10, so the real number is $6 \\times 10 = 60$. Ignoring the key does not make you a little wrong — it makes you ten times wrong.",
    },

    // ── bar graphs ─────────────────────────────────────────────────────────
    {
      slug: "c6-dh-bar-p1",
      concept_slug: "bar-graphs",
      kind: "practice",
      difficulty: 1,
      stem_md: "How many students chose kho-kho?",
      stem_viz: {
        kind: "chart",
        variant: "bar",
        categories: [
          { label: "Kabaddi", value: 12 },
          { label: "Cricket", value: 17 },
          { label: "Kho-kho", value: 8 },
        ],
      },
      answer_type: "integer",
      answer_value: "8",
      solution_md: "Find the top of the kho-kho bar and read straight across to the scale: 8.",
    },
    {
      slug: "c6-dh-bar-p2",
      concept_slug: "bar-graphs",
      kind: "practice",
      difficulty: 1,
      stem_md: "On a bar graph, what must every bar start from?",
      answer_type: "mcq",
      answer_value: "zero",
      choices: [
        { id: "zero", label: "Zero" },
        { id: "smallest", label: "The smallest value" },
        { id: "anywhere", label: "Anywhere that fits" },
      ],
      solution_md:
        "Every bar starts at zero. Starting higher makes a small difference look enormous, which is how a graph misleads.",
    },
    {
      slug: "c6-dh-bar-p3",
      concept_slug: "bar-graphs",
      kind: "practice",
      difficulty: 2,
      stem_md: "Which class has the most students walking to school?",
      stem_viz: {
        kind: "chart",
        variant: "bar",
        categories: [
          { label: "6A", value: 30 },
          { label: "6B", value: 45 },
          { label: "6C", value: 25 },
        ],
      },
      answer_type: "mcq",
      answer_value: "b",
      choices: [
        { id: "a", label: "6A" },
        { id: "b", label: "6B" },
        { id: "c", label: "6C" },
      ],
      solution_md: "6B has the tallest bar at 45 students.",
    },
    {
      slug: "c6-dh-bar-p4",
      concept_slug: "bar-graphs",
      kind: "practice",
      difficulty: 2,
      stem_md: "How many students are in 6C?",
      stem_viz: {
        kind: "chart",
        variant: "bar",
        categories: [
          { label: "6A", value: 30 },
          { label: "6B", value: 45 },
          { label: "6C", value: 25 },
        ],
      },
      answer_type: "integer",
      answer_value: "25",
      solution_md: "The 6C bar sits between 20 and 30, halfway — it is 25.",
    },
    {
      slug: "c6-dh-bar-p5",
      concept_slug: "bar-graphs",
      kind: "practice",
      difficulty: 3,
      stem_md:
        "The largest value to be shown is 45. Which scale reads best on a bar graph?",
      answer_type: "mcq",
      answer_value: "tens",
      choices: [
        { id: "ones", label: "Up in 1s" },
        { id: "tens", label: "Up in 10s" },
        { id: "hundreds", label: "Up in 100s" },
      ],
      solution_md:
        "Up in 10s. In 1s the graph needs 45 lines and will not fit; in 100s every bar is a stub. In 10s the tallest bar nearly fills the height.",
    },
    {
      slug: "c6-dh-bar-p6",
      concept_slug: "bar-graphs",
      kind: "practice",
      difficulty: 3,
      stem_md: "How many students are in 6A and 6C together?",
      stem_viz: {
        kind: "chart",
        variant: "bar",
        categories: [
          { label: "6A", value: 30 },
          { label: "6B", value: 45 },
          { label: "6C", value: 25 },
        ],
      },
      answer_type: "integer",
      answer_value: "55",
      solution_md: "Read both bars, then add: $30 + 25 = 55$ students.",
    },

    // ── reading data ───────────────────────────────────────────────────────
    {
      slug: "c6-dh-read-p1",
      concept_slug: "reading-data",
      kind: "practice",
      difficulty: 1,
      stem_md: "Which fruit was chosen most?",
      stem_viz: {
        kind: "chart",
        variant: "bar",
        categories: [
          { label: "Mango", value: 18 },
          { label: "Banana", value: 9 },
          { label: "Guava", value: 6 },
        ],
      },
      answer_type: "mcq",
      answer_value: "mango",
      choices: [
        { id: "mango", label: "Mango" },
        { id: "banana", label: "Banana" },
        { id: "guava", label: "Guava" },
      ],
      solution_md: "Mango has the tallest bar at 18.",
    },
    {
      slug: "c6-dh-read-p2",
      concept_slug: "reading-data",
      kind: "practice",
      difficulty: 1,
      stem_md: "How many students chose guava?",
      stem_viz: {
        kind: "chart",
        variant: "bar",
        categories: [
          { label: "Mango", value: 18 },
          { label: "Banana", value: 9 },
          { label: "Guava", value: 6 },
        ],
      },
      answer_type: "integer",
      answer_value: "6",
      solution_md: "The guava bar reaches 6.",
    },
    {
      slug: "c6-dh-read-p3",
      concept_slug: "reading-data",
      kind: "practice",
      difficulty: 2,
      stem_md: "How many MORE students chose mango than banana?",
      stem_viz: {
        kind: "chart",
        variant: "bar",
        categories: [
          { label: "Mango", value: 18 },
          { label: "Banana", value: 9 },
          { label: "Guava", value: 6 },
        ],
      },
      answer_type: "integer",
      answer_value: "9",
      solution_md:
        "This is a subtraction, not a reading. Mango is 18 and banana is 9, so $18 - 9 = 9$ more students.",
    },
    {
      slug: "c6-dh-read-p4",
      concept_slug: "reading-data",
      kind: "practice",
      difficulty: 2,
      stem_md: "How many students were asked altogether?",
      stem_viz: {
        kind: "chart",
        variant: "bar",
        categories: [
          { label: "Mango", value: 18 },
          { label: "Banana", value: 9 },
          { label: "Guava", value: 6 },
        ],
      },
      answer_type: "integer",
      answer_value: "33",
      solution_md: "Add every bar: $18 + 9 + 6 = 33$ students.",
    },
    {
      slug: "c6-dh-read-p5",
      concept_slug: "reading-data",
      kind: "practice",
      difficulty: 3,
      stem_md: "How many more students chose bus than cycle?",
      stem_viz: {
        kind: "chart",
        variant: "pictograph",
        each: 10,
        categories: [
          { label: "Bus", value: 40 },
          { label: "Cycle", value: 20 },
          { label: "Walk", value: 30 },
        ],
      },
      answer_type: "integer",
      answer_value: "20",
      solution_md:
        "Each circle is 10. Bus shows 4 circles, so 40; cycle shows 2, so 20. Then subtract: $40 - 20 = 20$ more.",
    },
    {
      slug: "c6-dh-read-p6",
      concept_slug: "reading-data",
      kind: "practice",
      difficulty: 3,
      stem_md: "Which question can this graph NOT answer?",
      stem_viz: {
        kind: "chart",
        variant: "bar",
        categories: [
          { label: "Mango", value: 18 },
          { label: "Banana", value: 9 },
          { label: "Guava", value: 6 },
        ],
      },
      answer_type: "mcq",
      answer_value: "why",
      choices: [
        { id: "why", label: "Why students chose mango" },
        { id: "most", label: "Which fruit was chosen most" },
        { id: "total", label: "How many students were asked" },
        { id: "diff", label: "How many more chose mango than guava" },
      ],
      solution_md:
        "A graph says how many, not why. The other three are all answered by reading, adding or subtracting the bars.",
    },

    // ── quiz: 2 per concept ────────────────────────────────────────────────
    {
      slug: "c6-dh-q1",
      concept_slug: "organising-data",
      kind: "quiz",
      difficulty: 1,
      stem_md: "A tally shows 3 full bundles and 4 single marks. What number is it?",
      answer_type: "integer",
      answer_value: "19",
      solution_md: "$3 \\times 5 = 15$, then $15 + 4 = 19$.",
    },
    {
      slug: "c6-dh-q2",
      concept_slug: "organising-data",
      kind: "quiz",
      difficulty: 2,
      stem_md: "17 students chose cricket. How many single marks are left over after the full bundles?",
      answer_type: "integer",
      answer_value: "2",
      solution_md: "$17 = 3 \\times 5 + 2$, so there are 3 full bundles and 2 single marks.",
    },
    {
      slug: "c6-dh-q3",
      concept_slug: "pictographs",
      kind: "quiz",
      difficulty: 1,
      stem_md: "Each picture stands for 5 students. How many students do 6 whole pictures show?",
      answer_type: "integer",
      answer_value: "30",
      solution_md: "$6 \\times 5 = 30$ students.",
    },
    {
      slug: "c6-dh-q4",
      concept_slug: "pictographs",
      kind: "quiz",
      difficulty: 2,
      stem_md:
        "Each picture stands for 20 books. A library row shows 4 whole pictures. How many books?",
      answer_type: "integer",
      answer_value: "80",
      solution_md: "$4 \\times 20 = 80$ books. Always read the key before counting pictures.",
    },
    {
      slug: "c6-dh-q5",
      concept_slug: "bar-graphs",
      kind: "quiz",
      difficulty: 1,
      stem_md: "On a bar graph, what does the height of a bar tell you?",
      answer_type: "mcq",
      answer_value: "value",
      choices: [
        { id: "value", label: "How many there are" },
        { id: "width", label: "How wide the category is" },
        { id: "order", label: "Which came first" },
      ],
      solution_md:
        "Only the height carries the number. Every bar is drawn the same width on purpose.",
    },
    {
      slug: "c6-dh-q6",
      concept_slug: "bar-graphs",
      kind: "quiz",
      difficulty: 2,
      stem_md: "How many students are in 6B?",
      stem_viz: {
        kind: "chart",
        variant: "bar",
        categories: [
          { label: "6A", value: 20 },
          { label: "6B", value: 35 },
          { label: "6C", value: 15 },
        ],
      },
      answer_type: "integer",
      answer_value: "35",
      solution_md: "The 6B bar sits halfway between 30 and 40 — it is 35.",
    },
    {
      slug: "c6-dh-q7",
      concept_slug: "reading-data",
      kind: "quiz",
      difficulty: 2,
      stem_md: "How many more students are in 6B than 6C?",
      stem_viz: {
        kind: "chart",
        variant: "bar",
        categories: [
          { label: "6A", value: 20 },
          { label: "6B", value: 35 },
          { label: "6C", value: 15 },
        ],
      },
      answer_type: "integer",
      answer_value: "20",
      solution_md: "$35 - 15 = 20$ more students. 'How many more' is always a subtraction.",
    },
    {
      slug: "c6-dh-q8",
      concept_slug: "reading-data",
      kind: "quiz",
      difficulty: 3,
      stem_md: "How many students are there in all three classes?",
      stem_viz: {
        kind: "chart",
        variant: "bar",
        categories: [
          { label: "6A", value: 20 },
          { label: "6B", value: 35 },
          { label: "6C", value: 15 },
        ],
      },
      answer_type: "integer",
      answer_value: "70",
      solution_md: "Add every bar: $20 + 35 + 15 = 70$ students.",
    },
  ],
};
