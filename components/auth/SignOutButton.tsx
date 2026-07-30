"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

/**
 * Sign out.
 *
 * On a shared phone this is a primary path, not a rarely-used setting: the next
 * child to pick up the handset needs the previous session gone, and a parent is
 * often already signed into Google on it. The spec requires it reachable in ≤2
 * taps from any screen, which is why it appears on the grade screen too and not
 * only in Settings.
 *
 * Ghost variant — it is an exit, not a destructive action. `danger` is for
 * deletions.
 */
export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Go home even if the request failed — the cookie may already be gone, and
      // stranding someone on a screen they cannot leave is the worse outcome.
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <Button variant="ghost" onClick={signOut} loading={busy} className={className}>
      {t("settings.signOut")}
    </Button>
  );
}
