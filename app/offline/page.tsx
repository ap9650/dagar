import { getTranslations } from "next-intl/server";
import { WifiOff } from "lucide-react";
import { RetryButton } from "@/components/RetryButton";

/**
 * `/offline` — precached by the service worker and shown when a navigation
 * fails.
 *
 * It exists so a lost signal produces a Saathi screen in the learner's own
 * language rather than Chrome's dinosaur. A learner on a shared phone with
 * patchy 4G meets this often; it should read as "the connection dropped", not as
 * "the app is broken".
 *
 * Rendered at build time and cached as HTML, so the locale here is whatever was
 * current when the shell was cached. That is a known limit of caching a static
 * page — the alternative is no offline page at all.
 */
export default async function OfflinePage() {
  const t = await getTranslations();

  return (
    <main className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-3xl flex flex-col items-center justify-center gap-lg text-center">
      <WifiOff size={32} strokeWidth={1.75} aria-hidden className="text-muted" />
      <h1 className="text-h2 text-ink">{t("errors.offlineTitle")}</h1>
      {/* NOT errors.offline — that one promises to save pending work, and on a
          failed navigation there is nothing pending. */}
      <p className="text-body text-body">{t("errors.offlineBody")}</p>
      <RetryButton label={t("common.tryAgain")} />
    </main>
  );
}
