---
name: saathi-content
description: Author and seed Saathi curriculum content — chapters, concepts, micro-lessons, and the practice/quiz question bank with canonical answers. Use when adding or editing curriculum, writing lesson bodies, building the question bank, tagging concepts, or running the seed script. Trigger on "add a chapter", "write lessons", "seed content", "question bank", "add practice questions".
---

# Authoring Saathi curriculum content

Content quality is the product. A wrong answer key or a lesson that drifts from
NCERT undermines every AI feature built on top of it.

MVP scope is fixed at **three chapters** (D1) — Class 6 Fractions, Class 7 Integers,
Class 8 Solving Linear Equations. Don't expand scope without updating D1.

## Where content lives

`supabase/seed/`, one TypeScript file per chapter, typed against the schema.
Loaded by `npm run seed`. **Idempotent — upsert on slug**, so re-running never
duplicates. Never put learner data in a seed file.

## Follow NCERT's concept order, not its chapter numbers

NCERT is mid-rollout of **Ganita Prakash**; chapter numbers have shifted and Class 8's
"Linear Equations in One Variable" no longer exists as a chapter (D1 has the full
mapping). Both editions are in circulation, and Saathi's learners are the most likely
to still hold old stock.

**Order concepts the way the textbook teaches them.** That sequence is stable across
editions; the numbering is not. Every chapter carries `ncert_ref` citing both.

Verified Class 6 Fractions sequence (Ganita Prakash Ch 7):

```
parts of a whole → measuring with fractional units → fractions on the number line
→ mixed fractions → EQUIVALENT FRACTIONS → simplest form → comparing
→ addition → subtraction
```

Mapped to Saathi's four concepts:

| # | Concept slug | Covers |
|---|---|---|
| 1 | `fraction-basics` | Parts of a whole, fractional units, the number line |
| 2 | `equivalent-fractions` | Equivalent fractions **+ simplest form** |
| 3 | `comparing-fractions` | Comparing and ordering |
| 4 | `adding-subtracting-fractions` | Addition and subtraction |

Mixed fractions is the deliberate cut — four concepts cannot hold nine sections, and
it is the one the rest do not depend on.

Concepts 2 pairs equivalent fractions with simplest form on purpose: NCERT teaches
them back to back, and simplest form has no gradeable question type of its own (see
the normalisation rule below).

## Chapter structure

```
Chapter → 4 concepts → 4–5 micro-lessons → question bank
```

Every lesson maps to exactly one concept. Every question is tagged with a concept.
That tagging is what makes mastery (D5) and adaptivity (D3) work at all — an
untagged question is invisible to the whole learning engine.

## Writing a micro-lesson

- **One concept. One idea.** If it needs "and also", it's two lessons.
- 150–300 words. `est_minutes` of 3–5.
- Structure: hook → explain → worked example → "you try" pointer into practice.
- Markdown with KaTeX for math: `$x + 3 = 7$` inline, `$$...$$` display.
- Plain English. Learners are 11–14 and may be reading in a second language. Short
  sentences beat precise-but-dense ones.
- Use rupee amounts, cricket scores, sharing rotis — contexts an Indian learner
  recognises. Not pizzas and dollars.
- Warm, never condescending. The learner is behind, not slow.

## Writing questions

Each question needs: `concept_id`, `kind` (`practice`|`quiz`), `difficulty` (1–3),
`stem_md`, `answer_type`, canonical `answer_value`, and `solution_md`.

**Coverage per concept:** at least 2 questions at each difficulty, so the adaptivity
rule (2 right → step up, 2 wrong → step down) always has somewhere to go. A concept
with one hard question dead-ends the learner.

**Canonical answers** — `answer_value` is the single normalised form. Grading
(`lib/learning/grading.ts`) handles equivalents, so you write `1/2` and the grader
accepts `2/4` and `0.5`. Don't try to enumerate variants in the seed.

| answer_type | Write `answer_value` as |
|---|---|
| `mcq` | the correct choice id, e.g. `"b"` |
| `integer` | `"-7"` |
| `fraction` | lowest terms, `"3/4"` |
| `decimal` | `"2.5"` |
| `expression` | normalised, `"x=4"` |

### The grader normalises — do not author questions it cannot mark

`grade()` reduces fractions to lowest terms, so `6/8` and `3/4` are the same answer.
That is correct behaviour, and it **destroys two categories of NCERT question**:

| Question | What happens |
|---|---|
| "Write $6/8$ in its lowest terms" | Learner types `6/8` → graded **correct** |
| "What fraction of matches were won?" | Learner types `15/20` → graded **correct** |

In both, reducing *is* the skill being tested, and the grader reduces for them. The
question becomes impossible to fail.

**Fix, at no cost:** ask for the missing *number*, not the fraction.
`18/24 = 3/□` with `answer_type: "integer"` tests the identical skill and grades
exactly.

> **Rule:** never author a question whose point is producing lowest terms with
> `answer_type: "fraction"`. Use an `integer` fill-in-the-box instead.

Worked example of the whole pattern:
`supabase/seed/SAMPLE-class6-equivalent-fractions.ts`.

**Distractors matter.** MCQ wrong options should encode the *actual* mistakes
learners make — sign errors on integers, adding denominators on fractions,
dropping a sign when moving terms across the equals. A distractor nobody picks
teaches you nothing.

**`solution_md` is a worked method, not just the answer.** The AI uses it as
grounding for hints, so a one-line answer produces useless hints.

## Hindi (D16 — MVP, not Phase 2)

Every chapter ships bilingual. Author in **English first**, then translate into the
row's `i18n` jsonb, then **verify by reading it**.

> **Load `docs/HINDI_STYLE.md` before any Hindi work.**
>
> The default for lesson bodies, question stems and solutions is: **write it the way
> the learner's own NCERT Hindi maths textbook writes it.** Anchor the prompt to the
> real book — *"Write this the way the NCERT Class 6 Ganit (Hindi) textbook writes
> it"* — because that is a target you can verify by opening the actual textbook.
> Conversational register applies only to UI chrome, tutor dialogue and feedback,
> where no textbook equivalent exists.

**Staleness is the maintenance risk.** Editing an English `body_md` silently leaves
the Hindi in `i18n` stale — nothing catches it. When you change English content,
change the Hindi in the same commit, or the two drift apart within a week.

```json
"i18n": { "hi": { "title": "...", "body_md": "...", "stem_md": "...", "solution_md": "..." } }
```

**`answer_value` is never translated.** `1/2` is `1/2` in every language. Hindi
touches `body_md`, `stem_md`, `solution_md` and `choices` labels — never the answer.
This is what keeps translation off the grading path entirely.

Check every translation for:

- **NCERT mathematical terms** — भिन्न (fraction), पूर्णांक (integer), समीकरण
  (equation), हर/अंश (denominator/numerator). Use the textbook term, not a literal
  translation.
- **Arabic numerals preserved** — `1/2`, never `१/२`.
- **KaTeX untouched** — `$x + 3 = 7$` passes through verbatim.
- **Everyday register** — write for a 12-year-old, not a government notice.
- **Cultural contexts survive** — rupees, cricket and rotis translate naturally;
  don't let the translation drift back to pizzas and dollars.

Missing translation → falls back to English. Never ship an empty screen.

## Verify answer keys — automated, not by hand

A wrong answer key marks correct learners wrong. It is the most damaging bug this
product can have, and the only one **completely invisible from inside the app** —
nothing errors, nothing logs. So it gets a machine check, not good intentions.

**Do not trust a generated answer key, including your own.** But do not hand-solve
the whole bank either. Run `scripts/verify-answer-keys.ts` (slice 2.1c):

1. For each question, send **only the stem** to Claude Haiku and have it solve cold.
2. Compare its answer to the stored `answer_value` through `lib/learning/grading.ts`.
3. Print a table of every disagreement.
4. **A human reviews only the disagreements.**

Two independent solves agreeing is real evidence. Expect roughly 5–10% flagged on a
first pass. Cost is a couple of rupees for the whole bank.

> **Never put the stored answer in the verification prompt.** A model shown the
> answer will agree with it. That turns the check into theatre.

Bonus: this runs the whole bank through `grade()`, so a grader bug (rejecting `0.5`
against `1/2`) shows up as a false disagreement. Check the grader before assuming
the content is wrong.

Ordering: **after slice 2.1**, since it needs `grade()`. Content is seeded on Day 1
and verified on Day 2.

After seeding, still spot-check in the app: open a chapter, complete a lesson, run
practice, and confirm grading accepts an equivalent-but-differently-written answer.

```bash
npm run seed
npm run verify:answers   # after slice 2.1
```
