"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { hrefFor, type NavLeaf } from "@/components/shell/nav-config";

/**
 * Dashboard matches exactly — every dashboard path starts with "/dashboard", so
 * a prefix match would leave it permanently highlighted. Everything else uses a
 * prefix match so nested routes (e.g. /dashboard/competitors/[id]) keep their
 * parent lit.
 */
export function isHrefActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarItem({
  item,
  nested = false,
  onNavigate,
}: {
  item: NavLeaf;
  /** Child of a group: indented, no icon, smaller type. */
  nested?: boolean;
  /** Lets the mobile drawer close itself when a link is followed. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const href = hrefFor(item);
  const active = isHrefActive(pathname, href);
  const Icon = item.icon;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2 rounded-md transition-colors",
        "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
        // Dense by intent: the full tree is ~38 rows and has to be scannable
        // without scrolling, so rows sit close to the minimum comfortable height.
        // Line-height is pinned explicitly — inherited `normal` leading added
        // ~4px to every row, which compounds badly over 38 of them.
        nested
          ? "py-[3px] pr-2 pl-[30px] text-[12.5px] leading-[15px]"
          : "mt-1 px-2 py-[3px] text-[13px] leading-4 font-medium",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      {/* Purple rail on the active item — the one place the accent appears in
          navigation, so the current location is unambiguous at a glance. */}
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-sidebar-primary transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      {Icon && (
        <Icon
          aria-hidden
          className={cn(
            "size-3.5 shrink-0",
            active ? "text-sidebar-primary" : "text-muted-foreground",
          )}
        />
      )}
      <span className="truncate">{item.label}</span>
      {/* Borderless: at ~30 unbuilt modules, outlined badges dominated the
          sidebar. Muted uppercase carries the same meaning far more quietly. */}
      {item.status === "soon" && (
        <span className="ml-auto shrink-0 text-[9px] leading-none font-medium tracking-[0.08em] text-muted-foreground/45 uppercase">
          Soon
        </span>
      )}
    </Link>
  );
}
