import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * No em dash in anything a person reads.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A TEST AND NOT A STYLE NOTE.
 *
 * "It reads like a machine wrote it" was the note, and the em dash was most of
 * the reason. It is the single most recognisable fingerprint of generated
 * English, and once a reader notices it they read everything afterwards
 * differently, including the parts a person laboured over.
 *
 * There were 471 across the product: 74 in the interface, 397 in lesson and
 * question content, in both languages. Hindi had more than English, because
 * every one had arrived by translating an English sentence that had one, and
 * Devanagari has no use for a dash at all. It joins with a comma and ends with
 * a danda.
 *
 * A style note would not have held. The next person writing a lesson at
 * midnight reaches for the dash exactly as we did.
 *
 * ── WHAT THIS DOES NOT COVER ────────────────────────────────────────────────
 * Code comments. A comment is not copy, nobody ships it, and forbidding it
 * there would be pedantry that trains people to ignore the rule.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const EM_DASH = "—";

/** Every string in a JSON tree, with the path that reaches it. */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

const json = (file: string) => JSON.parse(readFileSync(file, "utf8")) as unknown;

describe("interface copy", () => {
  it.each(["messages/en.json", "messages/hi.json"])("%s has no em dash", (file) => {
    const offenders = strings(json(file))
      .filter(([, text]) => text.includes(EM_DASH))
      .map(([path]) => path);
    expect(offenders, `use a comma, a colon or a full stop instead`).toEqual([]);
  });
});

describe("curriculum copy", () => {
  it("the Hindi translations carry none", () => {
    const offenders = strings(json("supabase/seed/translations/hi.json"))
      .filter(([, text]) => text.includes(EM_DASH))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  /*
    The English chapters are TypeScript, so the strings cannot be read without
    parsing. Line-level is enough: content and comments live on separate lines
    in these files, and a comment is allowed its dash.
  */
  const seedFiles = readdirSync("supabase/seed")
    .filter((name) => name.endsWith(".ts"))
    .map((name) => join("supabase/seed", name));

  it.each(seedFiles)("%s has none outside comments", (file) => {
    const offenders = readFileSync(file, "utf8")
      .split("\n")
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => {
        const trimmed = line.trimStart();
        const isComment =
          trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
        return line.includes(EM_DASH) && !isComment;
      })
      .map(([lineNumber, line]) => `${lineNumber}: ${line.trim().slice(0, 70)}`);

    expect(offenders).toEqual([]);
  });
});
