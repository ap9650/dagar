import { describe, expect, it } from "vitest";
import {
  SHARE_TOKEN_LENGTH,
  generateShareToken,
  isShareLinkExpired,
  isShareTokenShape,
} from "@/lib/parent/shareToken";

/**
 * The no-account summary link (migration 0014).
 *
 * This token is the ONLY thing standing between a forwarded URL and a child's
 * weekly summary. There is no rate limit behind it the way there is behind the
 * 6-character parent code — there is no account to key one to — so its entropy
 * has to carry the whole burden, and that is what these tests are about.
 */

describe("generateShareToken", () => {
  it("is 32 URL-safe characters", () => {
    for (let i = 0; i < 200; i++) {
      const token = generateShareToken();
      expect(token).toHaveLength(SHARE_TOKEN_LENGTH);
      expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
      // Must survive being pasted into a URL untouched.
      expect(encodeURIComponent(token)).toBe(token);
    }
  });

  it("does not repeat", () => {
    const tokens = new Set(Array.from({ length: 2000 }, () => generateShareToken()));
    expect(tokens.size).toBe(2000);
  });

  it("uses the whole alphabet rather than favouring its start", () => {
    // 256 / 64 = 4 exactly, so the modulo is unbiased — worth checking rather
    // than assuming, since a biased token is a weaker token.
    const counts = new Map<string, number>();
    for (let i = 0; i < 2000; i++) {
      for (const char of generateShareToken()) {
        counts.set(char, (counts.get(char) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(64);
    const frequencies = [...counts.values()];
    expect(Math.max(...frequencies) / Math.min(...frequencies)).toBeLessThan(1.5);
  });
});

describe("isShareTokenShape — checked before the database is touched", () => {
  it("accepts what the generator makes", () => {
    for (let i = 0; i < 50; i++) {
      expect(isShareTokenShape(generateShareToken())).toBe(true);
    }
  });

  it("rejects anything else a URL segment could contain", () => {
    // A path segment can hold anything. This turns "someone pasted a novel into
    // the URL" into a 404 rather than a query.
    expect(isShareTokenShape("")).toBe(false);
    expect(isShareTokenShape("short")).toBe(false);
    expect(isShareTokenShape("../../etc/passwd")).toBe(false);
    expect(isShareTokenShape("a".repeat(500))).toBe(false);
    expect(isShareTokenShape("has spaces in it aaaaaaaaaaaaaa")).toBe(false);
    expect(isShareTokenShape("semi;colon;aaaaaaaaaaaaaaaaaaaaaa")).toBe(false);
    expect(isShareTokenShape(null)).toBe(false);
    expect(isShareTokenShape(undefined)).toBe(false);
    expect(isShareTokenShape(42)).toBe(false);
  });
});

describe("expiry", () => {
  const now = new Date("2026-08-01T12:00:00Z");
  const inDays = (n: number) =>
    new Date(now.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

  it("is live before the expiry date", () => {
    expect(isShareLinkExpired(inDays(89), now)).toBe(false);
    expect(isShareLinkExpired(inDays(1), now)).toBe(false);
  });

  it("is dead after it", () => {
    expect(isShareLinkExpired(inDays(-1), now)).toBe(true);
    expect(isShareLinkExpired(inDays(-100), now)).toBe(true);
  });

  it("treats an unparseable date as expired, not as valid", () => {
    // Fails CLOSED. A corrupt row must not become a link that never dies.
    expect(isShareLinkExpired("not a date", now)).toBe(true);
    expect(isShareLinkExpired("", now)).toBe(true);
  });
});
