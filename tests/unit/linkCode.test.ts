import { describe, expect, it } from "vitest";
import {
  LINK_CODE_LENGTH,
  LINK_CODE_TTL_HOURS,
  generateLinkCode,
  isLinkCodeExpired,
  linkCodeHoursLeft,
  normaliseLinkCode,
} from "@/lib/parent/linkCode";
import { safeNextPath } from "@/lib/security/nextPath";

/**
 * Parent link codes (D2).
 *
 * This code is the only thing between a stranger and a child's learning data,
 * so the tests are about the two properties that carry that: it is hard to
 * guess, and it does not quietly turn one household's typo into another
 * household's code.
 */

describe("generateLinkCode", () => {
  it("is 6 characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateLinkCode();
      expect(code).toHaveLength(LINK_CODE_LENGTH);
      // No O, 0, I, 1 or L — the pairs people confuse reading off a dim screen.
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it("does not repeat itself", () => {
    // Not a randomness proof — a smoke test that it is not returning a constant
    // or seeded identically per call, which is the way this breaks in practice.
    const codes = new Set(Array.from({ length: 500 }, () => generateLinkCode()));
    expect(codes.size).toBeGreaterThan(495);
  });

  it("spreads across the alphabet rather than favouring its start", () => {
    // A modulo bias would show up as the first characters of the alphabet
    // appearing measurably more often. 31 is not a power of two, so this is
    // worth actually checking rather than reasoning about.
    const counts = new Map<string, number>();
    for (let i = 0; i < 6000; i++) {
      for (const char of generateLinkCode()) {
        counts.set(char, (counts.get(char) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(31);
    const frequencies = [...counts.values()];
    const min = Math.min(...frequencies);
    const max = Math.max(...frequencies);
    // Expect ~1161 each. A 2x spread would mean a real bias; noise is far tighter.
    expect(max / min).toBeLessThan(1.6);
  });
});

describe("normaliseLinkCode", () => {
  it("forgives case, spaces and hyphens", () => {
    expect(normaliseLinkCode("abc234")).toBe("ABC234");
    expect(normaliseLinkCode("ABC 234")).toBe("ABC234");
    expect(normaliseLinkCode("abc-234")).toBe("ABC234");
    expect(normaliseLinkCode("  a b c 2 3 4  ")).toBe("ABC234");
  });

  it("does NOT guess at ambiguous characters", () => {
    // The important one. Folding 0→O or 1→J looks like a kindness and is not:
    // those characters are certainly a misread, but WHICH character was misread
    // is a guess, and guessing maps one household's typo onto a code that could
    // belong to another. Leave it wrong; the parent re-reads and retypes.
    expect(normaliseLinkCode("ABC0234")).not.toContain("Q");
    expect(normaliseLinkCode("0BC234")).toBe("0BC234");
    expect(normaliseLinkCode("1BC234")).toBe("1BC234");
  });

  it("caps at the code length so a paste cannot smuggle extra input", () => {
    expect(normaliseLinkCode("ABC234EXTRA")).toBe("ABC234");
    expect(normaliseLinkCode("A".repeat(500))).toHaveLength(LINK_CODE_LENGTH);
  });
});

describe("expiry (D2 — codes must expire)", () => {
  const now = new Date("2026-08-01T12:00:00Z");
  const hoursAgo = (n: number) =>
    new Date(now.getTime() - n * 60 * 60 * 1000).toISOString();

  it("is live well inside the window", () => {
    expect(isLinkCodeExpired(hoursAgo(1), now)).toBe(false);
    expect(isLinkCodeExpired(hoursAgo(71), now)).toBe(false);
  });

  it("is dead past 72 hours", () => {
    expect(isLinkCodeExpired(hoursAgo(LINK_CODE_TTL_HOURS + 1), now)).toBe(true);
    expect(isLinkCodeExpired(hoursAgo(24 * 30), now)).toBe(true);
  });

  it("treats an unparseable timestamp as expired, not as valid", () => {
    // Fails CLOSED. A corrupt row must not become a code that never dies.
    expect(isLinkCodeExpired("not a date", now)).toBe(true);
    expect(isLinkCodeExpired("", now)).toBe(true);
  });

  it("counts down the hours left, floored at zero", () => {
    expect(linkCodeHoursLeft(hoursAgo(0), now)).toBe(LINK_CODE_TTL_HOURS);
    expect(linkCodeHoursLeft(hoursAgo(70), now)).toBe(2);
    expect(linkCodeHoursLeft(hoursAgo(200), now)).toBe(0);
    expect(linkCodeHoursLeft("nonsense", now)).toBe(0);
  });
});

describe("safeNextPath — the open redirect guard", () => {
  it("keeps an ordinary in-app path", () => {
    expect(safeNextPath("/parent/claim")).toBe("/parent/claim");
    expect(safeNextPath("/learn")).toBe("/learn");
    expect(safeNextPath("/progress?x=1")).toBe("/progress?x=1");
  });

  it("refuses anything that leaves the site", () => {
    // The attack: a learner is sent /login?next=<attacker>, signs in for real,
    // and Saathi itself delivers them to a copy of the login screen.
    expect(safeNextPath("https://evil.example/login")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath("/javascript:alert(1)")).toBe("/");
  });

  it("falls back on junk", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("learn")).toBe("/"); // not rooted
  });
});
