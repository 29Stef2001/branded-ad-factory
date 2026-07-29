"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { refineConceptAction } from "@/features/ad-concepts/application/refine-concept";
import { initialActionState } from "@/features/ad-concepts/application/types";

export function RefineConceptForm({ conceptId }: { conceptId: string }) {
  const refineWithId = refineConceptAction.bind(null, conceptId);
  const [state, formAction, isPending] = useActionState(
    refineWithId,
    initialActionState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Input
          name="instruction"
          placeholder="e.g. make the headline punchier"
          aria-invalid={Boolean(state.fieldErrors?.instruction)}
          required
        />
        <Button type="submit" disabled={isPending} size="sm" variant="outline">
          {isPending ? "Refining…" : "Refine"}
        </Button>
      </div>
      {state.fieldErrors?.instruction && (
        <p className="text-sm text-destructive">
          {state.fieldErrors.instruction[0]}
        </p>
      )}
    </form>
  );
}
