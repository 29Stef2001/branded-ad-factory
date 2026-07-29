import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

/**
 * A mistyped dashboard URL, rendered inside the shell so the sidebar is still
 * there to leave by.
 *
 * This replaced a catch-all route that used to render "coming soon" pages for
 * unbuilt modules. With every navigable page now real, an unknown path is a
 * wrong turn rather than an unfinished feature, and it should say so.
 */
export default function DashboardNotFound() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Page not found" />

      <EmptyState
        icon={Compass}
        title="There's nothing at this address"
        description="The link may be out of date, or the page may have been renamed. Everything this app can do is in the sidebar."
        action={
          <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
            Back to dashboard
          </Link>
        }
      />
    </div>
  );
}
