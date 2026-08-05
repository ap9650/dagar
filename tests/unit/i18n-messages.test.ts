import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import { LOCALES } from "@/i18n/config";

/**
 * The UI dictionary half of docs/specs/i18n.md.
 *
 * These are cheap tests guarding the failure that actually happens on a deadline:
 * a string gets added to `en.json` during a slice and nobody adds the Hindi. At
 * runtime next-intl falls back, so nothing breaks — a Hindi learner just meets an
 * English button. That is silent, and silent is exactly what gets shipped.
 */

function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? flatten(value as Record<string, unknown>, path)
      : [path];
  });
}

const enKeys = flatten(en).sort();
const hiKeys = flatten(hi).sort();

describe("message dictionaries", () => {
  it("covers every locale in LOCALES", () => {
    expect(LOCALES).toEqual(["en", "hi"]);
  });

  it("has a Hindi string for every English key", () => {
    const missing = enKeys.filter((k) => !hiKeys.includes(k));
    expect(missing).toEqual([]);
  });

  it("has no Hindi key without an English counterpart", () => {
    // English is the source of truth; an orphan Hindi key is dead weight and
    // usually a typo in a key name.
    const orphans = hiKeys.filter((k) => !enKeys.includes(k));
    expect(orphans).toEqual([]);
  });

  it("has no blank strings in either dictionary", () => {
    const blanks: string[] = [];
    for (const [name, dict] of [
      ["en", en],
      ["hi", hi],
    ] as const) {
      for (const key of flatten(dict)) {
        const value = key
          .split(".")
          .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)[part], dict);
        if (typeof value !== "string" || value.trim() === "") blanks.push(`${name}:${key}`);
      }
    }
    expect(blanks).toEqual([]);
  });

  it("uses the same ICU placeholders in both languages", () => {
    // "{total} में से {done}" reorders the arguments — that is correct and
    // expected. What must match is the SET of names, or the Hindi string renders
    // a literal "{done}" to the learner.
    // An ICU argument is `{name}` or `{name, plural, ...}` — the name is always
    // followed by `}` or `,`. Plural branch bodies like `{No lessons yet}` and
    // `{# lesson}` are copy, not arguments, and must not be captured.
    const placeholders = (s: string) =>
      [...s.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((m) => m[1]).sort();

    const read = (dict: unknown, key: string) =>
      key.split(".").reduce<unknown>((acc, part) => (acc as Record<string, unknown>)[part], dict) as string;

    const mismatches = enKeys.filter(
      (key) =>
        placeholders(read(en, key)).join() !== placeholders(read(hi, key)).join(),
    );
    expect(mismatches).toEqual([]);
  });

  it("writes numerals in Arabic digits, never Devanagari (HINDI_STYLE.md)", () => {
    // NCERT Hindi maths editions use 1/2, not १/२, and KaTeX renders Arabic
    // regardless. A Devanagari digit here would disagree with every question.
    const offenders = hiKeys.filter((key) => {
      const value = key
        .split(".")
        .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)[part], hi) as string;
      return /[०-९]/.test(value);
    });
    expect(offenders).toEqual([]);
  });

  it("keeps Latin script out of Hindi copy (HINDI_STYLE.md)", () => {
    /**
     * Keys allowed to contain Latin, with the reason.
     *
     * `install.iosSteps` quotes iOS's own menu item, which reads "Add to Home
     * Screen" on an English-language iPhone. Translating the quote would send a
     * learner hunting for Devanagari words that are not on their screen — the
     * rule exists to stop lazy untranslated English, not to stop us naming a
     * button that exists in another app.
     *
     * `install.androidSteps` and `install.inAppBrowser` are the same case for
     * Chrome and for WhatsApp's "Open in Chrome". A shared Android phone in a
     * Hindi-speaking household is usually still set to English, so the menu item
     * the learner is looking for genuinely says "Add to Home screen". The
     * sentence around the quote is Hindi; only the quote is not.
     */
    const QUOTES_FOREIGN_UI = new Set([
      "install.iosSteps",
      "install.androidSteps",
      "install.inAppBrowser",
    ]);

    /**
     * Keys containing a Latin letter that is MATHEMATICS, not English.
     *
     * `viz.balance` describes a balance holding "x boxes". `x` is the variable's
     * name, and NCERT's own Hindi editions write variables as Latin letters —
     * the same way they keep Arabic numerals (D16). Replacing it with a
     * Devanagari letter would not be a translation, it would be different maths.
     */
    const IS_NOTATION = new Set(["viz.balance"]);

    // "फिर से try करो" is the failure mode. Placeholder names like {name} and
    // ICU keywords like `plural` are structural, not copy, so strip them first.
    const offenders = hiKeys.filter((key) => {
      if (QUOTES_FOREIGN_UI.has(key) || IS_NOTATION.has(key)) return false;
      const value = key
        .split(".")
        .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)[part], hi) as string;
      const copyOnly = value
        .replace(/\{\s*\w+\s*\}/g, " ") // {name}
        .replace(/\{\s*\w+\s*,\s*\w+\s*,/g, " ") // {count, plural,
        .replace(/(=\d+|zero|one|two|few|many|other)\s*\{/g, " {") // branch selectors
        .replace(/[{}#]/g, " "); // leave the branch COPY behind to be checked
      return /[A-Za-z]/.test(copyOnly);
    });
    expect(offenders).toEqual([]);
  });
});

/**
 * Copy that names a button must name a button that exists.
 *
 * `/for-parents` walks an adult through taps they will make in Settings, in
 * quotes: *tap "Invite a parent"*. If the quoted label and the real one drift,
 * nothing breaks and no other test notices — a parent simply hunts a screen for
 * a control that is not there, on a phone, in the one flow where they have the
 * least patience.
 *
 * That is exactly what happened in Hindi: the instructions said
 * "पैरेंट को बुलाओ" while the button says "पैरेंट को जोड़ो". English was
 * consistent, so reading the English copy would never have found it.
 */
describe("copy that quotes a button label", () => {
  const dicts = { en, hi } as const;

  const QUOTED = [
    { where: "forParents.step1", label: "settings.inviteParent" },
    { where: "forParents.noCodeBody", label: "settings.inviteParent" },
    { where: "forParents.linkWay1", label: "settings.shareTitle" },
  ];

  function read(dict: Record<string, unknown>, path: string): string {
    return path
      .split(".")
      .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)[part], dict) as string;
  }

  for (const { where, label } of QUOTED) {
    for (const [locale, dict] of Object.entries(dicts)) {
      it(`${where} names the real ${label} in ${locale}`, () => {
        const copy = read(dict as Record<string, unknown>, where);
        const button = read(dict as Record<string, unknown>, label);
        expect(copy).toContain(button);
      });
    }
  }
});
