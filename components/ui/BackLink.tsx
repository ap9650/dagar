import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The back control, in one place.
 *
 * ── WHY A COMPONENT FOR ONE ANCHOR ──────────────────────────────────────────
 * Seven screens each had their own copy of this markup, and every one of them
 * carried `hover:bg-surface` and nothing else. **A phone has no hover.** So on
 * the device this product is designed for, tapping back changed precisely
 * nothing on screen — and with a ~2s server response behind it, the app looked
 * like it had ignored the tap. Reported exactly that way: *"I do not know
 * whether I have tapped it."*
 *
 * Seven copies is why it was missing in seven places. One component is why it
 * cannot be missing again.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The press is a fill AND a shrink: colour alone is never the only signal
 * (design rule 10), and on a cheap LCD in daylight a 10% background change can
 * be genuinely invisible while the movement still reads.
 *
 * `-webkit-tap-highlight-color: transparent` removes the browser's own grey
 * flash — not to have no feedback, but so it does not fight ours. It is only
 * ever set alongside an `active:` state.
 */
export function BackLink({
  href,
  label,
  className,
}: {
  href: string;
  /** Already translated. The control is an icon, so this is its only name. */
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        // 44px is the minimum touch target (D10), and this one is reached with
        // a thumb at the top of the screen, which is the worst case.
        "inline-flex items-center justify-center size-11 shrink-0 -ms-sm",
        "rounded-(--radius-control) text-body",
        "transition-[background-color,transform] duration-150 ease-out",
        "motion-reduce:transition-none",
        "hover:bg-surface",
        "active:bg-primary-soft active:text-primary-strong active:scale-90",
        "[-webkit-tap-highlight-color:transparent]",
        className,
      )}
    >
      <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
    </Link>
  );
}
