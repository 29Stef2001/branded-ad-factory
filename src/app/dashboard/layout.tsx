import { DashboardShell } from "@/components/shell/dashboard-shell";
import { getBrandProfile } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The sidebar labels the active product workspace with the user's real brand.
  // `brand_profiles.user_id` is UNIQUE, so this is the only workspace that can
  // exist today; a selector follows once the data model supports more.
  const brandProfile = await getBrandProfile();

  return (
    <DashboardShell brandName={brandProfile?.brand_name ?? null}>
      {children}
    </DashboardShell>
  );
}
