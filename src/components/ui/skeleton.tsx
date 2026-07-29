import { cn } from "@/lib/utils";

/**
 * A placeholder block for content that is still loading.
 *
 * Shaped like what it replaces rather than a generic spinner: a page that
 * resolves into the same layout it was showing does not appear to jump, and the
 * user can start reading the structure before the data lands.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
    />
  );
}
