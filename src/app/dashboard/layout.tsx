import Link from "next/link";
import { LogoutButton } from "@/features/auth/ui/logout-button";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-lg font-semibold tracking-tight"
          >
            Branded Ad Factory
          </Link>
          <Link
            href="/dashboard/competitors"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Competitors
          </Link>
          <Link
            href="/dashboard/concepts"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Concepts
          </Link>
        </div>
        <LogoutButton />
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
