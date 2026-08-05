"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  permissionState,
  pushSupport,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

/**
 * Turning the daily reminder on and off, from Settings.
 *
 * ── WHY THIS HAS TO EXIST ───────────────────────────────────────────────────
 * D17b's whole safety argument is that the reminder is an invitation rather
 * than an obligation. An invitation you cannot decline afterwards is not one —
 * and a learner who can only stop reminders by burrowing into browser settings
 * will instead do the thing browsers make easy, which is BLOCK the site. That
 * is unrecoverable from inside the app, so an easy off switch here protects the
 * channel as much as it respects the learner.
 *
 * Reads the live browser state rather than a stored flag: permission can be
 * revoked in browser settings at any time, and a toggle claiming "On" for a
 * browser that has since blocked us would be a lie the app could not detect.
 */
/** No external changes to listen for — these values move only when the
 *  learner acts, which re-renders anyway. */
const subscribeToNothing = () => () => {};

export function ReminderSetting() {
  const t = useTranslations("reminders");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  /**
   * Browser facts, read synchronously.
   *
   * `useSyncExternalStore` rather than an effect that calls setState — the
   * React compiler rejects the latter, and these are genuinely external values
   * this component reads rather than state it owns. The snapshots return
   * PRIMITIVES: `pushSupport()` builds a fresh object each call, and returning
   * it here would make every render a new value and loop forever.
   *
   * The server snapshot is the pessimistic one, so nothing flashes on before
   * the browser has been asked.
   */
  const supportReason = useSyncExternalStore(
    subscribeToNothing,
    () => {
      const s = pushSupport();
      return s.supported ? "ok" : s.reason;
    },
    () => "unsupported" as const,
  );
  const permission = useSyncExternalStore(
    subscribeToNothing,
    permissionState,
    () => "unavailable" as const,
  );

  // Whether a subscription actually exists — asynchronous, so it stays state.
  // Permission alone is not enough: a subscription can be dropped while the
  // permission remains, and the registration is the only truth.
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (permission !== "granted") return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (!cancelled) setHasSubscription(Boolean(subscription));
      })
      .catch(() => {
        if (!cancelled) setHasSubscription(false);
      });
    return () => {
      cancelled = true;
    };
  }, [permission]);

  const on = permission === "granted" ? hasSubscription : false;

  if (supportReason !== "ok") {
    // On an iPhone before installing, say the useful sentence. Elsewhere, say
    // nothing rather than offer a control that cannot work.
    return supportReason === "needs_install" ? (
      <div className="flex items-start gap-md py-md">
        <Bell size={20} strokeWidth={1.75} aria-hidden className="text-muted shrink-0 mt-0.5" />
        <div className="flex flex-col gap-xs min-w-0">
          <p className="text-body text-ink">{t("settingsTitle")}</p>
          <p className="text-body-sm text-muted">{t("iosHint")}</p>
        </div>
      </div>
    ) : null;
  }

  const blocked = permission === "denied";

  async function toggle() {
    setBusy(true);
    if (on) {
      await unsubscribeFromPush();
      setHasSubscription(false);
    } else {
      const outcome = await subscribeToPush(publicKey);
      setHasSubscription(outcome === "subscribed");
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center justify-between gap-md py-md min-h-11">
      <div className="flex items-start gap-md min-w-0">
        <Bell size={20} strokeWidth={1.75} aria-hidden className="text-primary shrink-0 mt-0.5" />
        <div className="flex flex-col gap-xs min-w-0">
          <p className="text-body text-ink">{t("settingsTitle")}</p>
          {blocked && <p className="text-body-sm text-muted">{t("blocked")}</p>}
        </div>
      </div>

      {!blocked && (
        <button
          type="button"
          role="switch"
          aria-checked={on === true}
          aria-label={t("settingsTitle")}
          disabled={busy || on === null}
          onClick={toggle}
          className={`min-h-11 px-lg shrink-0 rounded-(--radius-control) border text-label
                      transition-colors duration-150 ease-out
                      focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2
                      ${
                        on
                          ? "border-primary bg-primary-soft text-primary-strong"
                          : "border-border-strong bg-background text-body"
                      }`}
        >
          {on ? t("settingsOn") : t("settingsOff")}
        </button>
      )}
    </div>
  );
}
