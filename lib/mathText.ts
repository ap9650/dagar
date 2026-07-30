/**
 * A plain-text reading of a short maths string, for accessible names.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * KaTeX renders `$\frac{2}{3}$` as MathML (hidden, for assistive tech) plus
 * visually-styled spans (`aria-hidden`). That is the right structure for a
 * paragraph of a lesson. It is NOT enough for an MCQ option, where the maths *is*
 * the entire label: Chrome fails to compute an accessible name from the MathML
 * subtree and falls back to the input's `value`, so a screen-reader user hears
 * "a", "b", "c", "d" — four unlabelled buttons, and no way to tell which fraction
 * is which.
 *
 * So the option gets an explicit `aria-label`. "2/3" read aloud as "two slash
 * three" is imperfect; four options called "a" through "d" is unusable.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Deliberately small. It handles the LaTeX that actually appears in the seeded
 * choice labels — fractions, and plain numbers — and falls back to the stripped
 * source for anything else. It is NOT a LaTeX-to-speech engine and must never
 * become one; it never touches grading, and a wrong reading here is a worse
 * label, never a wrong mark.
 */
export function spokenMath(label: string): string {
  if (typeof label !== "string") return "";

  return (
    label
      // $...$ and $$...$$ delimiters
      .replace(/\$\$?/g, "")
      // \frac{2}{3} → 2/3, and \dfrac/\tfrac alongside it
      .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2")
      .replace(/\\times/g, " × ")
      .replace(/\\div/g, " ÷ ")
      .replace(/\\cdot/g, " × ")
      // Any remaining command, then its leftover braces.
      .replace(/\\[a-zA-Z]+/g, " ")
      .replace(/[{}]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}
