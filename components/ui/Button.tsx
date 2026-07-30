import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Button — saathi-design § Buttons.
 *
 * 48px tall, 10px radius, full-width by default on mobile for primary actions.
 * Minimum touch target 44x44px everywhere, including icon buttons.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-strong active:bg-primary-strong",
  secondary:
    "bg-primary-soft text-primary-strong hover:brightness-95 active:brightness-90",
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
    "transition-[background-color,filter] duration-150 ease-out",
    "disabled:opacity-50 disabled:pointer-events-none",
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
