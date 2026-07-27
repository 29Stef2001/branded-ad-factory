import type { LucideIcon } from "lucide-react";

/**
 * Placeholder for a navigable module with no backend behind it yet.
 *
 * States plainly that nothing is implemented — no mock charts, no fake metrics,
 * no disabled buttons hinting at actions that do not exist. A stub that looks
 * functional is worse than an obvious one.
 */
export function ComingSoonState({
  icon: Icon,
  title,
  blurb,
}: {
  icon?: LucideIcon;
  title: string;
  blurb?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      {Icon && (
        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon aria-hidden className="size-5" />
        </span>
      )}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/70 uppercase">
          Not built yet
        </span>
        <p className="text-base font-semibold tracking-tight">{title}</p>
        {blurb && (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {blurb}
          </p>
        )}
      </div>
      <p className="max-w-md text-xs text-muted-foreground/70">
        This module has no backend behind it. Nothing on this page reads or
        writes data.
      </p>
    </div>
  );
}
