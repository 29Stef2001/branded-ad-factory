"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createApprovedMessageAction } from "@/features/ad-concepts/application/manage-approved-messages";
import { initialActionState } from "@/features/ad-concepts/application/types";

export function AddApprovedMessageForm() {
  const [state, formAction, isPending] = useActionState(
    createApprovedMessageAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Input
          name="message"
          placeholder="e.g. BUY ONE GET ONE FREE"
          className="flex-1"
          required
          aria-invalid={Boolean(state.fieldErrors?.message)}
        />
        <Button type="submit" disabled={isPending} size="sm" variant="outline">
          {isPending ? "Adding..." : "Add message"}
        </Button>
      </div>
      {state.fieldErrors?.message && (
        <p className="text-sm text-destructive">
          {state.fieldErrors.message[0]}
        </p>
      )}
    </form>
  );
}
