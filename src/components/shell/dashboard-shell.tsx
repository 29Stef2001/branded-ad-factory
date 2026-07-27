import type { ReactNode } from "react";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { WorkspaceIdentity } from "@/components/shell/workspace-identity";
import { LogoutButton } from "@/features/auth/ui/logout-button";

/**
 * The application frame every dashboard page renders inside: fixed sidebar on
 * desktop, drawer below `lg`. Pages supply only their own content — no page
 * repeats the chrome.
 */
export function DashboardShell({
  brandName,
  children,
}: {
  brandName: string | null;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar brandName={brandName} />

      {/* Matches the fixed sidebar's width so content clears it without the
          sidebar participating in layout flow. */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:hidden">
          <MobileNav
            identity={<WorkspaceIdentity brandName={brandName} />}
            footer={<LogoutButton />}
          />
          <span className="text-sm font-semibold tracking-tight">
            Branded Ad Factory
          </span>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
