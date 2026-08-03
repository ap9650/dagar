import { cn } from "@/lib/cn";

/**
 * A placeholder block, for the moment between a tap and a screen.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Every learner route here is dynamic — it reads a cookie and a session, so
 * Next cannot prerender it. The Next 16 navigation docs are explicit about what
 * that costs: *"the client must wait for the server response before showing the
 * result. This can give the users the impression that the app is not
 * responding"*, and a dynamic route is not prefetched at all unless a
 * `loading.tsx` exists to prefetch.
 *
 * Measured on production: 1.4–2.8 seconds of server time per navigation, warm.
 * For all of it, the OLD screen sat frozen with no indication that the tap had
 * registered. Reported exactly that way: *"I do not know whether I have tapped
 * it."*
 *
 * So these skeletons are not decoration. They are what makes a tap answerable
 * immediately, and — because a `loading.tsx` is what Next prefetches — they are
 * also what lets the next screen start loading before the tap happens.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Deliberately plain: blocks in `surface`, never fake words or fake numbers. A
 * skeleton that imitates content is briefly indistinguishable from content, and
 * a learner who starts reading a placeholder has been lied to.
 *
 * The pulse is `animate-pulse`, which globals.css already neutralises under
 * `prefers-reduced-motion` along with every other animation — so this needs no
 * media query of its own.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-(--radius-control) bg-surface", className)}
    />
  );
}

/**
 * The shell every learner screen shares: a back control and a title.
 *
 * Rendered at the same size as the real header so the page does not jump when
 * content arrives — a skeleton whose shape is wrong is worse than none, because
 * it moves everything the moment the learner starts reading.
 */
export function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center gap-md">
        <Skeleton className="size-11 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-8 w-3/4" />
    </div>
  );
}

/**
 * The whole screen, announced once.
 *
 * `role="status"` with a single `aria-label`, and every block inside marked
 * `aria-hidden`: a screen-reader user should hear "loading" once, not a stream
 * of nothing from fourteen empty divs.
 */
export function ScreenSkeleton({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <main
      role="status"
      aria-label={label}
      aria-live="polite"
      className="flex-1 w-full max-w-(--container-content) mx-auto px-lg py-lg flex flex-col gap-xl"
    >
      {children}
    </main>
  );
}
