"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { generateConceptsAction } from "@/features/ad-concepts/application/generate-concepts";
import { initialActionState } from "@/features/ad-concepts/application/types";
import type { InspirationOption } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export function GenerateConceptsForm({
  inspirationOptions,
}: {
  inspirationOptions: InspirationOption[];
}) {
  const [state, formAction, isPending] = useActionState(
    generateConceptsAction,
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
        <Label htmlFor="brief">Campaign brief</Label>
        <Textarea
          id="brief"
          name="brief"
          placeholder="Promote our new summer collection to first-time buyers…"
          required
          aria-invalid={Boolean(state.fieldErrors?.brief)}
        />
        {state.fieldErrors?.brief && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.brief[0]}
          </p>
        )}
      </div>

      {inspirationOptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inspirationAdId">
            Inspiration (optional) — take a different angle than
          </Label>
          <Select name="inspirationAdId">
            <SelectTrigger id="inspirationAdId" className="w-full">
              <SelectValue placeholder="None — generate from brief only" />
            </SelectTrigger>
            <SelectContent>
              {inspirationOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.competitorName} — {option.messagingAngle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Generating…" : "Generate 3 concepts"}
      </Button>
    </form>
  );
}
