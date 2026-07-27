"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  const letters = words
    .filter((word) => /[a-z0-9]/i.test(word[0]))
    .slice(0, 2)
    .map((word) => word[0]);
  return (letters.join("") || name.slice(0, 2)).toUpperCase();
}

/**
 * Active product workspace, at the top of the sidebar.
 *
 * UI-only by design. `brand_profiles.user_id` is UNIQUE, so exactly one
 * workspace can exist per user and there is nothing to switch to — the menu
 * says so in place of listing workspaces that don't exist. It is built as a
 * real selector so that when multi-brand scoping lands, only the data source
 * changes, not the shell.
 */
export function WorkspaceSelector({ brandName }: { brandName: string | null }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasBrand = Boolean(brandName);
  const displayName = brandName ?? "No brand profile yet";

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <span className="text-[9px] font-semibold tracking-[0.12em] text-muted-foreground/70 uppercase">
        Product Workspace
      </span>

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/60 px-2 py-1 text-left transition-colors",
          "hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-4.5 shrink-0 items-center justify-center rounded text-[9px] font-bold",
            hasBrand
              ? "bg-sidebar-primary/20 text-sidebar-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {hasBrand ? initialsOf(displayName) : "—"}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px]",
            hasBrand ? "font-medium" : "text-muted-foreground",
          )}
        >
          {displayName}
        </span>
        <ChevronsUpDown
          aria-hidden
          className="size-3 shrink-0 text-muted-foreground"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 left-0 z-40 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-lg"
        >
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate text-sm">
              {displayName}
            </span>
            {hasBrand && (
              <Check
                aria-hidden
                className="size-3.5 shrink-0 text-sidebar-primary"
              />
            )}
          </div>
          <p className="border-t border-border px-2 py-1.5 text-xs text-muted-foreground">
            {hasBrand
              ? "Switching between brands arrives with multi-workspace support."
              : "Create a brand profile in Creative Studio to name this workspace."}
          </p>
        </div>
      )}
    </div>
  );
}
