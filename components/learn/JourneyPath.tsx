import Link from "next/link";
import { Check, Play } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/cn";

export type JourneyNode = {
  lessonId: string;
  title: string;
  state: "completed" | "current" | "upcoming";
  href: string;
};

/**
 * The journey path (D17) — **a path, not a list.**
 *
 * "Progress you can see beats a progress percentage." A learner who can see three
 * filled nodes behind them and one ringed node in front of them knows where they
 * are without reading a number. It is almost entirely CSS on data we already have.
 *
 * Node states carry a NON-COLOUR signal as well as a colour (design rule 10):
 *   completed → filled primary, check
 *   current   → larger, ringed, play
 *   upcoming  → outlined, the lesson number
 *
 * Every node is a link, so the whole path is keyboard-navigable for free, and
 * upcoming nodes are NOT disabled — nothing here is gated (D17).
 *
 * ── why the upcoming node shows a NUMBER and not a padlock ──────────────────
 * It was a padlock, with a comment explaining that it meant "you have not got
 * here yet" rather than "you may not". That distinction lived in the comment and
 * nowhere else. A padlock has one meaning to everyone who has ever used
 * software: this is closed to you. Nobody clicks a padlock to find out it opens.
 *
 * So the icon enforced, in the learner's head, exactly the gating D17 rejects —
 * and it is the specific Duolingo mechanic design rule 12 names as inverting for
 * a learner who is already behind. Being told you have not unlocked lesson 4 is
 * a small punishment for being at lesson 3.
 *
 * The number carries the same "not yet" information, adds which lesson it is,
 * and forbids nothing.
 * ────────────────────────────────────────────────────────────────────────────
 */
export async function JourneyPath({ nodes }: { nodes: JourneyNode[] }) {
  const t = await getTranslations("chapter");

  return (
    <ol className="flex flex-col">
      {nodes.map((node, index) => {
        const isLast = index === nodes.length - 1;
        const current = node.state === "current";

        return (
          <li key={node.lessonId} className="flex gap-lg">
            {/* Rail: the marker plus the connector down to the next node. */}
            <div className="flex flex-col items-center shrink-0">
              <span
                aria-hidden
                className={cn(
                  "flex items-center justify-center rounded-full transition-colors duration-150 ease-out",
                  current
                    ? "size-11 bg-primary text-white ring-4 ring-primary-soft"
                    : node.state === "completed"
                      ? "size-9 bg-primary text-white"
                      : "size-9 border-2 border-border text-muted bg-background",
                )}
              >
                {node.state === "completed" ? (
                  <Check size={18} strokeWidth={2.5} />
                ) : current ? (
                  <Play size={18} strokeWidth={2.5} />
                ) : (
                  <span className="text-label tabular-nums">{index + 1}</span>
                )}
              </span>

              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    "w-0.5 flex-1 min-h-6",
                    node.state === "completed" ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>

            <Link
              href={node.href}
              // 44px minimum target, and the whole row is the target — not a small
              // "Open" link at the end of it.
              className={cn(
                "flex-1 min-h-11 flex flex-col justify-center gap-xs pb-xl",
                "rounded-(--radius-control) focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
              )}
            >
              <span className="text-caption text-muted">
                {t("lessonNode", { number: index + 1 })}
              </span>
              {/* No truncation: a long Hindi title wraps to two lines rather than
                  clipping mid-word (spec §7). */}
              <span
                className={cn(
                  "text-body",
                  current ? "text-ink font-medium" : "text-body",
                )}
              >
                {node.title}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
