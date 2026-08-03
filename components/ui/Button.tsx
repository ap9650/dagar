import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Button — saathi-design § Buttons.
 *
 * 48px tall, full-width by default on mobile for primary actions. Minimum touch
 * target 44x44px everywhere, including icon buttons.
 *
 * ── WHY IT HAS A BOTTOM EDGE ────────────────────────────────────────────────
 * The single most recognisable thing about the apps this audience already uses
 * is that the buttons look pressable and then actually compress under a thumb.
 * A flat rectangle is a surface; a button with a solid edge beneath it is an
 * object, and an 11-year-old reads the difference instantly.
 *
 * It costs one box-shadow and no new colour: the edge is `primary-strong`,
 * which the design system already defines as the pressed state. On `:active`
 * the button moves down by exactly the edge height and the edge disappears, so
 * the travel is real rather than decorative.
 *
 * The movement is a 4px transform on press. It is an affordance rather than an
 * animation — nothing moves unless a finger is on it — but the TRANSITION is
 * still dropped under `prefers-reduced-motion`, so the state change becomes a
 * cut instead of a slide.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";

/** The solid edge under each variant. Always a colour the system already owns. */
const EDGE: Record<Variant, string> = {
  primary: "shadow-[0_4px_0_0_var(--color-primary-strong)]",
  secondary: "shadow-[0_4px_0_0_var(--color-primary)]",
  // A ghost button is deliberately flat. It is the quiet option — Back, Cancel —
  // and giving it the same physical weight as the primary action would make the
  // two compete for the same thumb.
  ghost: "",
  // Flat too, and not for want of a darker red. A destructive button should not
  // look inviting to press. Making "delete" the most satisfying object on the
  // screen is a design that gets things deleted.
  danger: "",
};

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-strong",
  secondary: "bg-primary-soft text-primary-strong hover:brightness-95",
  ghost:
    "bg-transparent text-body border border-border hover:bg-surface active:bg-surface",
  // Destructive only, and rare. A wrong ANSWER is never danger — that is amber.
  danger: "bg-error text-white hover:brightness-110 active:brightness-95",
};

/**
 * The button's look, without the `<button>`.
 *
 * Needed because some actions must be a real navigation rather than a click
 * handler — `/api/auth/google` answers with a redirect to Google, so it has to be
 * an `<a>` the browser follows. Rather than a second set of button styles
 * drifting out of sync, both share this.
 */
export function buttonClasses(
  variant: Variant = "primary",
  fullWidth = true,
  className?: string,
) {
  return cn(
    "inline-flex items-center justify-center gap-sm",
    "min-h-12 min-w-11 px-lg rounded-(--radius-control)",
    "text-label font-medium",
    "transition-[background-color,filter,transform,box-shadow] duration-150 ease-out",
    "motion-reduce:transition-none",
    // Press: travel exactly the height of the edge, and lose the edge. Anything
    // less and the button looks like it wobbled rather than went down.
    EDGE[variant] && "active:translate-y-[4px] active:shadow-none",
    // A disabled button must not look pressable. Losing the edge is what says
    // "this is not a thing you can push" without relying on opacity alone.
    "disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none",
    EDGE[variant],
    VARIANTS[variant],
    fullWidth ? "w-full" : "w-auto",
    className,
  );
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      fullWidth = true,
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, fullWidth, className)}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
