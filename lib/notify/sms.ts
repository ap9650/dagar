import "server-only";
import type { DeliveryResult, NotifyAdapter, Recipient, SummaryMessage } from "./types";

/**
 * SMS — a working adapter that is **deliberately not enabled** (D4).
 *
 * ── WHY THIS EXISTS AS CODE AND NOT AS A TODO ───────────────────────────────
 * India's TRAI mandates DLT registration for all A2P SMS to Indian numbers: a
 * registered business entity, a registered sender ID, and per-template approval.
 * That is multi-day and needs a company. It cannot be done in a buildathon, and
 * pretending otherwise would produce a channel that fails at the demo rather
 * than in development.
 *
 * So the adapter is written, wired into the registry, and returns
 * `not_configured` — because it genuinely is not configured, not because it is
 * unwritten. When DLT clears, three environment variables turn it on and no
 * calling code changes.
 *
 * That is the difference between "we would add SMS later" and "SMS is one config
 * change away", and only one of those is true here.
 * ────────────────────────────────────────────────────────────────────────────
 */

const TWILIO_API = "https://api.twilio.com/2010-04-01";

function credentials() {
  return {
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    // Absent until DLT registration completes. Its absence is the switch.
    from: process.env.TWILIO_SMS_FROM,
    dltEntityId: process.env.TWILIO_DLT_ENTITY_ID,
  };
}

export const smsAdapter: NotifyAdapter = {
  channel: "sms",

  isConfigured() {
    const { sid, token, from, dltEntityId } = credentials();
    // `dltEntityId` is required on purpose: sending to an Indian number without
    // it is rejected by the carrier anyway, and failing here is clearer than
    // failing at the operator.
    return Boolean(sid && token && from && dltEntityId);
  },

  async send(recipient: Recipient, message: SummaryMessage): Promise<DeliveryResult> {
    const { sid, token, from } = credentials();

    if (!this.isConfigured() || !sid || !token || !from) {
      return { ok: false, channel: "sms", reason: "not_configured" };
    }
    if (!recipient.e164) {
      return { ok: false, channel: "sms", reason: "no_recipient" };
    }

    const body = message.url ? `${message.body} ${message.url}` : message.body;

    try {
      const response = await fetch(`${TWILIO_API}/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: from, To: recipient.e164, Body: body }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        return {
          ok: false,
          channel: "sms",
          reason: "provider_error",
          detail: `HTTP ${response.status}`,
        };
      }

      const json = (await response.json()) as { sid?: string };
      return { ok: true, channel: "sms", providerId: json.sid };
    } catch (error) {
      return {
        ok: false,
        channel: "sms",
        reason: "provider_error",
        detail: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      };
    }
  },
};
