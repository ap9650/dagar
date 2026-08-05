"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * The two things about notifications that cannot be read off a screen: whether
 * one actually arrives on a phone, and what the weekly parent message says.
 *
 * English only, like the rest of `/admin`. It has one reader.
 */

type PushResult =
  | { ok: true; sent: number; devices: number; removed: number }
  | { ok: false; reason?: string; sent?: number };

export function NotificationTester({
  variants,
}: {
  /** Rendered on the server so these are the real strings, not a copy of them. */
  variants: { key: string; label: string; locale: "en" | "hi"; slot: string; title: string; body: string; days?: number }[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, PushResult>>({});

  async function send(v: (typeof variants)[number]) {
    setBusy(v.key);
    try {
      const response = await fetch("/api/admin/test-push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slot: v.slot, locale: v.locale, days: v.days ?? null }),
      });
      const json = (await response.json()) as PushResult;
      setResult((r) => ({ ...r, [v.key]: json }));
    } catch {
      setResult((r) => ({ ...r, [v.key]: { ok: false, reason: "request_failed" } }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="flex flex-col gap-lg list-none m-0 p-0">
      {variants.map((v) => {
        const outcome = result[v.key];
        return (
          <li key={v.key} className="flex flex-col gap-sm">
            <p className="text-caption text-muted">{v.label}</p>

            {/* Shaped like an Android notification, because the question being
                asked is "how does this read on a lock screen", not "what is the
                string". */}
            <div className="flex items-start gap-md rounded-(--radius-card) border border-border bg-surface px-lg py-md">
              <span
                aria-hidden
                className="shrink-0 size-8 rounded-full bg-primary text-background grid place-items-center text-label font-medium"
              >
                ड
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-label font-medium text-ink">{v.title}</span>
                <span className="text-body-sm text-body">{v.body}</span>
              </div>
            </div>

            <div className="flex items-center gap-md flex-wrap">
              <Button
                variant="secondary"
                className="grow-0 w-auto px-lg"
                loading={busy === v.key}
                onClick={() => send(v)}
              >
                Send to my devices
              </Button>

              {outcome && (
                <span className="text-body-sm text-body">
                  {outcome.ok
                    ? `Sent to ${outcome.sent} of ${outcome.devices} device(s).`
                    : outcome.reason === "no_subscriptions"
                      ? "No devices subscribed on this account — turn reminders on first."
                      : outcome.reason === "push_not_configured"
                        ? "VAPID keys are missing in this environment."
                        : "Could not send."}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type ReminderRow = {
  who: string;
  isYou: boolean;
  send: boolean;
  reason: string;
  locale: string;
  streakDays: number;
  rung: number | null;
  body: string;
};

/**
 * What the crons would do right now, without doing it.
 *
 * The reminders' design is who does NOT get one, and that is invisible from
 * every screen in the product. Run this, finish a lesson on a test account, run
 * it again: the row flips from "would send" to "goal met".
 */
export function DryRun() {
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<{ slot: string; rows: ReminderRow[] } | null>(null);

  async function run(slot: "afternoon" | "evening") {
    setBusy(slot);
    try {
      const response = await fetch("/api/admin/dry-run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job: "reminders", slot }),
      });
      const json = await response.json();
      setOut({ slot, rows: json.rows ?? [] });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex gap-md flex-wrap">
        {(["afternoon", "evening"] as const).map((slot) => (
          <Button
            key={slot}
            variant="secondary"
            className="grow-0 w-auto px-lg"
            loading={busy === slot}
            onClick={() => run(slot)}
          >
            {slot === "afternoon" ? "Check the 4pm run" : "Check the 8pm run"}
          </Button>
        ))}
      </div>

      {out &&
        (out.rows.length === 0 ? (
          <p className="text-body-sm text-body">
            Nobody has reminders switched on yet, so this run would send nothing.
          </p>
        ) : (
          <div className="flex flex-col gap-sm">
            <p className="text-body-sm text-muted">
              {out.rows.filter((r) => r.send).length} would be sent ·{" "}
              {out.rows.filter((r) => !r.send).length} skipped
            </p>
            <ul className="flex flex-col gap-sm list-none m-0 p-0">
              {out.rows.map((row, i) => (
                <li
                  key={i}
                  className="flex flex-col gap-xs rounded-(--radius-card) border border-border px-lg py-md"
                >
                  <div className="flex items-center justify-between gap-md flex-wrap">
                    <span className="text-label font-medium text-ink">
                      {row.who}
                      {row.isYou && " · this is you"}
                    </span>
                    <span
                      className={
                        row.send ? "text-body-sm text-notquite" : "text-body-sm text-correct"
                      }
                    >
                      {row.send ? "would be sent" : "skipped — goal already met"}
                    </span>
                  </div>
                  <span className="text-caption text-muted">
                    {row.locale === "hi" ? "Hindi" : "English"} · streak {row.streakDays}
                    {row.rung !== null && ` · one day from the ${row.rung}-day badge`}
                  </span>
                  {row.send && <span className="text-body-sm text-body">“{row.body}”</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}

type SummaryRow = {
  who: string;
  locale: string;
  channel: string;
  quiet: boolean;
  lessons: number;
  practice: number;
  body: string;
  source: string;
};

export function SummaryPreview() {
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<Record<string, { body: string; source: string }>>({});
  const [real, setReal] = useState<SummaryRow[] | null>(null);

  async function generate(locale: "en" | "hi") {
    setBusy(locale);
    try {
      const response = await fetch("/api/admin/preview-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const json = await response.json();
      setOut((o) => ({ ...o, [locale]: { body: json.body, source: json.source } }));
    } catch {
      setOut((o) => ({ ...o, [locale]: { body: "Could not generate.", source: "error" } }));
    } finally {
      setBusy(null);
    }
  }

  /** The Sunday job, against the real share links, without sending. */
  async function dryRun() {
    setBusy("real");
    try {
      const response = await fetch("/api/admin/dry-run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job: "summary" }),
      });
      const json = await response.json();
      setReal(json.rows ?? []);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex gap-md flex-wrap">
        <Button
          variant="secondary"
          className="grow-0 w-auto px-lg"
          loading={busy === "real"}
          onClick={dryRun}
        >
          What Sunday would send
        </Button>
      </div>

      {real &&
        (real.length === 0 ? (
          <p className="text-body-sm text-body">
            No live share links, so Sunday would send nothing. Create one from a learner&rsquo;s
            Settings → &ldquo;Share your progress&rdquo;.
          </p>
        ) : (
          <ul className="flex flex-col gap-md list-none m-0 p-0">
            {real.map((row, i) => (
              <li
                key={i}
                className="flex flex-col gap-xs rounded-(--radius-card) border border-border px-lg py-md"
              >
                <span className="text-caption text-muted">
                  {row.who} · {row.locale === "hi" ? "Hindi" : "English"} · {row.channel} ·{" "}
                  {row.lessons} lessons, {row.practice} questions this week
                  {row.quiet && " · quiet week"}
                  {row.source === "fallback" && " · fallback, the model call failed"}
                </span>
                <p className="text-body text-ink">{row.body}</p>
              </li>
            ))}
          </ul>
        ))}

      <p className="text-body-sm text-muted">
        Or write one from invented facts, to see the tone without a real learner&rsquo;s week on
        this screen:
      </p>

      <div className="flex gap-md flex-wrap">
        {(["en", "hi"] as const).map((locale) => (
          <Button
            key={locale}
            variant="secondary"
            className="grow-0 w-auto px-lg"
            loading={busy === locale}
            onClick={() => generate(locale)}
          >
            {locale === "en" ? "Write one in English" : "Write one in Hindi"}
          </Button>
        ))}
      </div>

      {(["en", "hi"] as const).map((locale) =>
        out[locale] ? (
          <div key={locale} className="flex flex-col gap-xs">
            <p className="text-caption text-muted">
              {locale === "en" ? "English" : "Hindi"}
              {/* Stated, never hidden: "fallback" means the model call failed
                  and the deterministic sentence stood in. A preview that showed
                  that silently would prove the opposite of what it claims. */}
              {out[locale].source === "fallback" && " · fallback, the model call failed"}
            </p>
            <p className="rounded-(--radius-card) border border-border bg-surface px-lg py-md text-body text-ink">
              {out[locale].body}
            </p>
          </div>
        ) : null,
      )}
    </div>
  );
}
