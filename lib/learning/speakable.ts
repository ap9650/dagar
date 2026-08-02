/**
 * Turn a lesson step into something a speech engine can read aloud.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
 * Hand `speechSynthesis` the raw step and it says, out loud, to a twelve-year-
 * old: *"You took 1 piece out of 4 equal pieces. We write that as dollar 1
 * slash 4 dollar."* Every piece of notation in the curriculum would arrive as
 * punctuation.
 *
 * So maths is **spoken, not read**: `$1/4$` becomes "1 by 4" in English and
 * "1 बटा 4" in Hindi, which is how it is said in a classroom in either language.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Pure and language-parameterised, so it is testable without a browser — and it
 * is the part most likely to be wrong in a way nobody notices, because a bad
 * reading is only audible if someone happens to be listening.
 */

type Lang = "en" | "hi";

/** Spoken names for the symbols that actually appear in Classes 6–8. */
const WORDS: Record<Lang, Record<string, string>> = {
  en: {
    "/": " by ",
    "=": " equals ",
    "+": " plus ",
    "-": " minus ",
    ">": " is greater than ",
    "<": " is less than ",
    "≠": " is not equal to ",
    "×": " times ",
    "÷": " divided by ",
    "□": " what ",
  },
  hi: {
    // "एक बटा चार" is how a fraction is read aloud in a Hindi classroom.
    "/": " बटा ",
    "=": " बराबर ",
    "+": " जोड़ ",
    "-": " घटा ",
    ">": " से बड़ा ",
    "<": " से छोटा ",
    "≠": " बराबर नहीं ",
    "×": " गुणा ",
    "÷": " भाग ",
    "□": " कितना ",
  },
};

/** LaTeX commands that reach the curriculum, mapped to a plain symbol first. */
const LATEX: [RegExp, string][] = [
  [/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2"],
  [/\\times/g, "×"],
  [/\\div/g, "÷"],
  [/\\neq/g, "≠"],
  [/\\square/g, "□"],
  [/\\text\s*\{([^{}]*)\}/g, "$1"],
  [/\\qquad|\\quad|\\,|\\;|\\!/g, " "],
  [/\\left|\\right/g, ""],
];

/**
 * Read the maths inside a `$…$` span.
 *
 * Note it runs on the MATH ONLY. Doing this globally would turn every hyphen in
 * ordinary prose into the word "minus", and the em-dashes in this curriculum's
 * copy would be read out one by one.
 */
function speakMath(math: string, lang: Lang): string {
  let out = math;
  for (const [pattern, replacement] of LATEX) out = out.replace(pattern, replacement);
  out = out.replace(/[{}]/g, " ");
  // Unicode minus as well as hyphen — Class 7 integers are full of both.
  out = out.replace(/−/g, "-");
  for (const [symbol, word] of Object.entries(WORDS[lang])) {
    out = out.split(symbol).join(word);
  }
  return out;
}

/**
 * Markdown + KaTeX → a sentence a speech engine can say.
 *
 * Deliberately conservative: anything it does not recognise is dropped rather
 * than spelled out. A missing word is a small loss; "asterisk asterisk" read
 * aloud twice a screen is the feature being switched off.
 */
export function toSpeakable(markdown: string, lang: Lang): string {
  let out = markdown;

  // Display maths first — `$$…$$` would otherwise be seen as two empty spans.
  out = out.replace(/\$\$([\s\S]*?)\$\$/g, (_, math: string) => ` ${speakMath(math, lang)} `);
  out = out.replace(/\$([^$]*)\$/g, (_, math: string) => ` ${speakMath(math, lang)} `);

  out = out
    .replace(/`([^`]*)`/g, "$1") // inline code
    .replace(/\*\*([^*]*)\*\*/g, "$1") // bold
    .replace(/\*([^*]*)\*/g, "$1") // italic
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links keep their words
    .replace(/^#+\s*/gm, "") // headings
    .replace(/^[-*]\s+/gm, "") // bullets
    .replace(/[—–]/g, ", ") // dashes are a pause, not a word
    .replace(/\\/g, "")
    .replace(/\s+/g, " ")
    // A substitution leaves "1 by 4 ." behind. Harmless to a reader, but a
    // speech engine puts a beat in front of the full stop and the sentence ends
    // hanging.
    .replace(/\s+([.,;:?!।])/g, "$1")
    .trim();

  return out;
}

/**
 * What a step should say.
 *
 * `speak` wins when an author has written one — the escape hatch for a step
 * whose prose reads badly however cleverly it is transformed.
 */
export function stepSpeech(
  step: { md: string; speak?: string; answer?: unknown },
  lang: Lang,
  options: { includeAnswer?: boolean } = {},
): string {
  if (step.speak) return toSpeakable(step.speak, lang);
  const parts = [step.md];
  // A revealed answer is read only once the learner has revealed it. Speaking it
  // with the question would hand over the very thing the step withholds.
  //
  // `answer` is typed loosely because a `tap` step also has one — and there it
  // is an OPTION INDEX, not prose. Reading "1" aloud after the question would
  // both give the game away and make no sense.
  if (options.includeAnswer && typeof step.answer === "string") parts.push(step.answer);
  return parts.map((part) => toSpeakable(part, lang)).join(". ");
}
