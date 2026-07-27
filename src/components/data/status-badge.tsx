import { cn } from "@/lib/utils";

/**
 * Semantic tones rather than colour names, so the palette can change without
 * every call site changing with it.
 */
export type StatusTone =
  "neutral" | "accent" | "success" | "warning" | "danger" | "muted";

const TONE_STYLES: Record<StatusTone, string> = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  accent: "border-primary/30 bg-primary/15 text-primary",
  success: "border-success/30 bg-success/15 text-success",
  warning: "border-warning/30 bg-warning/15 text-warning",
  danger: "border-destructive/30 bg-destructive/15 text-destructive",
  muted: "border-border bg-transparent text-muted-foreground",
};

/**
 * Compact status pill used for agent state, connection state, and (from Phase 4)
 * Meta launch state.
 */
export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] leading-none font-medium",
        TONE_STYLES[tone],
        className,
      )}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-current opacity-80"
      />
      {label}
    </span>
  );
}
