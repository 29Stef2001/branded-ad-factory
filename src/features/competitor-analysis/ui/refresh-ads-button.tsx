"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { refreshAdsAction } from "@/features/competitor-analysis/application/refresh-ads";
import { initialActionState } from "@/features/competitor-analysis/application/types";

export function RefreshAdsButton({ competitorId }: { competitorId: string }) {
  const refreshWithId = refreshAdsAction.bind(null, competitorId);
  const [state, formAction, isPending] = useActionState(
    refreshWithId,
    initialActionState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={isPending} size="sm" variant="outline">
        {isPending ? "Refreshing..." : "Refresh ads"}
      </Button>
    </form>
  );
}
