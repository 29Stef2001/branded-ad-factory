"use client";

import { SidebarGroup } from "@/components/shell/sidebar-group";
import { SidebarItem } from "@/components/shell/sidebar-item";
import { isGroup, NAV_TREE } from "@/components/shell/nav-config";

/**
 * The full navigation tree, rendered identically in the desktop sidebar and the
 * mobile drawer so the two can never drift apart.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Dashboard" className="flex flex-col px-2 py-2">
      {NAV_TREE.map((entry) =>
        isGroup(entry) ? (
          <SidebarGroup
            key={entry.label}
            group={entry}
            onNavigate={onNavigate}
          />
        ) : (
          <SidebarItem key={entry.label} item={entry} onNavigate={onNavigate} />
        ),
      )}
    </nav>
  );
}
