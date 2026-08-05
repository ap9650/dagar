/**
 * Browser-side push subscription.
 *
 * Client code, so nothing secret is here: the only key it touches is the VAPID
 * PUBLIC key, which is meant to be public — it is what a browser uses to check
 * that a push came from us.
 */

/** Remembers a decline so the card does not ask again on every lesson. */
export const PUSH_ASKED_KEY = "saathi.push.asked";

export type PushSupport =
  | { supported: true }
  /**
   * iOS refuses web push unless the PWA is installed to the home screen. A
   * distinct reason so the UI can say the useful sentence rather than hiding a
   * button and leaving a learner to wonder.
   */
  | { supported: false; reason: "needs_install" | "unsupported" };

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return { supported: false, reason: "unsupported" };

  const hasApi =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!hasApi) {
    // Safari on iOS only exposes PushManager to an installed app, so a missing
    // API on an iPhone means "add to home screen", not "your phone cannot".
    const isIos = /iP(hone|ad|od)/.test(navigator.userAgent);
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    return { supported: false, reason: isIos && !installed ? "needs_install" : "unsupported" };
  }

  return { supported: true };
}

/** Has this browser already granted, denied, or not yet been asked? */
export function permissionState(): NotificationPermission | "unavailable" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unavailable";
  return Notification.permission;
}

/**
 * The VAPID public key, as the byte array `subscribe()` wants.
 *
 * It arrives base64url-encoded and the API takes a `Uint8Array`. This
 * conversion is the single most common reason a push subscription fails with an
 * opaque error, which is why it is a named function rather than an inline
 * one-liner.
 */
function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);
  // Backed by a plain ArrayBuffer, spelled out: `Uint8Array.from` types as
  // `ArrayBufferLike`, which could be a SharedArrayBuffer and is therefore not
  // a `BufferSource` the subscribe API accepts.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type SubscribeOutcome = "subscribed" | "denied" | "unsupported" | "failed";

/**
 * Ask permission, subscribe, and tell the server where to reach this browser.
 *
 * **Only ever call this from a real tap.** Browsers require a user gesture for
 * the permission prompt, and one shown out of nowhere is the fastest way to a
 * permanent denial — which cannot be undone from inside the app.
 */
export async function subscribeToPush(publicKey: string): Promise<SubscribeOutcome> {
  if (!pushSupport().supported || !publicKey) return "unsupported";

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const registration = await navigator.serviceWorker.ready;

    // Reuse an existing subscription rather than creating a second one. A
    // browser that already has one returns it, and re-subscribing with
    // different options would throw.
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        // Required by every browser: a push must always result in a visible
        // notification. Silent pushes are how background tracking is built, and
        // browsers refuse them outright.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    const response = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });

    return response.ok ? "subscribed" : "failed";
  } catch (error) {
    console.error("[push] subscribe failed:", error);
    return "failed";
  }
}

/** Stop reminders on this browser — both here and on the server. */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;

    // Server first. If the local unsubscribe succeeded and the delete failed,
    // the cron would keep pushing to an endpoint the browser has abandoned —
    // wasted sends, and a row that never gets cleaned up.
    await fetch("/api/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    await subscription.unsubscribe();
    return true;
  } catch (error) {
    console.error("[push] unsubscribe failed:", error);
    return false;
  }
}
