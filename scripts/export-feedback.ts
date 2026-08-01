/**
 * npm run feedback:export — the real user feedback, ready to attach.
 *
 * Writes two files into `feedback-export/`:
 *
 *   feedback.csv  every response, one row each — for a spreadsheet
 *   feedback.md   a readable summary with the headline numbers and the quotes
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT CANNOT LEAK AN EMAIL ADDRESS.
 *
 * Not "it filters them out" — it never asks for them. Addresses live in
 * `auth.users`, which this script does not query at all; `product_feedback`
 * has no email column by design (0018), and `profiles` has never held one.
 *
 * The reason is not squeamishness. Under India's DPDP Act anyone under 18 is a
 * child, and several respondents here are 11–14. Storing an address because a
 * login needs one is defensible; copying children's addresses into a file
 * handed to a third party is a disclosure with no necessity behind it.
 *
 * `user_id` is exported as an 8-character prefix — enough to see that responses
 * came from distinct people, useless for identifying any of them.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types.ts";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return process.env as Record<string, string>;
  }
  for (const line of raw.split("\n")) {
    if (!/^[A-Z]/.test(line)) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    out[line.slice(0, eq)] = line.slice(eq + 1).replace(/\s+#.*$/, "").trim();
  }
  return { ...out, ...process.env } as Record<string, string>;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const db = createClient<Database>(url, key, { auth: { persistSession: false } });

// The explicit column list IS the privacy control. Never `select("*")` here:
// a column added to the table later would silently join the export.
const { data: rows, error } = await db
  .from("product_feedback")
  .select("user_id, respondent_role, understood, would_return, worked_well, confusing, locale, created_at")
  .order("created_at", { ascending: true });

if (error) {
  console.error("Could not read feedback:", error.message);
  process.exit(1);
}
if (!rows?.length) {
  console.log("No feedback yet.");
  process.exit(0);
}

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const headers = [
  "respondent",
  "understood",
  "would_use_again",
  "what_worked",
  "what_confused",
  "language",
  "date",
  "user_ref",
];

const csv = [
  headers.join(","),
  ...rows.map((r) =>
    [
      r.respondent_role,
      r.understood,
      r.would_return,
      r.worked_well ?? "",
      r.confusing ?? "",
      r.locale,
      r.created_at.slice(0, 10),
      r.user_id.slice(0, 8), // a reference, not an identity
    ]
      .map(csvCell)
      .join(","),
  ),
].join("\n");

// ── the summary ─────────────────────────────────────────────────────────────
type Response = (typeof rows)[number];

const count = <T extends string>(key: (r: Response) => T) =>
  rows.reduce<Record<string, number>>((acc, r) => {
    const k = key(r);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

const people = new Set(rows.map((r) => r.user_id)).size;
const byRole = count((r) => r.respondent_role);
const byUnderstood = count((r) => r.understood);
const byReturn = count((r) => r.would_return);
const helped = (byUnderstood.yes ?? 0) + (byUnderstood.a_bit ?? 0);
const pct = (n: number) => `${Math.round((n / rows.length) * 100)}%`;
/** This file is read by judges; "1 responses from 1 distinct users" is not. */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const quotes = rows
  .filter((r) => (r.worked_well?.trim().length ?? 0) > 0 || (r.confusing?.trim().length ?? 0) > 0)
  .map((r) => {
    const lines = [`**${r.respondent_role}** · understood: ${r.understood} · would use again: ${r.would_return}`];
    if (r.worked_well?.trim()) lines.push(`- What worked: ${r.worked_well.trim()}`);
    if (r.confusing?.trim()) lines.push(`- What confused them: ${r.confusing.trim()}`);
    return lines.join("\n");
  });

const md = `# Saathi — real user feedback

Collected in-app at \`/feedback\`. Every response comes from a signed-in account
that had used the product, so nobody is reacting to a screenshot.

**No names or email addresses appear in this file.** Several respondents are
children aged 11–14; under India's DPDP Act they are minors, and their contact
details are not needed to evidence any claim made here. \`user_ref\` in the CSV is
a truncated id — enough to show the responses came from distinct people.

## Headline

- **${plural(rows.length, "response", "responses")} from ${plural(people, "distinct user", "distinct users")}**
- **${helped} of ${rows.length} (${pct(helped)}) said Saathi helped them understand something** — "yes" or "a bit"
- **${byReturn.yes ?? 0} of ${rows.length} (${pct(byReturn.yes ?? 0)}) said they would use it again**

## Who answered

${Object.entries(byRole).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

## Did it help you understand something?

${Object.entries(byUnderstood).map(([k, v]) => `- ${k.replace("_", " ")}: ${v}`).join("\n")}

## Would you use Saathi again?

${Object.entries(byReturn).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

## In their words

${quotes.length ? quotes.join("\n\n") : "_No written comments yet._"}

---

_Exported ${new Date().toISOString().slice(0, 10)} from the live Saathi database._
`;

mkdirSync("feedback-export", { recursive: true });
writeFileSync("feedback-export/feedback.csv", csv + "\n");
writeFileSync("feedback-export/feedback.md", md);

console.log(`\n  ${plural(rows.length, "response", "responses")} from ${plural(people, "distinct user", "distinct users")}`);
console.log(`  ${helped} (${pct(helped)}) said it helped them understand something`);
console.log(`  ${byReturn.yes ?? 0} (${pct(byReturn.yes ?? 0)}) would use it again`);
console.log(`\n  wrote feedback-export/feedback.csv`);
console.log(`  wrote feedback-export/feedback.md\n`);
