import type { Locale } from "@/i18n/config";

/**
 * Hint prompts (D3, guided-practice.md).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE MODEL IS GIVEN THE WORKED SOLUTION. IT MUST NOT GIVE IT BACK.
 *
 * That is a deliberate trade and worth stating plainly. Without the solution,
 * the model reasons the maths out itself and can get it wrong — a confidently
 * incorrect hint is worse than no hint, because the learner trusts it. With the
 * solution it is grounded and accurate, but it is now holding the thing it must
 * not say.
 *
 * Two defences, because the prompt alone is not enough:
 *   1. this prompt, which forbids stating the answer at every tier, and
 *   2. `containsAnswer()` in the route, which checks the generated text against
 *      the real `answer_value` before it is sent and drops to the deterministic
 *      fallback if it leaked.
 *
 * AI never grades and never owns the key (D3). It writes hints; a hint that
 * hands over the answer is the failure this file exists to prevent.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const MAX_HINT_TIER = 3;

const TIERS: Record<number, string> = {
  1:
    "TIER 1 — a nudge. Name the idea or the first thing to notice, in one " +
    "sentence. Do NOT do any arithmetic. Do NOT start the working. If the " +
    "question needs a rule the learner may have forgotten, say the rule.",
  2:
    "TIER 2 — the method. Say what to DO first, in one or two sentences. " +
    "Describe the step; do not carry it out. Still no arithmetic, still no " +
    "numbers computed.",
  3:
    "TIER 3 — one worked step. Do the FIRST step and show its arithmetic, then " +
    "stop and say what the learner does next. The final answer is still theirs " +
    "to reach — end before it.",
};

export function hintSystemPrompt(locale: Locale): string {
  return [
    "You write a single short hint for a school mathematics question, for a",
    "learner aged 11 to 14 following the NCERT curriculum in India.",
    "",
    "You are given the question and its worked solution. The solution is there so",
    "your hint is mathematically correct — it is NOT there to be repeated.",
    "",
    "## Absolute rules",
    "",
    "- NEVER state the final answer, in any form: not as a number, not as a",
    "  fraction, not as an option letter, not 'the answer is', not at the end of",
    "  a sentence about something else.",
    "- NEVER complete the last step of the working.",
    "- Never say whether the learner's attempt was right or wrong. You do not",
    "  grade and you have not been told what they answered.",
    "- One hint only. No lists, no headings, no 'Hint:' prefix.",
    "- Two sentences at most. This is read on a phone.",
    "- Maths in LaTeX between single dollar signs. Arabic numerals only —",
    "  1, 2, 3 — never Devanagari digits, whatever language you write in.",
    "- Warm and matter-of-fact. The learner has just got this wrong; do not",
    "  congratulate them, and do not sympathise at length either.",
    "",
    locale === "hi"
      ? [
          "## Write in Hindi",
          "",
          "Devanagari, everyday spoken register — तुम, not आप. Conversational",
          "imperatives: देखो, सोचो, करो — never कीजिए. Everyday words: सवाल, जवाब,",
          "गलती. Keep NCERT mathematics vocabulary exactly: भिन्न, पूर्णांक, समीकरण,",
          "हर, अंश, समतुल्य, चर. Never mix Latin script mid-sentence.",
        ].join("\n")
      : [
          "## Write in English",
          "",
          "Plain, warm English for a 12-year-old. Short sentences, second person.",
        ].join("\n"),
  ].join("\n");
}

/** The answer standing alone as a value, rather than buried inside a number. */
function statesValue(text: string, answer: string): boolean {
  const escaped = answer.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  // Boundaries matter: an answer of `3` sits inside `13`, inside `30`, and
  // inside the markup of `$\frac{1}{3}$` without being stated at all.
  return new RegExp(`(^|[^\\w/\\\\])${escaped}($|[^\\w/])`).test(text);
}

/**
 * Does this hint give the answer away?
 *
 * The second of the two defences named at the top of this file, and the one
 * that is a guarantee rather than a request: the prompt *asks* the model not to
 * state the answer, this *checks*.
 *
 * ── WHY `stem` IS NOT OPTIONAL IN PRACTICE ──────────────────────────────────
 * The first version took only the hint and the answer, and it rejected all
 * three tiers on `1/3 = □/9`. It was not wrong to fire — the hints did contain
 * "3" — but **3 is already printed in the question**. A hint that repeats a
 * number the learner is looking at reveals nothing, and rejecting those left
 * the learner with a fallback that contained the same number anyway.
 *
 * So the test is not "does the answer appear" but "does the answer appear where
 * the learner could not already see it". On a question whose answer is not in
 * the stem — "12 laddoos, she eats 1/4, how many?" — a hint saying 3 is still
 * caught, which is the case that matters.
 *
 * Fill-in-the-box questions stay unguarded by this check, and that is honest
 * rather than lax: for those, the helpful hint and the answer are genuinely the
 * same sentence, and the prompt's tier rules are what hold the line.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function containsAnswer(
  hint: string,
  answerValue: string,
  /** The question as the learner sees it. */
  stem = "",
): boolean {
  if (typeof hint !== "string" || typeof answerValue !== "string") return false;

  const answer = answerValue.trim();
  if (answer.length === 0) return false;

  // MCQ ids are single letters and occur inside ordinary words constantly.
  // Checking for them would reject every hint containing the word "a".
  if (answer.length === 1 && /[a-z]/i.test(answer)) return false;

  if (typeof stem === "string" && stem.length > 0 && statesValue(stem, answer)) {
    return false;
  }

  return statesValue(hint, answer);
}

export function hintUserPrompt({
  tier,
  stem,
  solution,
  choices,
}: {
  tier: number;
  stem: string;
  solution: string;
  choices?: { id: string; label: string }[];
}): string {
  const options =
    choices && choices.length > 0
      ? `\n\nOptions:\n${choices.map((c) => `${c.id}) ${c.label}`).join("\n")}`
      : "";

  return [
    TIERS[tier] ?? TIERS[1],
    "",
    "<question>",
    stem + options,
    "</question>",
    "",
    "<worked_solution_for_your_reference_only>",
    solution,
    "</worked_solution_for_your_reference_only>",
    "",
    "Write the hint now. Nothing else.",
  ].join("\n");
}
