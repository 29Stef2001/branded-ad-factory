import { DarkPanel } from "@/components/layout/dark-panel";
import { StatusBadge } from "@/components/data/status-badge";
import type { BrandCompleteness } from "@/features/ad-concepts/domain/brand-completeness";

function toneFor(score: number) {
  if (score >= 85) return "success" as const;
  if (score >= 55) return "warning" as const;
  return "danger" as const;
}

/**
 * Completeness as a to-do list rather than a score.
 *
 * The number alone tells nobody what to do next, so the gaps are listed
 * heaviest-first with what each one costs — the order actually worth filling
 * them in.
 */
export function BrandCompletenessPanel({
  completeness,
  compact = false,
}: {
  completeness: BrandCompleteness;
  /** Dashboard variant: score and the top gaps only. */
  compact?: boolean;
}) {
  const { score, filledCount, totalCount, gaps } = completeness;
  const shown = compact ? gaps.slice(0, 3) : gaps;

  return (
    <DarkPanel
      title="Brand completeness"
      description={`${filledCount} of ${totalCount} fields that shape generated output`}
      actions={<StatusBadge label={`${score}%`} tone={toneFor(score)} />}
      contentClassName="flex flex-col gap-3"
    >
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Brand profile completeness"
      >
        <div
          className={
            score >= 85
              ? "h-full rounded-full bg-success"
              : score >= 55
                ? "h-full rounded-full bg-warning"
                : "h-full rounded-full bg-destructive"
          }
          style={{ width: `${Math.max(score, 2)}%` }}
        />
      </div>

      {gaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Every field that influences generation is filled in.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((gap) => (
            <li key={gap.key} className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{gap.label}</span>
              <span className="text-xs text-muted-foreground">
                {gap.impact}
              </span>
            </li>
          ))}
          {compact && gaps.length > shown.length && (
            <li className="text-xs text-muted-foreground">
              + {gaps.length - shown.length} more
            </li>
          )}
        </ul>
      )}
    </DarkPanel>
  );
}
