import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The standard working surface: charcoal panel, thin border, no shadow.
 *
 * Deliberately not built on `Card` — `Card` carries its own padding and gap
 * rhythm suited to small repeated items, whereas panels host dense page-level
 * content and need to control their own interior. Both share the same tokens,
 * so they stay visually consistent.
 */
export function DarkPanel({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <section
      className={cn("rounded-xl border border-border bg-card", className)}
    >
      {hasHeader && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title && (
              <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>
      )}
      {children && (
        <div className={cn("p-4", contentClassName)}>{children}</div>
      )}
    </section>
  );
}
