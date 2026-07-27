import { cn } from "@/lib/utils";
import { WorkspaceSelector } from "@/components/shell/workspace-selector";

/**
 * Sidebar header: product identity above the active workspace selector.
 */
export function WorkspaceIdentity({
  brandName,
  className,
}: {
  brandName: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b border-sidebar-border px-3 py-2.5",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded bg-sidebar-primary text-[10px] font-bold text-sidebar-primary-foreground"
        >
          BA
        </span>
        <span className="truncate text-[13px] font-semibold tracking-tight">
          Branded Ad Factory
        </span>
      </div>

      <WorkspaceSelector brandName={brandName} />
    </div>
  );
}
