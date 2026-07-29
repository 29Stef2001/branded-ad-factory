"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addCompetitorAction } from "@/features/competitor-analysis/application/add-competitor";
import { initialActionState } from "@/features/competitor-analysis/application/types";

export function AddCompetitorForm() {
  const [state, formAction, isPending] = useActionState(
    addCompetitorAction,
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
        <Label htmlFor="name">Competitor name</Label>
        <Input
          id="name"
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
        <Label htmlFor="metaPageId">Meta Page ID</Label>
        <Input
          id="metaPageId"
          name="metaPageId"
          placeholder="123456789012345"
          required
          aria-invalid={Boolean(state.fieldErrors?.metaPageId)}
        />
        <p className="text-sm text-muted-foreground">
          The numeric ID of their Facebook Page — found in the Page&apos;s
          &quot;About&quot; section or its URL.
        </p>
        {state.fieldErrors?.metaPageId && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.metaPageId[0]}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Fetching ads…" : "Add competitor"}
      </Button>
    </form>
  );
}
