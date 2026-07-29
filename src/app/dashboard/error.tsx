"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

/**
 * The dashboard's error boundary.
 *
 * Without one, a throw anywhere in a server component reached Next's default
 * screen: unstyled, outside the shell, and in production reduced to
 * "Application error: a client-side exception has occurred" with no way back.
 * Every page here calls Supabase, so this is a reachable state, not a
 * theoretical one.
 *
 * The message is deliberately not `error.message`: those are provider payloads
 * and stack traces, which tell the user nothing and can leak internals. The
 * digest is shown because it is the one thing that makes a report actionable.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard render failed", error);
  }, [error]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Something went wrong"
        description="This page could not be loaded. Nothing you have saved is affected."
      />

      <EmptyState
        icon={TriangleAlert}
        title="The page failed to load"
        description={
          error.digest
            ? `Try again — if it keeps happening, quote reference ${error.digest}.`
            : "Try again. If it keeps happening, check that the app can reach Supabase."
        }
        action={
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
