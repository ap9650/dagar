import "server-only";
import type { DeliveryResult, NotifyAdapter } from "./types";

/**
 * In-app — the channel that always works (D4).
 *
 * It sends nothing. The summary is already there: `/s/[token]` for a supporting
 * adult with no account, `/parent` for one with an account. "Delivery" here means
 * the summary is reachable, which it is by construction.
 *
 * ── WHY A NO-OP IS WORTH BEING AN ADAPTER ───────────────────────────────────
 * It is the floor. Every other channel in this product can fail for reasons
 * outside our control — Twilio credentials, a 72-hour window, DLT registration
 * — and this one cannot. Having it in the registry means the delivery loop
 * always has a terminal case that succeeds, so "no channel worked" is never a
 * state the caller has to handle.
 *
 * It also keeps the demo honest: when WhatsApp is unavailable, the parent
 * feature has not failed. It has fallen back to the surface it was always built
 * on.
 * ────────────────────────────────────────────────────────────────────────────
 */
export const inAppAdapter: NotifyAdapter = {
  channel: "in_app",

  isConfigured() {
    return true; // no credentials, nothing to configure, nothing to break
  },

  async send(): Promise<DeliveryResult> {
    // Arguments deliberately unused: there is nothing to deliver to and nothing
    // to render. The summary is already at /s/[token].
    return { ok: true, channel: "in_app" };
  },
};
