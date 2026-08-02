"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Vibrate } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { haptic, hapticsEnabled, hapticsSupported, setHapticsEnabled } from "@/lib/haptics";

/**
 * Turn the buzz off.
 *
 * **Renders its own heading**, so that on a device where haptics cannot work the
 * whole block disappears — heading included. A section title with nothing under
 * it is the specific way this kind of thing usually breaks.
 *
 * Absent, not disabled: on an iPhone (no Vibration API — Apple has never shipped
 * it) and under `prefers-reduced-motion`, there is nothing here. A toggle that
 * visibly does nothing when pressed tells a learner the app is broken rather
 * than that the feature is unavailable.
 *
 * Turning it ON buzzes once, immediately. A haptics setting you cannot feel
 * while setting it is a guess.
 *
 * ── WHY useSyncExternalStore ────────────────────────────────────────────────
 * `localStorage`, `matchMedia` and `navigator.vibrate` are all browser state
 * that does not exist during the server render, and this repo bans setState in
 * an effect for exactly that reason. Same pattern as `components/install/store`.
 * ────────────────────────────────────────────────────────────────────────────
 */

type Snapshot = { on: boolean; supported: boolean };

const SERVER_SNAPSHOT: Snapshot = { on: false, supported: false };

let snapshot: Snapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function read(): Snapshot {
  return { on: hapticsEnabled(), supported: hapticsSupported() };
}

function refresh() {
  const next = read();
  if (next.on === snapshot.on && next.supported === snapshot.supported) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => SERVER_SNAPSHOT;

export function HapticsToggle() {
  const t = useTranslations("settings");
  const { on, supported } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    refresh();
  }, []);

  if (!supported) return null;

  function toggle() {
    const next = !on;
    setHapticsEnabled(next);
    refresh();
    if (next) haptic("correct");
  }

  return (
    <section className="flex flex-col gap-md">
      <h2 className="text-label text-muted">{t("hapticsTitle")}</h2>
      <Card className="flex items-center gap-md">
        <Vibrate size={20} strokeWidth={1.75} aria-hidden className="text-primary shrink-0" />
        <span className="text-body text-ink flex-1">{t("hapticsLabel")}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={t("hapticsLabel")}
          onClick={toggle}
          className={cn(
            "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full",
            "transition-colors duration-150 ease-out",
            "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
            on ? "bg-primary" : "bg-border-strong",
          )}
        >
          <span
            className={cn(
              "inline-block size-6 rounded-full bg-background",
              "transition-transform duration-150 ease-out",
              on ? "translate-x-7" : "translate-x-1",
            )}
          />
        </button>
      </Card>
    </section>
  );
}
