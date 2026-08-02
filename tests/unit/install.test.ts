import { describe, expect, it } from "vitest";
import { detectInAppBrowser, detectPlatform } from "@/components/install/store";

/**
 * The install path failed for a real user on 2 Aug 2026, and the two things that
 * decide what she is shown are these functions. Both are pure string checks, so
 * they are cheap to pin against real user agents — and getting either wrong is
 * silent: the learner is simply shown the wrong instructions, or none.
 */

const UA = {
  androidChrome:
    "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  androidWhatsApp:
    "Mozilla/5.0 (Linux; Android 11; RMX3231 Build/RP1A.201005.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/110.0.0.0 Mobile Safari/537.36",
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
  iosInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.23.113",
  desktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
} as const;

describe("detectPlatform", () => {
  it("recognises Android", () => {
    expect(detectPlatform(UA.androidChrome, false)).toBe("android");
    expect(detectPlatform(UA.androidWhatsApp, false)).toBe("android");
  });

  it("recognises iOS", () => {
    expect(detectPlatform(UA.iosSafari, false)).toBe("ios");
    expect(detectPlatform(UA.iosInstagram, false)).toBe("ios");
  });

  it("does not call old IE-on-Windows-Phone iOS", () => {
    // MSStream is the documented way to exclude it; the UA otherwise matches.
    expect(detectPlatform("Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0) iPhone", true))
      .toBe("other");
  });

  it("falls back to other for desktop", () => {
    expect(detectPlatform(UA.desktop, false)).toBe("other");
  });
});

describe("detectInAppBrowser", () => {
  it("catches the Android WebView marker", () => {
    // This is the case that matters: a link tapped inside WhatsApp. It never
    // fires beforeinstallprompt, so without this the learner sees nothing at all
    // and concludes install is broken.
    expect(detectInAppBrowser(UA.androidWhatsApp)).toBe(true);
  });

  it("catches Instagram on iOS", () => {
    expect(detectInAppBrowser(UA.iosInstagram)).toBe(true);
  });

  it("catches Facebook's browsers", () => {
    expect(detectInAppBrowser("Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/440.0]")).toBe(true);
  });

  it("does NOT flag a real browser", () => {
    // The expensive mistake in the other direction: telling someone already in
    // Chrome to open it in Chrome.
    expect(detectInAppBrowser(UA.androidChrome)).toBe(false);
    expect(detectInAppBrowser(UA.iosSafari)).toBe(false);
    expect(detectInAppBrowser(UA.desktop)).toBe(false);
  });

  it("does not match 'wv' inside an unrelated word", () => {
    expect(detectInAppBrowser("Mozilla/5.0 (Linux; Android 13; wvGarbagePhone)")).toBe(false);
  });
});
