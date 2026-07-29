"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { syncNowAction } from "@/features/creative-intelligence/application/run-sync";
import { initialActionState } from "@/features/ad-concepts/application/types";

export function SyncButton() {
  const [state, action, isPending] = useActionState(
    syncNowAction,
    initialActionState,
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={action}>
        <Button type="submit" size="sm" disabled={isPending}>
          <RefreshCw aria-hidden className="size-3.5" />
          {isPending ? "Syncing…" : "Sync now"}
        </Button>
      </form>

      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state.status === "success" && state.message && (
        <p className="text-sm text-success">{state.message}</p>
      )}
    </div>
  );
}
