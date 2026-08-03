# Spec — Interactive Lessons and Practice

**Build slice:** 5.1 (lessons), 5.2 (practice) · **Implements:** D18 · **Depends on:** `micro-lesson.md`, `guided-practice.md`, `i18n.md`, `saathi-design`

> **Why this exists.** A teacher of Classes 6–8 used Dagar on 2 Aug 2026 and said
> the lessons are walls of text: her students cannot hold two paragraphs, and
> comprehension across one classroom varies enormously. She is right, and the
> lesson content proves it — Class 6 Lesson 1 says *"cut one roti into 4 equal
> pieces"* and shows nothing. Across all 15 lessons there is not one image,
> diagram or sound.
>
> This slice changes the **unit of a lesson** from a scroll of prose to a
> sequence of single-idea screens, each with something to see and, often,
> something to touch.

---

## 1. The locked content contract

These are the rules an author writes to. They are the spec, not suggestions.

| # | Rule |
|---|---|
| **C1** | **A step is one screen.** It must fit 360×640 with no scrolling. If it does not fit, it is two steps. |
| **C2** | **≤ 25 words of prose per step**, at most two sentences. The visual carries the rest. |
| **C3** | **Concrete → Pictorial → Abstract.** Notation never appears before the picture that earns it. `$\frac{1}{4}$` may only follow a shape already cut into four. |
| **C4** | **An interaction at least every third step.** Never three passive screens in a row. |
| **C5** | **6–9 steps per lesson.** `est_minutes` stays at 4 — this is a redistribution of attention, not more content. |
| **C6** | **One idea per step.** If a step needs "and also", it is two steps. |
| **C7** | **A lesson never grades.** A wrong tap shows the right answer with its picture and moves on — amber, one line of why, no score, no retry gate, nothing written to `attempts`. Assessment is practice and quiz; a lesson that tests is a lesson a struggling learner stops opening. |
| **C8** | **Everyday Indian context** — rotis, glasses of water, rupees, bus fare, cricket overs. Never "Alice has 3 apples". |
| **C9** | **Both languages, same steps.** Hindi is a translation of each step's prose, never a different step sequence. Numerals stay Arabic (D16). |

---

## 2. User flow

Replaces the body of `SCREENS.md` Flow 3 (Micro-lesson). Everything around it —
entry from the journey path, the sticky "practise this" footer on completion, the
tutor button — is unchanged.

```
Lesson opens
  ↓
Progress bar: step 1 of n          ← always visible, top of screen
  ↓
Step (see / build / tap / reveal / worked)
  ↓  "Continue" — or, on an interactive step, the interaction itself advances
Step …
  ↓
Last step → existing lesson-complete state and sticky footer
```

- **Back** returns to the previous step, not out of the lesson. Leaving is the
  header back button, as today.
- Step position is **not** persisted mid-lesson. A learner who leaves and returns
  starts the lesson again — 4 minutes is short enough that resume machinery costs
  more than it saves.
- `prefers-reduced-motion`: step transitions become instant cuts. No feature is
  removed.

---

## 3. Step kinds

Five, and no more without changing this spec.

| Kind | The learner… | Advances by |
|---|---|---|
| `see` | reads one sentence beside one diagram | tapping Continue |
| `build` | taps parts of a shape to construct the answer — "shade ¾" | reaching the target, then Continue |
| `tap` | picks between 2–4 **pictorial** options — "which one shows ⅜?" | choosing; feedback then Continue |
| `reveal` | is asked something, taps to uncover the answer | tapping Reveal, then Continue |
| `worked` | steps through a worked example one line at a time | tapping until lines are exhausted |

`build` is the highest-value kind for fractions and the one to reach for first.
`reveal` is the cheapest way to convert a passive paragraph into attention.

---

## 4. Visual primitives

**Five parameterised SVG components, instantiated ~60 times. Not 60 drawings.**
This is what makes the work authoring rather than illustration.

| Component | Props (shape, not exhaustive) | Covers |
|---|---|---|
| `PartWhole` | `shape: "circle" \| "bar" \| "grid"`, `parts`, `shaded`, `interactive` | fractions, equivalence, comparing |
| `NumberLine` | `from`, `to`, `step`, `marks[]`, `jumps[]` | fractions on a line, integers, add/subtract |
| `TokenRow` | `positive`, `negative`, `pairing` | integers, zero pairs |
| `BalanceScale` | `left[]`, `right[]`, `unknownLabel` | linear equations |
| `ArrayGrid` | `rows`, `cols`, `highlight` | multiplication, ratio |

Non-negotiables for every primitive:

- **Inline SVG.** No image files, no sprites, no external requests. Target < 2KB
  serialised. Data costs the learner money (design constraint 4).
- **Design tokens only.** Shaded parts `--color-primary`, unshaded `--color-surface`,
  outlines `--color-border-strong`. Never a hex literal.
- **`role="img"` with an `aria-label` that states the maths** — "a circle cut into
  4 equal parts, 1 part shaded". Colour is never the only signal (design rule 10);
  shaded parts also carry a pattern or a boundary.
- **Interactive variants have ≥44px touch targets.** A circle with 8 parts is
  therefore ≥ 200px across.
- **Pure and deterministic.** Same props, same SVG — so they can be snapshot-tested.

---

## 5. Audio

The teacher's sharpest point, and the one nobody would have predicted:

> **The spoken language is chosen separately from the written language.** A learner
> reading the English lesson may want it explained in Hindi.

- Web Speech API (`speechSynthesis`) — **zero files, zero bytes, no API cost.**
- A `🔊 हिंदी | English` control in the lesson header. Choice persists per learner
  in `localStorage`, independent of `profiles.locale`.
- Speaks the current step's prose only. Never the notation — `\frac{1}{4}` is read
  from the step's `speak` field if present, else the prose with LaTeX stripped.
- **Feature-detected.** No `hi-IN` voice on the device → the control is not
  rendered. It never appears broken.
- Stops on step change, on leaving, and on a second tap.

---

## 6. Data

- **Reads/writes:** no new tables. `lessons` gains one nullable column.
- **Migration `0020_lesson_steps.sql`** — `alter table public.lessons add column if
  not exists steps jsonb;` No RLS change: `lessons` is already readable by all
  authenticated users.
- Hindi step prose lives in the existing `lessons.i18n` jsonb, same shape as
  `title` and `body_md` today (D16). **Diagram props are not translated** — a
  circle cut into four is a circle cut into four.

### The ship-safe rule

`steps` is **additive and optional**:

```
lesson.steps  present → render the step player
lesson.steps  null    → render body_md exactly as today
```

Nothing is migrated, nothing is deleted, and at any hour we can stop and ship what
is authored. Class 6 can be interactive while Classes 7 and 8 stay as they are,
with no broken state in between. **This is the decision that de-risks the whole
slice** — real testers are using the deployed app while it is being built.

### One button finishes a lesson

Whichever shape it is. A prose lesson finishes at the button under the text; a
stepped lesson finishes at **the last step's own button**, not at a screen after
it.

The first build got this wrong in a way only a first-time learner ever saw. The
player had a `done` state that swapped the step body for a completion button
carrying the same label, so finishing read as: full progress bar, *step 8 of 8*,
**an empty screen**, and a second identical button asking again for something
already given. Open the lesson a second time and it arrives already complete, so
the screen said "Practise this" instead and the fault hid itself.

Two rules fall out of it, and both are asserted in `e2e/demo-path.spec.ts`:

- **The finishing action exists exactly once on screen.** After one tap on it,
  it is gone — replaced by what comes next.
- **`lesson_started` fires when the lesson opens**, not when it ends. The report
  lived inside the completion button, which on a stepped lesson was not mounted
  until the learner reached the last step — so every drop-off partway through was
  invisible in the funnel that exists to show exactly that.

---

## 7. Components

| File | Responsibility |
|---|---|
| `components/learn/viz/PartWhole.tsx` | the five primitives, one file each — |
| `components/learn/viz/NumberLine.tsx` | pure, prop-driven, no data fetching |
| `components/learn/viz/TokenRow.tsx` | |
| `components/learn/viz/BalanceScale.tsx` | |
| `components/learn/viz/ArrayGrid.tsx` | |
| `components/learn/viz/index.tsx` | `<Viz spec={…}/>` — maps a step's `viz` object to the right primitive. The only place the union is resolved. |
| `components/learn/LessonSteps.tsx` | the step player: progress, current step, Continue, back, transitions. The **last step's button finishes the lesson** via `onFinish` — see below |
| `components/learn/SteppedLesson.tsx` | player + finishing action in one client component, because the last step's button *is* the finishing action and a server component cannot pass a callback across that boundary |
| `components/learn/useLessonCompletion.ts` | opened / finished, as one piece of state. Shared by both lesson shapes so they cannot drift in what they record |
| `components/learn/LessonActions.tsx` | the foot of a lesson — finish it, then go somewhere. Rendered by both shapes |
| `components/learn/steps/*.tsx` | one component per step kind |
| `components/learn/SpeakButton.tsx` | audio control and language toggle |
| `lib/learning/lessonSteps.ts` | the `LessonStep` union, and a zod parser — a malformed `steps` blob falls back to `body_md` rather than crashing a lesson |

---

## 8. Analytics

**No new event names.** The canonical list stays closed (`DATA_MODEL.md`);
`lesson_started` and `lesson_completed` already bracket this screen.

`lesson_completed` gains props: `steps` (count) and `interactions` (how many
`build`/`tap` steps the learner engaged). Props are scalars and carry no free text,
per the analytics rule.

---

## 9. Acceptance criteria

- [ ] A lesson with `steps` renders one step per screen with a visible progress bar
- [ ] A lesson without `steps` renders exactly as it does today — verified against Class 7
- [ ] No step scrolls at 360×640
- [ ] No step exceeds 25 words of prose
- [ ] No three consecutive passive steps in any lesson
- [ ] `build` shading works by tap, with ≥44px targets, and reports its state to a screen reader
- [ ] A wrong `tap` shows the correct option with its picture, in amber, and never blocks
- [ ] Nothing from a lesson is written to `attempts`, and no score is shown
- [ ] Every primitive has an `aria-label` stating the maths
- [ ] Every primitive renders identically for the same props (snapshot tests)
- [ ] Every colour comes from a design token — no hex literals in `viz/`
- [ ] Audio speaks the current step; the language toggle is independent of the UI locale
- [ ] The audio control is absent, not broken, when no voice is available
- [ ] Step transitions are instant under `prefers-reduced-motion`
- [ ] Class 6 Fractions has all 5 lessons authored in **both** languages
- [ ] `npm run check:hindi` passes
- [ ] Full suite green

---

## 10. Edge cases

| Case | Behaviour |
|---|---|
| `steps` is malformed JSON or fails the zod parse | Fall back to `body_md`. Log server-side. A content mistake must never blank a lesson. |
| A step's `viz` names an unknown primitive | Render the prose alone. Same reasoning. |
| Learner leaves mid-lesson | Lesson restarts from step 1. Not resumed — see §2. |
| Device has an `en-IN` voice but no `hi-IN` | Toggle renders with English only; Hindi is not offered as a broken option. |
| Learner taps every `build` part rapidly | Target check is on final state, not on each tap. No flicker, no premature success. |
| Very long Hindi prose overflowing a step | Author error, caught by the ≤25 word rule. Hindi runs 10–20% longer — check every step in both languages (design rule 13). |
| Screen reader user | Progress announced as "step 3 of 8"; each primitive's `aria-label` states the maths; `build` state announced on change. |

---

## 10b. Practice becomes pictorial — slice 5.2

Everything above concerns lessons. Practice is a second surface, built on the same
five primitives, and it is where learners spend most of their minutes.

### What transfers from Duolingo, and what does not

The mechanic worth taking is **not** that it has pictures. It is that **you never
type**. Typing is where a learner's understanding gets lost in transit — into a
keyboard they are fighting, and into a rounding decision nobody taught them.

Not taken: hearts, streak pressure inside a session, or anything that ends a
practice set as a punishment. Same reasoning as D17.

### Two real defects this closes

| Defect | How pictorial input closes it |
|---|---|
| **No `/` on the Android keyboard** — reported from a phone 1 Aug; a slash key had to be added to the fraction input as a workaround | A learner choosing `3/8` from tiles never opens a keyboard |
| **Recurring decimals demand six places** — `5/12` as `0.42` is marked wrong (backlog 0b) | A learner picking a tile never has to decide how to round |

The workaround slash key stays for the typed fallback. The rounding item stays on
the backlog for the typed path, but stops being the *common* path.

### Input kinds

| Kind | The learner… | Best for |
|---|---|---|
| `choice-viz` | picks between 2–4 **diagrams** rather than text options | "which one shows ⅜?", comparing, equivalence |
| `tiles` | builds the answer from a bank of digits and symbols — `3`, `8`, `/`, `−` | any numeric or fraction answer; replaces the text input |
| `shade` | taps parts of a shape until it matches the target | fraction basics, equivalence |
| `place` | taps a position on a number line | integers, ordering, negative numbers |
| `typed` | the existing text input | **fallback** — kept for anything the four above cannot express |

`typed` is deliberately retained. A question the pictorial kinds cannot carry is a
question we should still be able to ask.

### What does NOT change

- **Grading stays exactly where it is.** `lib/learning/grading.ts` receives the same
  normalised string it does today; a tile answer is assembled into `3/8` and graded
  by the same code. **No new grading path, no second implementation** — that file is
  the highest-harm file in the product (D3) and this slice must not touch it.
- Adaptive difficulty, mastery, attempt writes, hints and the hint ladder are all
  unchanged. This is an input change, not a learning-model change.
- Feedback colours are unchanged: correct green, not-quite **amber**, never red.

### The chapter quiz is deliberately untouched

The quiz is the assessment surface. Keeping its input plain keeps attempts
comparable across a learner's retakes and across learners, and one interactive
surface at a time is enough for one slice. Revisit after practice has real usage.

### Extra acceptance criteria for 5.2

- [ ] A `tiles` answer is assembled and passed to the existing grader unmodified
- [ ] `lib/learning/grading.ts` is unchanged by this slice — verified by diff
- [ ] Every pictorial option has an `aria-label` stating the maths, and the set is a real radio group
- [ ] Tile and option targets are ≥44px
- [ ] A question with no pictorial form falls back to `typed` and still works
- [ ] Wrong answers stay amber with a next step, never red, never a bare ✗

---

## 11. Scope and order

Build in this order — each stage is independently shippable.

| Stage | Work | Est |
|---|---|---|
| 1 | `PartWhole` + `NumberLine` + `Viz` resolver + snapshot tests | 2h |
| 2 | `LessonSteps` player, progress bar, `see` / `reveal` / `tap` | 2h |
| 3 | `build` (interactive `PartWhole`) | 1h |
| 4 | **Class 6 Fractions — 5 lessons authored, EN + HI** | 3h |
| 5 | `SpeakButton` and the language toggle | 1h |
| 6 | `TokenRow`, `BalanceScale`, `ArrayGrid` | 3h |
| 7 | **Class 7 Integers** and **Class 8 Linear Equations** authored, EN + HI | 6h |
| 8 | Accessibility pass, re-seed, deploy, verify on a real phone | 2h |
| | **Lessons subtotal** | **~22h** |
| 9 | Practice input kinds (`choice-viz`, `tiles`, `shade`, `place`) | 4h |
| 10 | Pictorial forms authored for the existing question bank, 3 chapters | 2h |
| | **Practice subtotal (slice 5.2)** | **~6h** |
| | **Total** | **~28h** |

**Every stage is independently shippable**, which is the point of the additive
`steps` rule in §6. Class 6 alone (stages 1–5, ~11h) already answers the teacher's
feedback and gives the demo chapter.

Order is deliberate: **all three chapters of lessons before any practice work.**
Practice reuses the finished primitives, so doing it second costs nothing extra;
doing it first would mean building primitives twice against an unsettled visual
vocabulary.

### Content review gate

Class 6 Fractions is reviewed on screen **before it is seeded** — it sets the
visual vocabulary every later chapter reuses, and a wrong diagram teaches wrong
maths more convincingly than wrong prose does, because a picture is believed.
Classes 7 and 8 follow the approved pattern.
