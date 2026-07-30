import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

/**
 * Curriculum content resolution (D16, docs/specs/i18n.md §3).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * There are TWO localisation mechanisms in Saathi and confusing them is the main
 * source of bugs here:
 *
 *   UI strings         → messages/{en,hi}.json → useTranslations()/getTranslations()
 *   Curriculum content → the `i18n` jsonb column on the row → THIS FILE
 *
 * A button label never goes through `t()`. A lesson body never goes through
 * `useTranslations()`.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE LOAD-BEARING RULE: `answer_value` is never translated. `1/2` is `1/2` in
 * every language. Nothing in this file may ever be imported by
 * `lib/learning/grading.ts` — a translation error must be able to produce a
 * confusing question, and must never be able to mark a correct learner wrong.
 */

/** Any curriculum row: English in the base columns, translations in `i18n`. */
export type LocalisedRow = {
  // Supabase types this as `Json`, i.e. effectively unknown. We validate shape
  // at read time rather than trusting the column.
  i18n?: unknown;
};

/**
 * `t(row, field, locale)` → `row.i18n?.[locale]?.[field] ?? row[field]`
 *
 * English (the base column) is ALWAYS the fallback. A missing or blank Hindi
 * translation renders English — never an empty string, never a blank screen.
 */
export function t<Row extends LocalisedRow, Field extends Exclude<keyof Row, "i18n">>(
  row: Row,
  field: Field,
  locale: Locale,
): string {
  const fallback = asText(row[field]);
  if (locale === DEFAULT_LOCALE) return fallback;

  const translated = asText(readI18n(row.i18n, locale, field as string));
  // Blank counts as missing. A row with `{"hi": {"body_md": ""}}` is a stale
  // translation, not an instruction to render nothing.
  return translated.trim().length > 0 ? translated : fallback;
}

/** An MCQ choice. `id` is language-independent — translate the label, never the id. */
export type Choice = { id: string; label: string };

/**
 * Choices for a question in the learner's locale.
 *
 * The id is what gets graded, so it is passed through untouched. If the Hindi
 * labels are missing, partial, or a different length from the English set, every
 * unmatched choice falls back to its English label — the learner still sees four
 * options and the ids still line up with `answer_value`.
 */
export function tChoices(
  row: LocalisedRow & { choices?: unknown },
  locale: Locale,
): Choice[] {
  const base = asChoices(row.choices);
  if (locale === DEFAULT_LOCALE) return base;

  const translated = asChoices(readI18n(row.i18n, locale, "choices"));
  const byId = new Map(translated.map((c) => [c.id, c.label]));

  return base.map((choice) => {
    const label = byId.get(choice.id);
    return label && label.trim().length > 0 ? { ...choice, label } : choice;
  });
}

/* ── internals ─────────────────────────────────────────────────────────────── */

function readI18n(i18n: unknown, locale: Locale, field: string): unknown {
  if (!isRecord(i18n)) return undefined;
  const forLocale = i18n[locale];
  if (!isRecord(forLocale)) return undefined;
  return forLocale[field];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asChoices(value: unknown): Choice[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const { id, label } = entry;
    if (typeof id !== "string" || typeof label !== "string") return [];
    return [{ id, label }];
  });
}
