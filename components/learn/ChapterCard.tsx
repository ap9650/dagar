import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * One chapter, on the learner's home screen.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * `/learn` used to render `chapters[0]` and silently discard the rest. With one
 * chapter per class that was invisible; the day a second chapter was seeded,
 * half the curriculum became unreachable — a Class 7 learner could not open an
 * Integers lesson at all, because no route rendered a link to one.
 *
 * So the home screen lists every chapter, and this is the row.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ── DESIGN ──────────────────────────────────────────────────────────────────
 * Compact on purpose. At two chapters an expanded journey path each would look
 * generous; at eight it is a wall, and NCERT runs to a dozen chapters a class.
 * A card is title + progress + one state, roughly 110px, so eight of them is
 * one comfortable scroll and the list never needs paging.
 *
 * **The whole card is the target**, not a small "Open" link — a design-system
 * rule, and the difference between a thumb-sized hit area and a fiddly one.
 *
 * **Recommended is marked, never enforced.** The next-action card above is the
 * single loud "do this now", so this only gets a quiet border and a word. And
 * nothing is locked: the teacher this app was built for is teaching Class 6
 * chapter 4 and Class 7 chapter 6 — not in sequence. A learner told to open
 * chapter 6 must be able to open chapter 6. Recommend an order; never impose
 * one.
 */
export async function ChapterCard({
  href,
  title,
  done,
  total,
  recommended = false,
}: {
  href: string;
  title: string;
  done: number;
  total: number;
  /** True for the one chapter the next action lives in. At most one per screen. */
  recommended?: boolean;
}) {
  const t = await getTranslations();

  const finished = total > 0 && done === total;
  const started = done > 0;

  return (
    <Link
      href={href}
      aria-current={recommended ? "step" : undefined}
      className={`flex items-center gap-md rounded-(--radius-card) border px-lg py-md
                  transition-colors duration-150 ease-out
                  focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2
                  ${
                    recommended
                      ? "border-primary bg-primary-wash"
                      : "border-border bg-background hover:bg-surface"
                  }`}
    >
      <div className="flex flex-col gap-xs min-w-0 flex-1">
        <div className="flex items-center gap-sm min-w-0">
          <h3 className="text-h3 text-ink min-w-0">{title}</h3>
          {/* Colour is never the only signal (D10) — the tick carries the same
              meaning as the filled bar for anyone who cannot separate them. */}
          {finished && (
            <Check size={18} strokeWidth={2.5} aria-hidden className="text-correct shrink-0" />
          )}
        </div>

        <p className="text-body-sm text-muted">
          {t("dashboard.lessonsProgress", { done, total })}
        </p>

        {/* Paired with the count above, never standing alone — a bar on its own
            is not readable to everyone (dagar-design § Progress). */}
        <div className="h-1.5 rounded-full bg-surface overflow-hidden" aria-hidden>
          <div
            className={`h-full rounded-full ${finished ? "bg-correct" : "bg-primary"}`}
            style={{ width: total > 0 ? `${(done / total) * 100}%` : "0%" }}
          />
        </div>

        {recommended && (
          <p className="text-label text-primary-strong">
            {started ? t("dashboard.continueLesson") : t("dashboard.startHere")}
          </p>
        )}
      </div>

      <ChevronRight
        size={20}
        strokeWidth={1.75}
        aria-hidden
        className="text-muted shrink-0 rtl:rotate-180"
      />
    </Link>
  );
}
