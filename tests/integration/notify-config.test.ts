import { describe, it, expect } from "vitest";
import { channelStatus } from "@/lib/notify";

/**
 * Is WhatsApp actually configured in THIS environment?
 *
 * `tests/setup.ts` loads `.env.local`, so this reads the same credentials the
 * dev server does. It is the check that catches a mistyped Account SID or a
 * sender missing its `whatsapp:` prefix — the two config errors that otherwise
 * surface as an opaque Twilio 400, at the worst possible moment.
 *
 * Skips itself when the credentials are absent, so a fresh clone and CI both
 * stay green. A skipped test here means "not configured", not "broken".
 */
const configured = Boolean(
  process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM,
);

const d = configured ? describe : describe.skip;

d("WhatsApp credentials in this environment", () => {
  it("reports the channel as configured", () => {
    expect(channelStatus().find((c) => c.channel === "whatsapp")?.configured).toBe(true);
  });

  it("has an Account SID of the right shape", () => {
    // 'AC' + 32 hex. A truncated paste is the common failure and is invisible
    // until Twilio rejects it.
    expect(process.env.TWILIO_ACCOUNT_SID).toMatch(/^AC[0-9a-f]{32}$/);
  });

  it("has a 32-character auth token", () => {
    expect(process.env.TWILIO_AUTH_TOKEN).toHaveLength(32);
  });

  it("keeps SMS off — it is unregistered, not unwritten", () => {
    // TRAI DLT registration needs a registered business entity and about a week.
    // If this ever goes true unexpectedly, someone has set the variables without
    // completing the registration, and the carrier will reject the traffic.
    expect(channelStatus().find((c) => c.channel === "sms")?.configured).toBe(false);
  });
});
