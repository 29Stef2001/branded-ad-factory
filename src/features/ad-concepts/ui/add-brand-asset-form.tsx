"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrandAssetAction } from "@/features/ad-concepts/application/manage-brand-assets";
import { initialActionState } from "@/features/ad-concepts/application/types";
import { ACCEPT_ATTRIBUTE } from "@/features/ad-concepts/domain/asset-upload";
import type { BrandAssetType } from "@/features/ad-concepts/domain/schemas";

type Source = "upload" | "url";

export function AddBrandAssetForm({
  assetType,
  typeLabel,
}: {
  assetType: BrandAssetType;
  typeLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createBrandAssetAction,
    initialActionState,
  );
  const [source, setSource] = useState<Source>("upload");
  const formRef = useRef<HTMLFormElement>(null);

  // Clearing on success stops the previous asset's label and file sitting in
  // the inputs while its row is already rendered above. Done in an effect
  // rather than during render: touching a ref while rendering is exactly the
  // read React warns about.
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  const fieldId = `add-${assetType}`;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3"
    >
      <input type="hidden" name="assetType" value={assetType} />

      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state.status === "success" && state.message && (
        <p className="text-sm text-success">{state.message}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Add {typeLabel.toLowerCase()}:
        </span>
        {(["upload", "url"] as const).map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={source === option ? "secondary" : "ghost"}
            onClick={() => setSource(option)}
          >
            {option === "upload" ? "Upload file" : "Paste URL"}
          </Button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor={`${fieldId}-source`} className="text-xs">
            {source === "upload" ? "Image file" : "Image URL"}
          </Label>
          {source === "upload" ? (
            <Input
              id={`${fieldId}-source`}
              name="imageFile"
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              aria-invalid={Boolean(state.fieldErrors?.imageFile)}
            />
          ) : (
            <Input
              id={`${fieldId}-source`}
              name="imageUrl"
              type="url"
              placeholder="https://cdn.shopify.com/..."
              aria-invalid={Boolean(state.fieldErrors?.imageUrl)}
            />
          )}
          {(state.fieldErrors?.imageFile || state.fieldErrors?.imageUrl) && (
            <p className="text-sm text-destructive">
              {state.fieldErrors.imageFile?.[0] ??
                state.fieldErrors.imageUrl?.[0]}
            </p>
          )}
        </div>

        <Input name="label" placeholder="Label (optional)" />
        <div className="grid grid-cols-2 gap-2">
          <Input name="region" placeholder="Region" />
          <Input name="season" placeholder="Season" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="isPrimary"
            className="size-3.5 accent-[var(--primary)]"
          />
          Set as primary for this type
        </label>
        <Button type="submit" disabled={isPending} size="sm" variant="outline">
          {isPending ? "Adding…" : "Add asset"}
        </Button>
      </div>
    </form>
  );
}
