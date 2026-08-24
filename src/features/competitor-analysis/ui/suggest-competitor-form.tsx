"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suggestCompetitorAction } from "@/features/competitor-analysis/application/suggest-competitor";
import { initialActionState } from "@/features/competitor-analysis/application/types";

/**
 * Flags a possible competitor without tracking it yet.
 *
 * Separate from AddCompetitorForm on purpose: adding a competitor pulls their
 * ads immediately, a flag does not. This is for "I think this is worth
 * tracking" before anyone has confirmed the Page ID or committed to it.
 */
export function SuggestCompetitorForm() {
  const [state, formAction, isPending] = useActionState(
    suggestCompetitorAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="suggest-name">Name</Label>
        <Input
          id="suggest-name"
          name="name"
          placeholder="Acme Co."
          required
          aria-invalid={Boolean(state.fieldErrors?.name)}
        />
        {state.fieldErrors?.name && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.name[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="suggest-page-id">Meta Page ID (optional)</Label>
        <Input
          id="suggest-page-id"
          name="metaPageId"
          placeholder="123456789012345"
          aria-invalid={Boolean(state.fieldErrors?.metaPageId)}
        />
        {state.fieldErrors?.metaPageId && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.metaPageId[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="suggest-reason">Why does this look like a competitor?</Label>
        <Input
          id="suggest-reason"
          name="reason"
          placeholder="Keeps coming up in the same searches"
          required
          aria-invalid={Boolean(state.fieldErrors?.reason)}
        />
        {state.fieldErrors?.reason && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.reason[0]}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending} variant="outline" className="w-full">
        {isPending ? "Flagging…" : "Flag for review"}
      </Button>
    </form>
  );
}
