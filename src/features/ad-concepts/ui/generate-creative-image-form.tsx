"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateCreativeImageAction } from "@/features/ad-concepts/application/generate-creative-image";
import { initialActionState } from "@/features/ad-concepts/application/types";

export function GenerateCreativeImageForm({
  conceptId,
  hasImage,
  productImageUrl,
}: {
  conceptId: string;
  hasImage: boolean;
  productImageUrl?: string | null;
}) {
  const generateWithId = generateCreativeImageAction.bind(null, conceptId);
  const [state, formAction, isPending] = useActionState(
    generateWithId,
    initialActionState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <Input
        name="productImageUrl"
        type="url"
        placeholder="Product photo URL (optional — Shopify CDN)"
        defaultValue={productImageUrl ?? ""}
        aria-invalid={Boolean(state.fieldErrors?.productImageUrl)}
      />
      {state.fieldErrors?.productImageUrl && (
        <p className="text-sm text-destructive">
          {state.fieldErrors.productImageUrl[0]}
        </p>
      )}
      <Button
        type="submit"
        disabled={isPending}
        size="sm"
        variant="outline"
        className="self-start"
      >
        {isPending
          ? "Generating... (up to a minute)"
          : hasImage
            ? "Regenerate Image"
            : "Generate Image"}
      </Button>
    </form>
  );
}
