import { SidebarNav } from "@/components/shell/sidebar-nav";
import { WorkspaceIdentity } from "@/components/shell/workspace-identity";
import { LogoutButton } from "@/features/auth/ui/logout-button";

/**
 * Desktop sidebar: fixed, full-height, and one lightness step above the page
 * background so it reads as a separate plane. Hidden below `lg`, where
 * MobileNav's drawer renders the same navigation instead.
 */
export function Sidebar({ brandName }: { brandName: string | null }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <WorkspaceIdentity brandName={brandName} />
      {/* Only the nav scrolls — identity and sign-out stay pinned. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarNav />
      </div>
      <div className="border-t border-sidebar-border px-3 py-2">
        <LogoutButton />
      </div>
    </aside>
  );
}
