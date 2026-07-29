import Link from "next/link";

/**
 * A URL that matches no route at all.
 *
 * Separate from the dashboard's own not-found: this one renders outside every
 * layout, because an unmatched path has no segment whose shell could wrap it.
 * The dashboard version handles notFound() calls from pages that do match —
 * a competitor id that no longer exists, for instance — and keeps the sidebar.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/70 uppercase">
        404
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The link may be out of date, or the page may have been renamed.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
