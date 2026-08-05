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

export function SummaryPreview() {
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<Record<string, { body: string; source: string }>>({});

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

  return (
    <div className="flex flex-col gap-lg">
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
