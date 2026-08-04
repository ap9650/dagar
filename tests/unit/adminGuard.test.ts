import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isAdminEmail, parseAdminEmails } from "@/lib/security/adminGuard";

/**
 * The admin allowlist.
 *
 * Every assertion here is a case where the guard must say NO. A guard tested
 * only on the address that is supposed to work has proved nothing — the whole
 * point of this one is what happens when the configuration is wrong, and the
 * answer must be "locked, including for us".
 */

describe("parseAdminEmails", () => {
  it("returns nothing when the variable is unset", () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
  });

  it("returns nothing for an empty or blank value", () => {
    expect(parseAdminEmails("")).toEqual([]);
    expect(parseAdminEmails("   ")).toEqual([]);
    expect(parseAdminEmails(",,,")).toEqual([]);
  });

  it("splits, trims and lowercases", () => {
    expect(parseAdminEmails(" One@Example.com , two@example.com ")).toEqual([
      "one@example.com",
      "two@example.com",
    ]);
  });

  it("drops blanks, so a trailing comma is harmless", () => {
    // Left in, an empty entry would match an empty candidate email — which is
    // exactly what an unauthenticated request looks like.
    expect(parseAdminEmails("a@b.com,")).toEqual(["a@b.com"]);
    expect(parseAdminEmails("a@b.com, ,c@d.com")).toEqual(["a@b.com", "c@d.com"]);
  });
});

describe("isAdminEmail — fails closed", () => {
  const list = ["owner@example.com"];

  it("lets the listed address in", () => {
    expect(isAdminEmail("owner@example.com", list)).toBe(true);
  });

  it("is case- and whitespace-insensitive on the candidate", () => {
    expect(isAdminEmail("  Owner@Example.COM  ", list)).toBe(true);
  });

  it("refuses everyone when the allowlist is empty", () => {
    // THE headline case. An unset ADMIN_EMAILS must lock the page, not open it.
    expect(isAdminEmail("owner@example.com", [])).toBe(false);
    expect(isAdminEmail("anyone@example.com", [])).toBe(false);
  });

  it("refuses a missing, null or blank email", () => {
    expect(isAdminEmail(undefined, list)).toBe(false);
    expect(isAdminEmail(null, list)).toBe(false);
    expect(isAdminEmail("", list)).toBe(false);
    expect(isAdminEmail("   ", list)).toBe(false);
  });

  it("refuses an unlisted address", () => {
    expect(isAdminEmail("someone@example.com", list)).toBe(false);
  });

  it("has no wildcard, no domain match, no prefix match", () => {
    // A matcher with features is a matcher with a way to be wrong.
    expect(isAdminEmail("owner@example.com", ["*"])).toBe(false);
    expect(isAdminEmail("owner@example.com", ["@example.com"])).toBe(false);
    expect(isAdminEmail("owner@example.com", ["example.com"])).toBe(false);
    expect(isAdminEmail("owner@example.com", ["owner"])).toBe(false);
    expect(isAdminEmail("owner@example.com.attacker.net", list)).toBe(false);
    expect(isAdminEmail("xowner@example.com", list)).toBe(false);
    expect(isAdminEmail("owner@example.como", list)).toBe(false);
  });

  it("does not treat a blank allowlist entry as a match for a blank email", () => {
    // Belt and braces: parseAdminEmails drops blanks, but isAdminEmail is
    // exported and could be called with a hand-built list.
    expect(isAdminEmail("", [""])).toBe(false);
    expect(isAdminEmail(undefined, [""])).toBe(false);
  });
});

describe("the guard cannot leak into the browser", () => {
  const ROOT = join(__dirname, "..", "..");

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) out.push(...walk(path));
      else if (/\.tsx?$/.test(entry)) out.push(path);
    }
    return out;
  }

  const sources = ["app", "lib", "components"]
    .flatMap((dir) => walk(join(ROOT, dir)))
    .map((path) => ({ path: path.slice(ROOT.length + 1), text: readFileSync(path, "utf8") }));

  it("guards the guard — the scan found files", () => {
    expect(sources.length).toBeGreaterThan(100);
  });

  it("never names the allowlist with a NEXT_PUBLIC_ prefix", () => {
    // NEXT_PUBLIC_ is a publication instruction, not a naming convention. That
    // prefix would ship the list of admin addresses to every browser forever.
    for (const file of sources) {
      expect(file.text.includes("NEXT_PUBLIC_ADMIN"), file.path).toBe(false);
    }
  });

  it("is never imported by a client component", () => {
    for (const file of sources) {
      if (!file.text.includes("security/adminGuard")) continue;
      expect(file.text.trimStart().startsWith('"use client"'), file.path).toBe(false);
    }
  });

  it("reads ADMIN_EMAILS in exactly one place", () => {
    // One reader means one place to get the fail-closed behaviour right.
    const readers = sources.filter((f) => f.text.includes("process.env.ADMIN_EMAILS"));
    expect(readers.map((f) => f.path)).toEqual(["lib/security/adminGuard.ts"]);
  });
});

describe("every page under /admin is guarded", () => {
  const ROOT = join(__dirname, "..", "..");
  const ADMIN = join(ROOT, "app", "admin");

  function pages(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) out.push(...pages(path));
      else if (entry === "page.tsx" || entry === "route.ts") out.push(path);
    }
    return out;
  }

  const found = pages(ADMIN);

  it("guards the guard — there is at least one admin page", () => {
    expect(found.length).toBeGreaterThan(0);
  });

  it("has a layout that calls requireAdmin", () => {
    expect(readFileSync(join(ADMIN, "layout.tsx"), "utf8")).toContain("requireAdmin()");
  });

  it.each(found.map((p) => p.slice(ROOT.length + 1)))("%s calls the guard itself", (relative) => {
    // The layout already guards these. This asserts the second call, so a page
    // moved out of app/admin/ cannot silently lose its boundary on the way.
    const text = readFileSync(join(ROOT, relative), "utf8");
    expect(text).toMatch(/requireAdmin\(\)|requireAdminRoute\(\)/);
  });
});
