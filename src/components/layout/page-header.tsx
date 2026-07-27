import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard page masthead: eyebrow, title, optional subtitle/count, and a slot
 * for page-level actions. Left-aligned by design — this is a working console,
 * not a marketing page.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  description,
  actions,
  className,
}: {
  /** Small uppercase label above the title (e.g. a section or brand name). */
  eyebrow?: string;
  title: string;
  /** Short metadata rendered beside the title, e.g. "6 VARIANTS". */
  subtitle?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && (
          <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/70 uppercase">
            {eyebrow}
          </span>
        )}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <span className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
              {subtitle}
            </span>
          )}
        </div>
        {description && (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
