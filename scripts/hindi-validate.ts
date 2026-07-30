/**
 * The mechanical Hindi checks, shared by `translate:hi` and `check:hindi`.
 *
 * One module on purpose: if the translator and the checker disagreed about what
 * counts as valid, the translator would happily write rows the checker then
 * rejects, and every run would end in noise.
 *
 * These catch everything MECHANICAL, which is the point — it leaves the Day 4
 * human read-through free to be about tone only (HINDI_STYLE.md).
 */

export type Problem = { field: string; message: string };

/**
 * Every KaTeX span, in order. `$$…$$` is matched first so a display block is not
 * torn into two inline spans.
 */
export function mathSpans(text: string): string[] {
  return [...text.matchAll(/\$\$[\s\S]*?\$\$|\$[^$\n]*?\$/g)].map((m) => m[0]);
}

/** NCERT's own terms. A transliteration here means the app and the exam disagree. */
const NCERT_TERMS: Array<{ english: RegExp; hindi: RegExp; term: string }> = [
  // "कितना भाग" is how NCERT Hindi asks "what fraction of", so भाग counts too.
  { english: /\bfractions?\b/i, hindi: /भिन्न|भाग/, term: "भिन्न or भाग" },
  { english: /\bintegers?\b/i, hindi: /पूर्णांक/, term: "पूर्णांक" },
  { english: /\bequations?\b/i, hindi: /समीकरण/, term: "समीकरण" },
  { english: /\bdenominator\b/i, hindi: /हर/, term: "हर" },
  { english: /\bnumerator\b/i, hindi: /अंश/, term: "अंश" },
  { english: /\bnumber line\b/i, hindi: /संख्या रेखा/, term: "संख्या रेखा" },
  { english: /\bperimeter\b/i, hindi: /परिमाप/, term: "परिमाप" },
];

/** Transliterated English that must never appear in place of the NCERT term. */
const BANNED_TRANSLITERATIONS = [
  "फ्रैक्शन",
  "इंटीजर",
  "इक्वेशन",
  "न्यूमरेटर",
  "डिनॉमिनेटर",
];

export function validateField(
  english: string,
  hindi: string,
  field: string,
): Problem[] {
  const problems: Problem[] = [];
  const add = (message: string) => problems.push({ field, message });

  if (!hindi || hindi.trim() === "") {
    add("empty translation");
    return problems;
  }

  // ── maths must survive untouched ──
  //
  // Compared as a MULTISET, not in order. Hindi is subject-object-verb, so
  // "Put $-2$ in place of $x$" correctly becomes "$x$ के स्थान पर $-2$ रखिए" —
  // the formulas are identical and only the sentence order changed. Demanding
  // the original order would reject correct grammar.
  const source = [...mathSpans(english)].sort();
  const translated = [...mathSpans(hindi)].sort();

  // A bare operator carries no content that can be corrupted, and Hindi often
  // reads better spelling it out — "बराबर के चिह्न" for "the $=$ sign". Only
  // formulas are held to byte-identity.
  const isBareOperator = (span: string) =>
    /^\$\s*(=|\+|-|\\times|\\div|\\cdot|<|>)\s*\$$/.test(span);

  const missing = source.filter((s) => {
    const i = translated.indexOf(s);
    if (i === -1) return true;
    translated.splice(i, 1);
    return false;
  });

  for (const span of missing) {
    if (isBareOperator(span)) continue;
    add(`maths missing or altered: ${span}`);
  }
  for (const span of translated) add(`maths not in the English: ${span}`);

  // ── leaked prompt scaffolding ──
  // The translator wraps the source in a delimiter, and a model will sometimes
  // echo it back. It renders as a horizontal rule at the top of a lesson, and it
  // reached 33 rows before anything checked for it.
  const trimmed = hindi.trim();
  if (/^-{3,}/.test(trimmed) || /-{3,}$/.test(trimmed)) {
    add("leaked `---` delimiter from the translation prompt");
  }

  // ── numerals stay Arabic ──
  // NCERT Hindi maths editions use 1/2, and KaTeX renders Arabic regardless. A
  // Devanagari digit here would disagree with every question on the screen.
  if (/[०-९]/.test(hindi)) add("Devanagari digits — NCERT Hindi maths uses 1/2, not १/२");

  // ── no Latin script mid-sentence ──
  // Strip the maths first; every formula legitimately contains Latin letters.
  const prose = hindi.replace(/\$\$[\s\S]*?\$\$|\$[^$\n]*?\$/g, " ");
  // Code fences are diagrams (the number line), not prose.
  const proseWithoutCode = prose.replace(/```[\s\S]*?```/g, " ");
  const latin = proseWithoutCode.match(/[A-Za-z]{2,}/g);
  if (latin) {
    add(`Latin script in the prose: ${[...new Set(latin)].slice(0, 5).join(", ")}`);
  }

  // ── NCERT vocabulary ──
  for (const { english: en, hindi: hi, term } of NCERT_TERMS) {
    if (en.test(english) && !hi.test(hindi)) {
      add(`English says "${en.source.replace(/\\b|\?|s\b/g, "")}" but Hindi never uses ${term}`);
    }
  }

  for (const banned of BANNED_TRANSLITERATIONS) {
    if (hindi.includes(banned)) add(`transliterated English "${banned}" — use the NCERT term`);
  }

  return problems;
}
