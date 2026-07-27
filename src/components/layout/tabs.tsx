"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type TabItem = {
  label: string;
  href: string;
  /** Marks a tab whose destination isn't built yet. */
  disabled?: boolean;
};

/**
 * Active tab is derived from the URL rather than component state, so tabs
 * survive reload and deep-linking. Both `?tab=` query tabs and nested-route
 * tabs work: the href is compared against the current path plus query.
 */
function useIsActive() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.toString()
    ? `${pathname}?${searchParams}`
    : pathname;

  return (href: string) => {
    if (href === current) return true;
    // A query-less href matches the path it points at, ignoring unrelated params.
    return !href.includes("?") && pathname === href;
  };
}

/**
 * Page-level tabs: underlined, sitting directly beneath the PageHeader.
 * Scrolls horizontally rather than wrapping, so a long tab set stays on one
 * line on tablet and mobile.
 */
export function PrimaryTabs({
  items,
  className,
  label = "Page sections",
}: {
  items: TabItem[];
  className?: string;
  label?: string;
}) {
  const isActive = useIsActive();

  return (
    <div
      className={cn("-mx-1 overflow-x-auto border-b border-border", className)}
    >
      <nav
        aria-label={label}
        className="flex min-w-max items-center gap-1 px-1"
      >
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <TabLink
              key={item.href}
              item={item}
              active={active}
              className={cn(
                "border-b-2 px-3 py-2 text-sm",
                active
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            />
          );
        })}
      </nav>
    </div>
  );
}

/**
 * Subordinate tabs for slicing content within a primary tab. Pill-shaped and
 * borderless so the two levels never read as the same control.
 */
export function SecondaryTabs({
  items,
  className,
  label = "Sub-sections",
}: {
  items: TabItem[];
  className?: string;
  label?: string;
}) {
  const isActive = useIsActive();

  return (
    <div className={cn("-mx-1 overflow-x-auto", className)}>
      <nav
        aria-label={label}
        className="flex min-w-max items-center gap-1 px-1"
      >
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <TabLink
              key={item.href}
              item={item}
              active={active}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs",
                active
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            />
          );
        })}
      </nav>
    </div>
  );
}

function TabLink({
  item,
  active,
  className,
}: {
  item: TabItem;
  active: boolean;
  className: string;
}) {
  const shared = cn(
    "shrink-0 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    className,
  );

  // A disabled tab is rendered as plain text, never a link — nothing to click
  // means nothing that looks clickable.
  if (item.disabled) {
    return (
      <span
        aria-disabled="true"
        className={cn(shared, "cursor-not-allowed opacity-50")}
      >
        {item.label}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={shared}
    >
      {item.label}
    </Link>
  );
}
