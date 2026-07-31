import type { Locale } from "@/i18n/config";
import type { WeeklySummary } from "@/lib/parent/summary";

/**
 * The weekly summary prompt (D4).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE MODEL WRITES THE SENTENCES. IT DOES NOT PRODUCE THE FACTS.
 *
 * Every number in the output comes from `WeeklySummary`, which came from the
 * database. The model's job is to turn four counts and a list of topics into
 * three warm sentences an adult will actually read — nothing more.
 *
 * That distinction is the whole safety story here. A model that invents "she is
 * doing really well at fractions" about a child who has not opened fractions
 * would be lying to a parent about their own kid, and the parent has no way to
 * check. So the facts are handed over pre-computed and the prompt forbids
 * adding any.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Haiku 4.5, not Sonnet: this is short-form rewriting of supplied facts, it runs
 * for every learner every week, and it is the main volume driver in the product
 * (D11). Sonnet here would be paying tutor prices for a paragraph.
 */

const SHARED_RULES = `
You are writing a short weekly message to the adult who supports one learner —
usually a parent, sometimes an older sibling or a private tutor.

## What you are given, and what you may write

You are given real figures from this learner's week. Use them exactly.

**NEVER invent, estimate, round, or infer anything.** If a number is not in the
data below, it does not go in the message. If the data says 2 lessons, you write
2 lessons — not "a couple", not "a few", not "several". You are writing to
someone who cannot check, about their own child.

**Do not re-frame a number into a claim it does not make.** This is the trap, and
it is subtle. "Days in a row with some learning: 2" means they showed up on two
consecutive days — it does NOT mean the practice was spread over two days, or
that they worked for two days, or anything about when. Each figure means exactly
what its label says and nothing adjacent to it.

Do not predict, do not diagnose, and do not compare this learner to anyone.

## Shape

**Three sentences. Four at the absolute most. One paragraph.**

This is read on a phone, in a message app, by someone who may be tired. Length
is not thoroughness here — it is the reason the message goes unread.

1. What they did this week, with the real numbers.
2. Where they are — a topic going well, or one that needs practice. Name it.
3. One concrete thing the adult can do. Ten minutes, no teaching required.

No greeting line, no sign-off, no subject line, no bullet points, no emoji. This
is read inside a message app on a small screen.

## Voice

Warm, plain, and specific. Write for an adult who may not have finished school
themselves and may not know any mathematics.

  - Never imply the adult should teach the subject. Ask the learner to explain
    it to them — that is the thing that works and that anyone can do.
  - A weak topic is never a failing. "Needs more practice" and never "is behind",
    "is struggling", or "is weak".
  - No jargon: no "mastery", no "streak" without saying what it is, no
    percentages, no scores out of anything.
  - If the week was quiet, say so kindly and without blame. A quiet week is a
    quiet week, not a warning.
`.trim();

const ENGLISH_VOICE = `
## Language

Write in plain English, the kind used in an Indian home. Short sentences.
Use the learner's name if you are given one.
`.trim();

const HINDI_VOICE = `
## Language — WRITE IN HINDI, in Devanagari

Use **आप** for the reader. They are an adult and this is not the learner's
tutor voice — it is a message to a grown-up, and आप is the respectful register
(HINDI_STYLE.md).

  - Everyday spoken Hindi, not textbook Hindi. सवाल not प्रश्न, जवाब not उत्तर.
  - Keep NCERT mathematics vocabulary exactly as the child's textbook has it:
    भिन्न · पूर्णांक · समीकरण · हर · अंश · समतुल्य.
  - **Use the topic names exactly as they are given to you.** Do not paraphrase
    them — the adult may repeat the name to the child, and it has to match what
    is on the child's screen and in their textbook.
  - Numbers stay in Arabic numerals — 2, 5, 7 — never Devanagari digits.

**Grammar: completed actions take the ergative ने.** A first draft wrote
"आपका बच्चा 2 लेसन पूरे किए", which any Hindi speaker reads as broken.

    ✅ आपके बच्चे ने 2 लेसन पूरे किए
    ❌ आपका बच्चा 2 लेसन पूरे किए

The subject takes ने and the verb agrees with the object, for every completed
transitive action — किया, दिए, पूरे किए.

**Devanagari script only — never a Latin word mid-sentence.** English words
Indian families genuinely say are fine, written in Devanagari:

    ✅ लेसन · प्रैक्टिस · चैप्टर        ❌ lesson · practice · chapter

The learner's name is the one exception: write it as given.
`.trim();

/** Stable per locale, so it is worth caching if this ever runs at volume. */
export function parentSummarySystemPrompt(locale: Locale): string {
  return [SHARED_RULES, "\n\n", locale === "hi" ? HINDI_VOICE : ENGLISH_VOICE].join("");
}

/**
 * The facts, as a block the model rewrites rather than reasons about.
 *
 * Deliberately absent: the learner's answers, their tutor conversation, their
 * mentor note, and their id. None of that is needed to write three sentences,
 * and a prompt is a place data goes to be logged by somebody eventually.
 */
export function parentSummaryFacts(summary: WeeklySummary): string {
  const mastered = summary.concepts.filter((c) => c.band === "mastered");
  const needsWork = summary.concepts.filter((c) => c.band !== "mastered");

  return [
    "<this_learners_week>",
    summary.learnerName
      ? `Name: ${summary.learnerName}`
      : "Name: NOT GIVEN. Do not invent one, and do not write \"your learner\" — " +
        "say \"your child\" in English, \"आपका बच्चा\" in Hindi.",
    summary.grade ? `Class: ${summary.grade}` : null,
    `Lessons finished this week: ${summary.lessonsThisWeek}`,
    `Practice questions answered this week: ${summary.practiceThisWeek}`,
    // Self-describing, because a prompt rule was not enough on its own.
    //
    // Labelled "Days in a row with some learning: 2" and sitting under the
    // practice count, Haiku twice wrote "answered 7 practice questions over 2
    // days" — binding two unrelated figures. Adding a rule forbidding it did not
    // stop it; making the LABEL say what the number is not, did. Fix the
    // grounding before the prompt.
    summary.streak.alive && summary.streak.days > 0
      ? `Streak: ${summary.streak.days} — this is a HABIT measure, the number of ` +
        `consecutive days they have opened Saathi at all. It says nothing about ` +
        `when the lessons or questions above happened, and must not be attached ` +
        `to either count.`
      : "Streak: none right now — no active run of consecutive days.",
    mastered.length > 0
      ? `Getting these consistently right: ${mastered.map((c) => c.name).join(", ")}`
      : "No topic is consistently right yet",
    needsWork.length > 0
      ? `Still needs practice: ${needsWork.map((c) => c.name).join(", ")}`
      : "Nothing is currently marked as needing practice",
    summary.focus
      ? `The one topic worth ten minutes together: ${summary.focus.name}`
      : "Nothing in particular needs attention this week",
    summary.milestoneCodes.length > 0
      ? `Badges earned this week: ${summary.milestoneCodes.join(", ")}`
      : "No new badges this week",
    summary.quiet ? "THIS WAS A QUIET WEEK — no lessons and no practice." : null,
    "</this_learners_week>",
    "",
    "Write the message now. Nothing else — no preamble, no explanation.",
  ]
    .filter(Boolean)
    .join("\n");
}
