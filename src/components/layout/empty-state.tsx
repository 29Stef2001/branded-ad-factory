import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "This exists but has no data yet", with a way out of it where one applies.
 * Every empty state should tell the user what to do next rather than just
 * reporting the absence.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon aria-hidden className="size-4.5" />
        </span>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
