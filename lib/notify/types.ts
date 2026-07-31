/**
 * The notification contract (D4).
 *
 * ── ONE INTERFACE, SEVERAL CHANNELS, AND THE POINT IS THE SEAM ──────────────
 * D4's whole argument is that the channel is a **deployment detail**, not a
 * product decision: WhatsApp is right for Indian parents today, SMS is blocked
 * on DLT registration, email is wrong for this audience, and any of that could
 * change in a month. So the caller never names a channel — it asks for a summary
 * to be delivered and the adapter list decides how.
 *
 * That seam is why "SMS is one config change away" is a true statement rather
 * than a hopeful one, and it is worth saying in the demo.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Nothing in here is Twilio-shaped. If it were, the interface would be a Twilio
 * wrapper with extra steps.
 */

export type NotifyChannel = "whatsapp" | "sms" | "in_app";

/**
 * What a summary message says. Assembled by the caller, rendered by the adapter.
 *
 * Note what is NOT here: the learner's id, the recipient's number, and any of
 * the learner's work. An adapter needs the words and the link, and giving it
 * more would put a child's data in every channel integration we ever add.
 */
export type SummaryMessage = {
  /** Already in the RECIPIENT's language — adapters never translate. */
  body: string;
  /** The `/s/[token]` URL. Absent when the learner has revoked their link. */
  url: string | null;
};

export type DeliveryResult =
  | { ok: true; channel: NotifyChannel; providerId?: string }
  | {
      ok: false;
      channel: NotifyChannel;
      /**
       * Why it failed, in a form the caller can act on:
       *   not_configured  — no credentials in this environment
       *   not_opted_in    — the recipient has not joined from their own phone
       *   no_recipient    — nothing to send to
       *   provider_error  — the channel accepted the request and refused it
       */
      reason: "not_configured" | "not_opted_in" | "no_recipient" | "provider_error";
      detail?: string;
    };

export type Recipient = {
  /** E.164, or null when the learner has not given one. */
  e164: string | null;
  /**
   * When the recipient joined from their OWN WhatsApp.
   *
   * Null blocks delivery, and that is the consent gate: a number a child typed
   * is an intention, not a permission (D4, amended 1 Aug 2026).
   */
  optedInAt: string | null;
};

/**
 * Every adapter is this shape. `send` NEVER throws — a channel being down must
 * not break the job that called it, and a summary that fails to send is a thing
 * to log and retry, not an exception to propagate into a cron handler.
 */
export type NotifyAdapter = {
  channel: NotifyChannel;
  /** False when credentials are missing, so the caller can fall through. */
  isConfigured(): boolean;
  send(recipient: Recipient, message: SummaryMessage): Promise<DeliveryResult>;
};
