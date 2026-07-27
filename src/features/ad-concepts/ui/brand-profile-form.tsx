"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveBrandProfileAction } from "@/features/ad-concepts/application/save-brand-profile";
import { initialActionState } from "@/features/ad-concepts/application/types";
import type { BrandProfile } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

const DEFAULT_SWATCH = "#888888";

export function BrandProfileForm({
  profile,
}: {
  profile: BrandProfile | null;
}) {
  const [state, formAction, isPending] = useActionState(
    saveBrandProfileAction,
    initialActionState,
  );
  const [embossStyle, setEmbossStyle] = useState(
    profile?.emboss_style ?? "none",
  );
  const [foilStyle, setFoilStyle] = useState(profile?.foil_style ?? "none");

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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="logoImageUrl">Logo URL (optional)</Label>
        <Input
          id="logoImageUrl"
          name="logoImageUrl"
          type="url"
          placeholder="Your logo image URL (Shopify CDN)"
          defaultValue={profile?.logo_image_url ?? ""}
          aria-invalid={Boolean(state.fieldErrors?.logoImageUrl)}
        />
        <p className="text-sm text-muted-foreground">
          When set, generated images composite your real logo (e.g. embossed
          inside a jewelry box) instead of inventing one.
        </p>
        {state.fieldErrors?.logoImageUrl && (
          <p className="text-sm text-destructive">
            {state.fieldErrors.logoImageUrl[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Brand colors (optional)</Label>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["brandColorsPrimary", "Primary", profile?.brand_colors?.primary],
              [
                "brandColorsSecondary",
                "Secondary",
                profile?.brand_colors?.secondary,
              ],
              ["brandColorsAccent", "Accent", profile?.brand_colors?.accent],
              [
                "brandColorsBackground",
                "Background",
                profile?.brand_colors?.background,
              ],
            ] as const
          ).map(([name, label, value]) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <input
                type="color"
                name={name}
                defaultValue={value ?? DEFAULT_SWATCH}
                className="h-9 w-9 cursor-pointer rounded-md border"
              />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="typographyNotes">Typography notes (optional)</Label>
        <Textarea
          id="typographyNotes"
          name="typographyNotes"
          placeholder="e.g. serif headlines, all-caps for CTAs"
          defaultValue={profile?.typography_notes ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="embossStyle">Emboss style</Label>
        <Select
          name="embossStyle"
          value={embossStyle}
          onValueChange={(value) => setEmbossStyle(value as string)}
        >
          <SelectTrigger id="embossStyle" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="embossed">Embossed</SelectItem>
            <SelectItem value="debossed">Debossed</SelectItem>
            <SelectItem value="engraved">Engraved</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        {embossStyle === "custom" && (
          <Textarea
            name="embossCustomNotes"
            placeholder="Describe the custom emboss treatment"
            defaultValue={profile?.emboss_custom_notes ?? ""}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="foilStyle">Foil style</Label>
        <Select
          name="foilStyle"
          value={foilStyle}
          onValueChange={(value) => setFoilStyle(value as string)}
        >
          <SelectTrigger id="foilStyle" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="copper">Copper foil</SelectItem>
            <SelectItem value="gold">Gold foil</SelectItem>
            <SelectItem value="silver">Silver foil</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        {foilStyle === "custom" && (
          <Textarea
            name="foilCustomNotes"
            placeholder="Describe the custom foil treatment"
            defaultValue={profile?.foil_custom_notes ?? ""}
          />
        )}
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Saving..." : "Save brand profile"}
      </Button>
    </form>
  );
}
