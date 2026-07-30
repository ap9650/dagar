import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Input — saathi-design § Practice question.
 *
 * 48px tall, 10px radius, focus ring is 3px primary-soft on a primary border.
 *
 * Two accessibility properties that are easy to lose:
 *   - a real <label>, always. Placeholder-as-label disappears on focus.
 *   - errors are announced, and paired with text — never colour alone (rule 10).
 */

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  /** Numeric answers open a numeric keypad on mobile. */
  numeric?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, numeric, className, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-sm">
        <label htmlFor={inputId} className="text-label font-medium text-ink">
          {label}
        </label>

        <input
          ref={ref}
          id={inputId}
          inputMode={numeric ? "decimal" : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          className={cn(
            "min-h-12 w-full px-md rounded-(--radius-control)",
            "text-body text-ink bg-background",
            "border border-border-strong",
            "focus:border-primary focus:ring-[3px] focus:ring-primary-soft focus:outline-none",
            "transition-[border-color,box-shadow] duration-150 ease-out",
            error && "border-notquite",
            className,
          )}
          {...props}
        />

        {hint && !error && (
          <p id={hintId} className="text-caption text-muted">
            {hint}
          </p>
        )}

        {error && (
          // aria-live so the message is announced, not just seen.
          <p id={errorId} role="alert" className="text-caption text-notquite">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";
