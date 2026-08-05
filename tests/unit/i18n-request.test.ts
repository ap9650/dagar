import { describe, expect, it, vi } from "vitest";

/**
 * The request config honours an explicitly requested locale.
 *
 * ── THE BUG THIS GUARDS ─────────────────────────────────────────────────────
 * `getRequestConfig` took no arguments and always read the locale cookie. Every
 * ordinary page render was fine — a page HAS a cookie — so the fault only
 * appeared where a locale is named explicitly and no cookie exists at all:
 *
 *     const t = await getTranslations({ locale, namespace: "push" });
 *
 * which is exactly what the reminder cron does, once per learner. A cron
 * carries no cookies, so every notification fell through to the default locale
 * and **every Hindi learner was sent an English reminder** — on the one surface
 * that leaves the app and lands on a parent's phone.
 *
 * Nothing threw. The call site passed the right locale, the dictionary held the
 * right Hindi, and English came out regardless. next-intl's own types state the
 * contract we were ignoring: an explicit locale "will be passed via `locale` to
 * `getRequestConfig` so you can use it instead of the segment value".
 *
 * `getRequestConfig` returns the callback it is given, so the real thing can be
 * called here directly. With an explicit locale it must not touch `cookies()`
 * at all — mocked to throw below, which is how a cron would behave.
 */
vi.mock("next/headers", () => ({
  cookies: async () => {
    throw new Error("cookies() must not be read when a locale was named explicitly");
  },
}));

/*
  next-intl ships separate client and server builds, and vitest resolves the
  client one — which refuses to run `getRequestConfig` at all. The real function
  is an identity wrapper (see its own .d.ts: it returns
  `(params) => RequestConfig | Promise<RequestConfig>`, the callback it was
  given), so standing in for it here changes nothing about what is under test.
  The subject is our callback body, which is where the bug was.
*/
vi.mock("next-intl/server", () => ({
  default: undefined,
  getRequestConfig: <T,>(callback: T) => callback,
}));

const loadConfig = async () => (await import("@/i18n/request")).default;

describe("i18n request config", () => {
  it("uses the locale it is given, not the cookie", async () => {
    const config = await loadConfig();
    const result = await config({ locale: "hi", requestLocale: Promise.resolve(undefined) });

    expect(result.locale).toBe("hi");
    // The dictionary must be the Hindi one — a matching `locale` field with
    // English messages would satisfy a shallower check and still send the wrong
    // notification.
    expect((result.messages as { push: { afternoonBody: string } }).push.afternoonBody).toBe(
      "आज का लेसन कर लें?",
    );
  });

  it("uses English when English is what was asked for", async () => {
    const config = await loadConfig();
    const result = await config({ locale: "en", requestLocale: Promise.resolve(undefined) });

    expect(result.locale).toBe("en");
    expect((result.messages as { push: { afternoonBody: string } }).push.afternoonBody).toBe(
      "Ready for today's lesson?",
    );
  });

  it("ignores a locale it does not support rather than importing a missing file", async () => {
    // `cookies()` throws in this test file, so falling through to the cookie is
    // observable: an unsupported locale must not be trusted enough to skip it.
    const config = await loadConfig();
    await expect(
      // Cast deliberately: the type says this cannot happen, and the type is
      // not what arrives at runtime — the value comes from a URL segment or a
      // caller, and `isLocale` exists precisely because it can be anything.
      config({ locale: "fr" as "en", requestLocale: Promise.resolve(undefined) }),
    ).rejects.toThrow(/cookies\(\)/);
  });

  it("always renders dates in IST, whichever locale is asked for", async () => {
    // D7: every date a learner sees is an IST date. A per-locale timezone would
    // move the day boundary and desynchronise the streak from the week strip.
    const config = await loadConfig();
    for (const locale of ["en", "hi"] as const) {
      const result = await config({ locale, requestLocale: Promise.resolve(undefined) });
      expect(result.timeZone).toBe("Asia/Kolkata");
    }
  });
});
