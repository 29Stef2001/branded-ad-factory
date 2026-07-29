import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while a dashboard page's server data resolves.
 *
 * Every page here awaits Supabase before rendering anything, so without this
 * the shell sat with an empty content area during navigation — indistinguishable
 * from a page that had finished loading and simply had nothing on it.
 *
 * One shared skeleton rather than one per route: they all open with a header
 * and a grid, and a shape that is roughly right everywhere beats an exact match
 * on one page and nothing on the rest.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  );
}
