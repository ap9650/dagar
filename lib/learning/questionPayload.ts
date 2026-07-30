/**
 * Belt and braces for migration 0012, shared by every path that sends a question
 * to a browser (practice, and the quiz's start route).
 *
 * `questions_public` now strips `solution_md` out of every locale in `i18n`, and
 * that view is the real boundary. This runs anyway, because the leak 0012 fixed
 * was invisible for a reason worth respecting: the answer key was not in a column
 * anyone was selecting, it was one level down inside a jsonb value that looked
 * like harmless translation data.
 *
 * Cheap, and it means a future edit to the view cannot silently reopen the hole.
 */
export function stripSolutions(i18n: unknown): unknown {
  if (typeof i18n !== "object" || i18n === null || Array.isArray(i18n)) return {};

  const clean: Record<string, unknown> = {};
  for (const [locale, value] of Object.entries(i18n as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const fields = { ...(value as Record<string, unknown>) };
    delete fields.solution_md;
    clean[locale] = fields;
  }
  return clean;
}
