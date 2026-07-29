"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { analyzeAdAction } from "@/features/competitor-analysis/application/analyze-ad";
import { initialActionState } from "@/features/competitor-analysis/application/types";

export function AnalyzeButton({ adId }: { adId: string }) {
  const analyzeWithId = analyzeAdAction.bind(null, adId);
  const [state, formAction, isPending] = useActionState(
    analyzeWithId,
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
        {isPending ? "Analyzing…" : "Analyze"}
      </Button>
    </form>
  );
}
