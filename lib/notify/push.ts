import "server-only";
import webpush from "web-push";

/**
 * Web push — the send half of D17b.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT VAPID IS, IN ONE PARAGRAPH, BECAUSE THE NEXT PERSON WILL ASK.
 *
 * A browser will not accept a push from just anyone. VAPID is the proof it came
 * from us: a keypair generated once. The PUBLIC key goes to the browser when it
 * subscribes and is meant to be public — it is the one place in this codebase
 * where `NEXT_PUBLIC_` on something called a key is correct. The PRIVATE key
 * signs each send and never leaves the server.
 *
 * **Never regenerate them.** A subscription is bound to the keypair that
 * created it, so a new pair silently breaks every existing subscription — no
 * error, notifications just stop arriving and nobody finds out.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushMessage = {
  title: string;
  body: string;
  /** Where tapping it goes. Always in-app; a notification never leaves Dagar. */
  url: string;
};

/**
 * Is push configured at all?
 *
 * Missing keys are a real state, not an error: local development usually has
 * none, and the cron must no-op cleanly rather than throw a 500 every evening.
 */
export function pushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

let configured = false;

function configure(): void {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export type SendResult =
  | { ok: true }
  /**
   * The browser is gone — uninstalled, permission revoked, or the endpoint
   * expired. The row should be deleted rather than retried: push services
   * return 404/410 for these and will never accept it again.
   */
  | { ok: false; gone: true }
  | { ok: false; gone: false; error: string };

/**
 * One push, to one browser.
 *
 * Never throws. A reminder failing must not take down a cron that still has
 * twenty learners to reach — the caller collects results and carries on.
 */
export async function sendPush(
  subscription: PushSubscriptionRow,
  message: PushMessage,
): Promise<SendResult> {
  if (!pushConfigured()) return { ok: false, gone: false, error: "not_configured" };
  configure();

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(message),
      // Deliver within the hour or drop it. A reminder to do today's lesson is
      // worthless tomorrow morning, and a phone that was off all evening should
      // wake up to nothing rather than to a stale nudge.
      { TTL: 3600 },
    );
    return { ok: true };
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) return { ok: false, gone: true };
    return {
      ok: false,
      gone: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
