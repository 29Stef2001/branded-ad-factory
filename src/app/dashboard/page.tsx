import type { Metadata } from "next";
import { getCurrentUser } from "@/features/auth/infrastructure/auth-repository";

export const metadata: Metadata = { title: "Dashboard — Branded Ad Factory" };

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">
        Signed in as{" "}
        <span className="font-medium text-foreground">{user?.email}</span>.
      </p>
    </div>
  );
}
