import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { productFeedbackSchema } from "@/lib/security/validation";

/**
 * The feedback export must be incapable of carrying an email address.
 *
 * Several respondents are 11–14. Under India's DPDP Act they are children, and
 * the export is a file handed to a third party. Storing an address because a
 * login needs one is defensible; disclosing it is a separate act with no
 * necessity behind it.
 *
 * Asserted against the SOURCE, because the guarantee is structural: the script
 * never queries an address, so no filtering step exists to be removed later by
 * someone who does not know why it was there.
 */

const EXPORT = readFileSync("scripts/export-feedback.ts", "utf8");
const MIGRATION = readFileSync("supabase/migrations/0018_product_feedback.sql", "utf8");

describe("the feedback export", () => {
  it("never reads the auth table, which is the only place addresses live", () => {
    // `profiles` has never held an email; `product_feedback` has no such column.
    // The one way to reach an address is the admin auth API, so that is what
    // must stay absent.
    expect(EXPORT).not.toMatch(/auth\.admin/);
    expect(EXPORT).not.toMatch(/listUsers/);
  });

  it("asks the database for no such column, and reads no such property", () => {
    // Checked where an address could actually ENTER the file: the select list
    // and property access. Two earlier versions of this test searched the whole
    // source for the word "email" and failed twice on prose — first the comment
    // explaining why there is none, then the line in the report telling the
    // reader none are included.
    //
    // Both were the cry-wolf mistake: a security test that fires on innocent
    // text teaches people to skip the suite. Assert the mechanism, not the word.
    const selectArgs = [...EXPORT.matchAll(/\.select\(\s*(["'`])([\s\S]*?)\1/g)].map((m) => m[2]);
    expect(selectArgs.length).toBeGreaterThan(0);
    for (const args of selectArgs) expect(args).not.toMatch(/email/i);

    expect(EXPORT).not.toMatch(/\.email\b/);
  });

  it("selects columns explicitly, so a new column cannot join the export by accident", () => {
    // `select("*")` would silently pick up whatever gets added to the table next.
    expect(EXPORT).not.toMatch(/\.select\(\s*["'`]\*/);
    expect(EXPORT).toMatch(/select\(\s*["'`]user_id, respondent_role/);
  });

  it("truncates the user id to a reference rather than an identity", () => {
    expect(EXPORT).toMatch(/user_id\.slice\(0,\s*8\)/);
  });

  it("the table itself has no email column to leak", () => {
    expect(MIGRATION).not.toMatch(/^\s*email\s/mi);
    expect(MIGRATION).toMatch(/user_id\s+uuid not null references public\.profiles/);
  });
});

describe("the feedback schema", () => {
  it("accepts a response with no writing at all", () => {
    // A learner who taps three buttons and types nothing is a real response.
    // Requiring text would lose exactly the people hardest to hear from.
    const result = productFeedbackSchema.safeParse({
      respondent_role: "student",
      understood: "a_bit",
      would_return: "yes",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a role or verdict outside the fixed set", () => {
    for (const bad of [
      { respondent_role: "hacker", understood: "yes", would_return: "yes" },
      { respondent_role: "student", understood: "definitely", would_return: "yes" },
      { respondent_role: "student", understood: "yes", would_return: "sometimes" },
    ]) {
      expect(productFeedbackSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("caps free text, because it is public input", () => {
    const result = productFeedbackSchema.safeParse({
      respondent_role: "teacher",
      understood: "yes",
      would_return: "yes",
      confusing: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});
