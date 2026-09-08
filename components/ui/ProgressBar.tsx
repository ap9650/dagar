import { cn } from "@/lib/cn";

/**
 * ProgressBar — dagar-design § Progress.
 *
 * "Always pair the visual with a number (`3 of 5 lessons`) — a ring alone is not
 * readable to everyone." The label is therefore required, not optional.
 */
export function ProgressBar({
  value,
  max,
  label,
  className,
}: {
  value: number;
  max: number;
  /** Human-readable, e.g. "3 of 5 lessons". Required by rule 10. */
  label: string;
  className?: string;
}) {
  const safeMax = Math.max(1, max);
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));

  return (
    <div className={cn("flex flex-col gap-sm", className)}>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={label}
        className="h-2 w-full rounded-full bg-surface overflow-hidden"
      >
        <div
          className="h-full bg-primary rounded-full transition-[width] duration-150 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-caption text-muted">{label}</span>
    </div>
  );
}
