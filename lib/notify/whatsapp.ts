import "server-only";
import type { DeliveryResult, NotifyAdapter, Recipient, SummaryMessage } from "./types";

/**
 * WhatsApp, through the Twilio **sandbox** (D4).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * READ THIS BEFORE PROMISING A WEEKLY SUMMARY OVER WHATSAPP.
 *
 * The sandbox **cannot carry a weekly cadence** — verified 29 Jul 2026 and
 * written into D4. Two hard limits, neither of which is a bug we can work
 * around:
 *
 *   1. **72-hour session window.** A business may only message a user freely
 *      within 72 hours of that user's last inbound message. A weekly summary is
 *      by definition outside it.
 *   2. **No custom templates.** Messaging outside the window requires a
 *      pre-approved template, and the sandbox does not allow registering one.
 *
 * So this adapter delivers reliably to someone who messaged us in the last three
 * days, and not otherwise. That is enough for a live demo and is not enough for
 * a product. Meta business verification lifts both, and is weeks of paperwork.
 *
 * SAY THIS OUT LOUD IN THE DEMO. A judge who knows the WhatsApp API will know,
 * and "the adapter is real, the sandbox is the limit, here is exactly what
 * changes" is a stronger answer than being caught.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const TWILIO_API = "https://api.twilio.com/2010-04-01";

/**
 * Twilio's `From` for WhatsApp must be `whatsapp:+14155238886`, not the bare
 * number — but the console displays it as `+1 415 523 8886`, so copying what is
 * on screen produces a value that is wrong in a way nothing explains. Twilio
 * answers a bare number with a generic 400, which is a bad afternoon.
 *
 * So both forms are accepted and normalised here. Being strict about this would
 * be enforcing a formatting convention nobody is served by.
 */
function normaliseSender(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/\s+/g, "");
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
}

function credentials() {
  return {
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    // The sandbox sender. Accepts `whatsapp:+14155238886` or `+14155238886`.
    from: normaliseSender(process.env.TWILIO_WHATSAPP_FROM),
  };
}

export const whatsappAdapter: NotifyAdapter = {
  channel: "whatsapp",

  isConfigured() {
    const { sid, token, from } = credentials();
    return Boolean(sid && token && from);
  },

  async send(recipient: Recipient, message: SummaryMessage): Promise<DeliveryResult> {
    const { sid, token, from } = credentials();

    if (!sid || !token || !from) {
      return { ok: false, channel: "whatsapp", reason: "not_configured" };
    }
    if (!recipient.e164) {
      return { ok: false, channel: "whatsapp", reason: "no_recipient" };
    }

    // ── the consent gate ───────────────────────────────────────────────────
    // A number a learner typed is an intention. The recipient joining the
    // sandbox from their own WhatsApp is the permission, and this is where that
    // distinction is enforced rather than assumed (D4, amended 1 Aug 2026).
    if (!recipient.optedInAt) {
      return { ok: false, channel: "whatsapp", reason: "not_opted_in" };
    }

    const body = message.url ? `${message.body}\n\n${message.url}` : message.body;

    try {
      const response = await fetch(`${TWILIO_API}/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          // Basic auth over HTTPS is what Twilio's REST API takes. The SDK would
          // be ~2MB of dependency for one POST.
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: from,
          To: `whatsapp:${recipient.e164}`,
          Body: body,
        }),
        // A cron job must not hang on a slow provider.
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        // The response body can echo the destination number. Take the code and
        // the message, never the payload — this string ends up in a log.
        const detail = await response
          .json()
          .then((json: { code?: number; message?: string }) =>
            `${json.code ?? response.status}: ${json.message ?? "unknown"}`,
          )
          .catch(() => `HTTP ${response.status}`);

        return { ok: false, channel: "whatsapp", reason: "provider_error", detail };
      }

      const json = (await response.json()) as { sid?: string };
      return { ok: true, channel: "whatsapp", providerId: json.sid };
    } catch (error) {
      return {
        ok: false,
        channel: "whatsapp",
        reason: "provider_error",
        detail: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      };
    }
  },
};
