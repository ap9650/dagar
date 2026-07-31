import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * The notify layer (D4).
 *
 * What matters here is not that Twilio works — we cannot test that, and the
 * sandbox could not carry a weekly cadence even if we could. It is the two
 * properties the rest of the product depends on:
 *
 *   1. `sendParentSummary` ALWAYS resolves. It is called from a cron handler
 *      that may be delivering to many learners in one run, and one unreachable
 *      provider must not end that run.
 *   2. The consent gate holds. A number a learner typed is an intention; the
 *      recipient joining from their own WhatsApp is the permission.
 */

const ENV_KEYS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_FROM",
  "TWILIO_SMS_FROM",
  "TWILIO_DLT_ENTITY_ID",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  vi.resetModules();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.restoreAllMocks();
});

const message = { body: "Riya finished 3 lessons this week.", url: "https://saathi.test/s/abc" };
const optedIn = { e164: "+919000000000", optedInAt: "2026-08-01T00:00:00Z" };

describe("sendParentSummary — always resolves", () => {
  it("falls through to in-app when nothing is configured", async () => {
    const { sendParentSummary } = await import("@/lib/notify");
    const outcome = await sendParentSummary(optedIn, message);

    expect(outcome.delivered.ok).toBe(true);
    expect(outcome.delivered.channel).toBe("in_app");
    // WhatsApp and SMS were both skipped for want of credentials, and that is
    // recorded rather than silent — the health page reads these.
    expect(outcome.attempts.map((a) => a.channel)).toEqual(["whatsapp", "sms"]);
    expect(outcome.attempts.every((a) => !a.ok && a.reason === "not_configured")).toBe(true);
  });

  it("does not throw when a provider errors", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const { sendParentSummary } = await import("@/lib/notify");
    const outcome = await sendParentSummary(optedIn, message);

    // The run continues on the floor beneath it.
    expect(outcome.delivered.ok).toBe(true);
    expect(outcome.delivered.channel).toBe("in_app");
    const whatsapp = outcome.attempts.find((a) => a.channel === "whatsapp");
    expect(whatsapp?.ok).toBe(false);
  });

  it("reports the provider id when WhatsApp accepts it", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sid: "SM123" }) }),
    );

    const { sendParentSummary } = await import("@/lib/notify");
    const outcome = await sendParentSummary(optedIn, message);

    expect(outcome.delivered).toMatchObject({ ok: true, channel: "whatsapp", providerId: "SM123" });
    expect(outcome.attempts).toHaveLength(0); // first choice, no fallback needed
  });
});

describe("the consent gate", () => {
  it("refuses to send to a number that has not opted in", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { sendParentSummary } = await import("@/lib/notify");
    const outcome = await sendParentSummary(
      { e164: "+919000000000", optedInAt: null },
      message,
    );

    // The gate that matters: a learner typing an adult's number is not that
    // adult agreeing to be messaged.
    expect(fetchMock).not.toHaveBeenCalled();
    const whatsapp = outcome.attempts.find((a) => a.channel === "whatsapp");
    expect(whatsapp).toMatchObject({ ok: false, reason: "not_opted_in" });
  });

  it("refuses when there is no number at all", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { sendParentSummary } = await import("@/lib/notify");
    const outcome = await sendParentSummary({ e164: null, optedInAt: null }, message);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome.delivered.channel).toBe("in_app");
  });
});

describe("SMS is off because it is unregistered, not because it is unwritten", () => {
  it("stays unconfigured without a DLT entity id, even with Twilio credentials", async () => {
    // TRAI mandates DLT registration for A2P SMS to Indian numbers. Sending
    // without it is rejected by the carrier, so failing here is clearer than
    // failing at the operator.
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_SMS_FROM = "+15550000000";

    const { channelStatus } = await import("@/lib/notify");
    const sms = channelStatus().find((c) => c.channel === "sms");
    expect(sms?.configured).toBe(false);
  });

  it("turns on with the entity id and no code change", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_SMS_FROM = "+15550000000";
    process.env.TWILIO_DLT_ENTITY_ID = "1234567890";

    const { channelStatus } = await import("@/lib/notify");
    const sms = channelStatus().find((c) => c.channel === "sms");
    expect(sms?.configured).toBe(true);
  });
});

describe("channelStatus — what the health page reads", () => {
  it("always lists in-app as available", async () => {
    const { channelStatus } = await import("@/lib/notify");
    expect(channelStatus().find((c) => c.channel === "in_app")?.configured).toBe(true);
  });
});
