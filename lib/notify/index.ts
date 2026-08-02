import "server-only";
import { inAppAdapter } from "./in-app";
import { smsAdapter } from "./sms";
import { whatsappAdapter } from "./whatsapp";
import type { DeliveryResult, NotifyAdapter, Recipient, SummaryMessage } from "./types";

export type { DeliveryResult, NotifyChannel, Recipient, SummaryMessage } from "./types";

/**
 * `sendParentSummary` — the one function the rest of Dagar calls (D4).
 *
 * The caller does not choose a channel and cannot. It hands over a recipient and
 * a message; this decides how, in order of how well the channel serves an Indian
 * parent on a shared phone:
 *
 *   1. **WhatsApp** — free over data, and penetration among parents in this
 *      demographic substantially exceeds email. Demo-only until Meta business
 *      verification; see the adapter for exactly why.
 *   2. **SMS** — written, wired, and switched off pending TRAI DLT registration.
 *      Its absence is a config fact, not missing code.
 *   3. **In-app** — always succeeds. The summary is already reachable at
 *      `/s/[token]`, so this is the floor beneath every other channel.
 *
 * ── IT NEVER THROWS, AND THAT IS THE CONTRACT ───────────────────────────────
 * This is called from a cron handler that may be delivering to many learners in
 * one run. One unreachable provider must not end that run, and a failed send is
 * something to record and retry — never an exception to propagate. Every adapter
 * returns a `DeliveryResult`; nothing here rethrows.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Ordered by preference. In-app is last because it is the fallback, not the goal. */
const ADAPTERS: NotifyAdapter[] = [whatsappAdapter, smsAdapter, inAppAdapter];

export type SendOutcome = {
  /** The delivery that succeeded — always present, because in-app always does. */
  delivered: DeliveryResult;
  /** Everything tried and rejected first, for the log and the health page. */
  attempts: DeliveryResult[];
};

export async function sendParentSummary(
  recipient: Recipient,
  message: SummaryMessage,
): Promise<SendOutcome> {
  const attempts: DeliveryResult[] = [];

  for (const adapter of ADAPTERS) {
    // Skipped without an attempt when there are no credentials: an unconfigured
    // channel is not a failure worth logging every week.
    if (!adapter.isConfigured()) {
      attempts.push({ ok: false, channel: adapter.channel, reason: "not_configured" });
      continue;
    }

    let result: DeliveryResult;
    try {
      result = await adapter.send(recipient, message);
    } catch (error) {
      // An adapter is contracted not to throw. If one does anyway, that is a bug
      // in the adapter and must still not take down the run.
      result = {
        ok: false,
        channel: adapter.channel,
        reason: "provider_error",
        detail: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      };
    }

    if (result.ok) return { delivered: result, attempts };
    attempts.push(result);
  }

  // Unreachable while in-app is in the list, and handled rather than asserted:
  // a future edit that removes it should not produce an undefined return.
  return {
    delivered: { ok: true, channel: "in_app" },
    attempts,
  };
}

/** Which channels could actually deliver right now — for `/admin/metrics`. */
export function channelStatus(): { channel: string; configured: boolean }[] {
  return ADAPTERS.map((adapter) => ({
    channel: adapter.channel,
    configured: adapter.isConfigured(),
  }));
}
