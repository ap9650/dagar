import { cn } from "@/lib/cn";

/**
 * Card — saathi-design § Cards.
 * White, 1px border, 14px radius, 16px padding. Shadow only on elevated
 * surfaces (toasts, sheets), never on a resting card.
 */
export function Card({
  className,
  raised = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { raised?: boolean }) {
  return (
    <div
      className={cn(
        "bg-background border border-border rounded-(--radius-card) p-lg",
        raised && "shadow-(--shadow-raised)",
        className,
      )}
      {...props}
    />
  );
}
