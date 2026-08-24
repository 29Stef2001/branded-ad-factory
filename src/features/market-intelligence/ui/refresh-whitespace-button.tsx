"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { refreshWhitespaceAction } from "@/features/market-intelligence/application/synthesize-whitespace";
import { initialActionState } from "@/features/market-intelligence/application/types";

export function RefreshWhitespaceButton() {
  const [state, action, isPending] = useActionState(
    refreshWhitespaceAction,
    initialActionState,
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={action}>
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          <RefreshCw aria-hidden className="size-3.5" />
          {isPending ? "Refreshing…" : "Refresh market analysis"}
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
