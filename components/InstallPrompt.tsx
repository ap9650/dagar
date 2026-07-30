"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Share, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Add-to-Home-Screen prompt (D15).
 *
 * **Shown only after a first lesson is completed, never on first load.** A
 * learner who has not yet got anything out of Saathi has no reason to install
 * it, and asking then is how an app trains someone to dismiss its prompts
 * without reading them.
 *
 * Dismissal persists. We never ask twice.
 *
 * iOS Safari does not fire `beforeinstallprompt` at all — there is no
 * programmatic install on iOS. Rather than showing a button that does nothing,
 * it gets the real instructions. Most learners are on Android, but a judge may
 * well open the demo on an iPhone.
 */

const DISMISSED_KEY = "saathi.install.dismissed";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * A module-level store, read through `useSyncExternalStore`.
 *
 * Why not `useState` in an effect: everything here — localStorage, matchMedia,
 * the user agent, and the `beforeinstallprompt` event — is external browser
 * state that does not exist during the server render. `useSyncExternalStore` is
 * built for exactly that, and it gives a server snapshot for free, so the server
 * and client render identically instead of flashing a prompt on hydration.
 */
type Snapshot = { deferred: InstallEvent | null; dismissed: boolean; isIOS: boolean };

const SERVER_SNAPSHOT: Snapshot = { deferred: null, dismissed: true, isIOS: false };

let snapshot: Snapshot = SERVER_SNAPSHOT;
let initialised = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function readBrowser(): Snapshot {
  return {
    deferred: snapshot.deferred,
    // Already running from the home screen means already installed.
    dismissed:
      window.matchMedia("(display-mode: standalone)").matches ||
      localStorage.getItem(DISMISSED_KEY) === "1",
    isIOS: /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window),
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (!initialised) {
    initialised = true;
    snapshot = readBrowser();

    window.addEventListener("beforeinstallprompt", (event) => {
      // Suppress Chrome's own banner so ours is the only ask.
      event.preventDefault();
      snapshot = { ...snapshot, deferred: event as InstallEvent };
      emit();
    });
  }

  return () => listeners.delete(listener);
}

/** Cached object identity — `useSyncExternalStore` loops if this is new each call. */
const getSnapshot = () => snapshot;
const getServerSnapshot = () => SERVER_SNAPSHOT;

function markDismissed() {
  localStorage.setItem(DISMISSED_KEY, "1");
  snapshot = { ...snapshot, dismissed: true };
  emit();
}

export function InstallPrompt({ show }: { show: boolean }) {
  const t = useTranslations("install");
  const { deferred, dismissed, isIOS } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // `beforeinstallprompt` can fire before this component ever mounts, so the
  // store may already hold it. Re-read once on mount to pick up anything that
  // landed while the learner was elsewhere in the app.
  useEffect(() => {
    if (snapshot === SERVER_SNAPSHOT) {
      snapshot = readBrowser();
      emit();
    }
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    // Either way this ask is spent — the browser will not replay the event.
    markDismissed();
  }

  if (!show || dismissed) return null;
  if (!deferred && !isIOS) return null; // nothing installable to offer

  return (
    <Card className="flex flex-col gap-md bg-primary-wash border-primary-soft">
      <div className="flex items-start justify-between gap-md">
        <div className="flex flex-col gap-xs min-w-0">
          <h2 className="text-h3 text-ink">{t("title")}</h2>
          <p className="text-body-sm text-body">{t("body")}</p>
        </div>
        <button
          type="button"
          onClick={markDismissed}
          aria-label={t("notNow")}
          className="inline-flex items-center justify-center size-11 shrink-0 rounded-(--radius-control) text-muted"
        >
          <X size={20} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      {isIOS ? (
        // No programmatic install on iOS, so describe the actual taps.
        <p className="flex items-center gap-sm text-body-sm text-body">
          <Share size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />
          {t("iosSteps")}
        </p>
      ) : (
        <Button onClick={install}>{t("action")}</Button>
      )}
    </Card>
  );
}
