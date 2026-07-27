"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrandAssetAction } from "@/features/ad-concepts/application/manage-brand-assets";
import { initialActionState } from "@/features/ad-concepts/application/types";
import type { BrandAssetType } from "@/features/ad-concepts/domain/schemas";

export function AddBrandAssetForm({
  assetType,
}: {
  assetType: BrandAssetType;
}) {
  const [state, formAction, isPending] = useActionState(
    createBrandAssetAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2 text-sm">
      <input type="hidden" name="assetType" value={assetType} />
      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Input
          name="label"
          placeholder="Label (optional)"
          className="w-40"
          aria-invalid={Boolean(state.fieldErrors?.label)}
        />
        <Input
          name="imageUrl"
          type="url"
          placeholder="Image URL"
          className="min-w-64 flex-1"
          required
          aria-invalid={Boolean(state.fieldErrors?.imageUrl)}
        />
        <Button type="submit" disabled={isPending} size="sm" variant="outline">
          {isPending ? "Adding..." : "Add"}
        </Button>
      </div>
      {state.fieldErrors?.imageUrl && (
        <p className="text-sm text-destructive">
          {state.fieldErrors.imageUrl[0]}
        </p>
      )}
    </form>
  );
}
