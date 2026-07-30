import { cn } from "@/lib/cn";

/**
 * Badge — mastery bands (D5) and feedback states.
 *
 * Two rules baked in:
 *   - "Not quite" is AMBER, never red. Red is for system errors only.
 *   - Use the friendly label, never the database enum. `needs_revision` is a
 *     column value; "Keep practising" is what a learner reads.
 */

type Tone =
  | "mastered"
  | "developing"
  | "needs_revision"
  | "correct"
  | "not_quite"
  | "hint"
  | "neutral";

const TONES: Record<Tone, string> = {
  mastered: "bg-correct-soft text-correct border-correct/30",
  developing: "bg-primary-wash text-hint border-hint/30",
  needs_revision: "bg-notquite-soft text-notquite border-notquite/30",
  correct: "bg-correct-soft text-correct border-correct/30",
  not_quite: "bg-notquite-soft text-notquite border-notquite/30",
  hint: "bg-surface text-hint border-hint/30",
  neutral: "bg-surface text-body border-border",
};

/**
 * Mastery labels live in the message dictionary under `mastery.*`, keyed by the
 * same enum values — `t("mastery.needs_revision")` → "Keep practising" /
 * "और प्रैक्टिस करो".
 *
 * They were briefly a constant in this file. That constant was an English-only
 * dictionary: it would have rendered "Mastered" to a Hindi learner on a screen
 * where everything else was in Hindi. Do not reintroduce it — a component never
 * carries copy.
 */

export function Badge({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: Tone;
  /** Colour is never the only signal (rule 10) — pair it with an icon. */
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-xs",
        "px-md py-xs rounded-full border",
        "text-caption font-medium",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
