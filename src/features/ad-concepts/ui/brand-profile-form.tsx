"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveBrandProfileAction } from "@/features/ad-concepts/application/save-brand-profile";
import { initialActionState } from "@/features/ad-concepts/application/types";
import type { BrandProfile } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export function BrandProfileForm({
  profile,
}: {
  profile: BrandProfile | null;
}) {
  const [state, formAction, isPending] = useActionState(
    saveBrandProfileAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state.status === "success" && state.message && (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brandName">Brand name</Label>
        <Input
          id="brandName"
          name="brandName"
          defaultValue={profile?.brand_name}
          required
          aria-invalid={Boolean(state.fieldErrors?.brandName)}
        />
        {state.fieldErrors?.brandName && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.brandName[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="industry">Industry</Label>
        <Input
          id="industry"
          name="industry"
          defaultValue={profile?.industry}
          required
          aria-invalid={Boolean(state.fieldErrors?.industry)}
        />
        {state.fieldErrors?.industry && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.industry[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tone">Tone of voice</Label>
        <Input
          id="tone"
          name="tone"
          placeholder="Playful, confident, minimalist..."
          defaultValue={profile?.tone}
          required
          aria-invalid={Boolean(state.fieldErrors?.tone)}
        />
        {state.fieldErrors?.tone && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.tone[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="targetAudience">Target audience</Label>
        <Textarea
          id="targetAudience"
          name="targetAudience"
          defaultValue={profile?.target_audience}
          required
          aria-invalid={Boolean(state.fieldErrors?.targetAudience)}
        />
        {state.fieldErrors?.targetAudience && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.targetAudience[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="uniqueSellingPoints">Unique selling points</Label>
        <Textarea
          id="uniqueSellingPoints"
          name="uniqueSellingPoints"
          defaultValue={profile?.unique_selling_points}
          required
          aria-invalid={Boolean(state.fieldErrors?.uniqueSellingPoints)}
        />
        {state.fieldErrors?.uniqueSellingPoints && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.uniqueSellingPoints[0]}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Saving..." : "Save brand profile"}
      </Button>
    </form>
  );
}
