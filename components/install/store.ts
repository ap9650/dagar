"use client";

/**
 * Everything the app knows about "can this be added to the home screen".
 *
 * Extracted from `InstallPrompt` because there are now **two** surfaces that ask
 * the question — the dashboard card, which offers once, and the Settings row,
 * which must always answer. Two copies of this state would drift, and the way
 * they would drift is that one of them stops working.
 *
 * ── WHY A MODULE-LEVEL STORE AND NOT useState ───────────────────────────────
 * `beforeinstallprompt` fires **once**, early, and usually before any component
 * that cares has mounted. A hook that starts listening on mount misses it. So the
 * listener is attached at first subscribe and the event is held here, outside
 * React, where a later mount can still find it.
 * ────────────────────────────────────────────────────────────────────────────
 */

const DISMISSED_KEY = "saathi.install.dismissed";

export type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type Platform = "ios" | "android" | "other";

export type InstallState = {
  /** Chrome's deferred prompt, if it has fired and has not been spent. */
  deferred: InstallEvent | null;
  /** Already running from the home screen. Nothing left to offer. */
  installed: boolean;
  /** The learner said no, or accepted. Hides the CARD, never the Settings row. */
  dismissed: boolean;
  platform: Platform;
  /**
   * An embedded WebView — WhatsApp, Instagram, Facebook.
   *
   * This is the one that will actually bite: a link shared on WhatsApp opens in
   * WhatsApp's own browser, which **never fires `beforeinstallprompt`**. Every
   * tester who taps the link from a message is in one of these, so "install is
   * broken" is, for most of them, "install was never offered". Detected so we can
   * say *open this in Chrome first* instead of showing nothing.
   */
  inAppBrowser: boolean;
};

const SERVER_STATE: InstallState = {
  deferred: null,
  installed: false,
  dismissed: true,
  platform: "other",
  inAppBrowser: false,
};

/** Pure, so it can be tested without a browser. Exported for that reason only. */
export function detectPlatform(userAgent: string, hasMSStream: boolean): Platform {
  if (/iphone|ipad|ipod/i.test(userAgent) && !hasMSStream) return "ios";
  if (/android/i.test(userAgent)) return "android";
  return "other";
}

/**
 * `; wv` is Android's WebView marker. The named apps ship their own browsers that
 * do not always set it, so they are matched by their own tokens.
 */
export function detectInAppBrowser(userAgent: string): boolean {
  return /;\s*wv\b|\bFBAN\b|\bFBAV\b|Instagram|Line\/|WhatsApp/i.test(userAgent);
}

let state: InstallState = SERVER_STATE;
let initialised = false;
const listeners = new Set<() => void>();

function emit() {
  state = { ...state };
  for (const listener of listeners) listener();
}

function readBrowser(): InstallState {
  const ua = navigator.userAgent;
  return {
    deferred: state.deferred,
    installed:
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari does not implement display-mode.
      ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone)),
    dismissed: localStorage.getItem(DISMISSED_KEY) === "1",
    platform: detectPlatform(ua, "MSStream" in window),
    inAppBrowser: detectInAppBrowser(ua),
  };
}

export function subscribe(listener: () => void) {
  listeners.add(listener);

  if (!initialised) {
    initialised = true;
    state = readBrowser();

    window.addEventListener("beforeinstallprompt", (event) => {
      // Suppress Chrome's own banner so ours is the only ask.
      event.preventDefault();
      state = { ...state, deferred: event as InstallEvent };
      emit();
    });

    // Someone installed from the browser's own menu rather than our button.
    window.addEventListener("appinstalled", () => {
      state = { ...state, deferred: null, installed: true };
      emit();
    });
  }

  return () => listeners.delete(listener);
}

export const getSnapshot = () => state;
export const getServerSnapshot = () => SERVER_STATE;

/** Re-read once from a mounted component, for state that existed before subscribe. */
export function refresh() {
  if (typeof window === "undefined") return;
  state = readBrowser();
  emit();
}

export function markDismissed() {
  localStorage.setItem(DISMISSED_KEY, "1");
  state = { ...state, dismissed: true };
  emit();
}

/**
 * Run Chrome's install flow.
 *
 * ── THE BUG THIS FIXES ──────────────────────────────────────────────────────
 * This used to call `markDismissed()` unconditionally after `userChoice`
 * resolved — so backing out of Chrome's native sheet, or an install that
 * silently failed to land on the launcher, burned the offer **permanently**.
 * There was no other install entry point anywhere in the app, so the learner
 * had no way back. Reported from a real phone on 2 Aug 2026: *"sometimes I see
 * the option, I click it, it's not on my home screen"*.
 *
 * Now the ask is only spent when it was actually accepted. A `dismissed`
 * outcome clears the (single-use) event but leaves storage alone, so Chrome can
 * re-offer on a later visit — and Settings can offer it regardless.
 * ────────────────────────────────────────────────────────────────────────────
 */
export async function runInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = state.deferred;
  if (!event) return "unavailable";

  await event.prompt();
  const { outcome } = await event.userChoice;

  // Spent either way — the spec allows `prompt()` once per event.
  state = { ...state, deferred: null };

  if (outcome === "accepted") {
    markDismissed();
    return "accepted";
  }

  emit();
  return "dismissed";
}
