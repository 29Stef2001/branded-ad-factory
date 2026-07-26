import Link from "next/link";
import { LogoutButton } from "@/features/auth/ui/logout-button";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link
          href="/dashboard"
          className="text-lg font-semibold tracking-tight"
        >
          Branded Ad Factory
        </Link>
        <LogoutButton />
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
