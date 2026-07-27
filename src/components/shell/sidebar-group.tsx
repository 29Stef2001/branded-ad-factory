"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { isHrefActive, SidebarItem } from "@/components/shell/sidebar-item";
import { hrefFor, type NavGroup } from "@/components/shell/nav-config";

/**
 * A collapsible section of the sidebar.
 *
 * The group header is a toggle, not a link — groups have no page of their own,
 * and a header that navigated somewhere arbitrary would be a lie about what the
 * click does.
 *
 * Every group starts open: the whole tree is meant to be scannable at a glance,
 * with collapsing available as a per-user choice rather than the default state.
 */
export function SidebarGroup({
  group,
  onNavigate,
}: {
  group: NavGroup;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const containsActive = group.items.some((item) =>
    isHrefActive(pathname, hrefFor(item)),
  );
  const [manuallyOpen, setManuallyOpen] = useState<boolean | null>(null);
  const open = manuallyOpen ?? true;

  const Icon = group.icon;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setManuallyOpen(!open)}
        className={cn(
          "mt-1 flex w-full items-center gap-2 rounded-md px-2 py-[3px] text-[13px] leading-4 transition-colors",
          "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
          containsActive
            ? "font-medium text-sidebar-foreground"
            : "font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        )}
      >
        <Icon
          aria-hidden
          className={cn(
            "size-3.5 shrink-0",
            containsActive ? "text-sidebar-primary" : "text-muted-foreground",
          )}
        />
        <span className="truncate">{group.label}</span>
        <ChevronRight
          aria-hidden
          className={cn(
            "ml-auto size-3 shrink-0 text-muted-foreground/60 transition-transform",
            open && "rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="flex flex-col">
          {group.items.map((item) => (
            <SidebarItem
              key={item.label}
              item={item}
              nested
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
