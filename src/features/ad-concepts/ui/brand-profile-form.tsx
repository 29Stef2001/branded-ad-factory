"use client";

import { useActionState, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DarkPanel } from "@/components/layout/dark-panel";
import { saveBrandProfileAction } from "@/features/ad-concepts/application/save-brand-profile";
import { initialActionState } from "@/features/ad-concepts/application/types";
import type { BrandProfile } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

type FieldErrors = Record<string, string[] | undefined> | undefined;

/**
 * One labelled control. Errors render under the field they belong to rather
 * than in a summary, so a rejected save points at what to change.
 */
function Field({
  name,
  label,
  hint,
  errors,
  children,
  className,
}: {
  name: string;
  label: string;
  hint?: string;
  errors: FieldErrors;
  children: ReactNode;
  className?: string;
}) {
  const error = errors?.[name]?.[0];
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * A plain <select>. The shared Select component is controlled, and every field
 * here is uncontrolled so the whole form can be driven by defaultValue and
 * submitted as FormData.
 */
function NativeSelect({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      id={name}
      name={name}
      defaultValue={defaultValue ?? ""}
      className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <option value="">Not set</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

const WRITING_STYLES = [
  { value: "direct_response", label: "Direct response" },
  { value: "conversational", label: "Conversational" },
  { value: "editorial", label: "Editorial" },
  { value: "minimal", label: "Minimal" },
  { value: "storytelling", label: "Storytelling" },
];

const PHOTOGRAPHY_STYLES = [
  { value: "documentary", label: "Documentary" },
  { value: "ugc", label: "UGC" },
  { value: "studio", label: "Studio" },
  { value: "editorial", label: "Editorial" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "flat_lay", label: "Flat lay" },
];

const FOUNDER_GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "unspecified", label: "Prefer not to say" },
];

const PRICE_POSITIONING = [
  { value: "budget", label: "Budget" },
  { value: "mid_market", label: "Mid-market" },
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxury" },
];

const EMBOSS_STYLES = [
  { value: "none", label: "None" },
  { value: "embossed", label: "Embossed" },
  { value: "debossed", label: "Debossed" },
  { value: "engraved", label: "Engraved" },
  { value: "custom", label: "Custom" },
];

const FOIL_STYLES = [
  { value: "none", label: "None" },
  { value: "copper", label: "Copper" },
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
  { value: "custom", label: "Custom" },
];

const list = (values: string[] | undefined) => (values ?? []).join(", ");

export function BrandProfileForm({
  profile,
}: {
  profile: BrandProfile | null;
}) {
  const [state, formAction, isPending] = useActionState(
    saveBrandProfileAction,
    initialActionState,
  );
  const errors = state.fieldErrors as FieldErrors;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state.status === "success" && state.message && (
        <p className="text-sm text-success">{state.message}</p>
      )}

      <DarkPanel
        title="Identity"
        description="Who the brand is and where it sells. Languages here decide the language of everything generated."
        contentClassName="grid gap-3 sm:grid-cols-2"
      >
        <Field name="brandName" label="Brand name *" errors={errors}>
          <Input
            id="brandName"
            name="brandName"
            defaultValue={profile?.brand_name ?? ""}
          />
        </Field>
        <Field name="brandCategory" label="Brand category *" errors={errors}>
          <Input
            id="brandCategory"
            name="brandCategory"
            defaultValue={profile?.brand_category ?? ""}
          />
        </Field>
        <Field
          name="markets"
          label="Markets"
          hint="Country codes, comma separated — e.g. US, UK"
          errors={errors}
        >
          <Input
            id="markets"
            name="markets"
            defaultValue={list(profile?.markets)}
          />
        </Field>
        <Field
          name="languages"
          label="Languages"
          hint="Language codes — e.g. en"
          errors={errors}
        >
          <Input
            id="languages"
            name="languages"
            defaultValue={list(profile?.languages)}
          />
        </Field>
        <Field
          name="brandMission"
          label="Mission"
          errors={errors}
          className="sm:col-span-2"
        >
          <Textarea
            id="brandMission"
            name="brandMission"
            rows={2}
            defaultValue={profile?.brand_mission ?? ""}
          />
        </Field>
        <Field
          name="brandStory"
          label="Brand story"
          errors={errors}
          className="sm:col-span-2"
        >
          <Textarea
            id="brandStory"
            name="brandStory"
            rows={3}
            defaultValue={profile?.brand_story ?? ""}
          />
        </Field>
      </DarkPanel>

      <DarkPanel
        title="Audience & voice"
        description="Read by concept generation and every piece of copy."
        contentClassName="grid gap-3 sm:grid-cols-2"
      >
        <Field
          name="targetAudience"
          label="Target audience *"
          errors={errors}
          className="sm:col-span-2"
        >
          <Textarea
            id="targetAudience"
            name="targetAudience"
            rows={2}
            defaultValue={profile?.target_audience ?? ""}
          />
        </Field>
        <Field
          name="toneAttributes"
          label="Tone attributes"
          hint="Comma separated — e.g. warm, honest, unhurried"
          errors={errors}
        >
          <Input
            id="toneAttributes"
            name="toneAttributes"
            defaultValue={list(profile?.tone_attributes)}
          />
        </Field>
        <Field name="writingStyle" label="Writing style" errors={errors}>
          <NativeSelect
            name="writingStyle"
            defaultValue={profile?.writing_style ?? ""}
            options={WRITING_STYLES}
          />
        </Field>
        <Field
          name="toneNotes"
          label="Tone notes"
          errors={errors}
          className="sm:col-span-2"
        >
          <Textarea
            id="toneNotes"
            name="toneNotes"
            rows={2}
            defaultValue={profile?.tone_notes ?? ""}
          />
        </Field>
      </DarkPanel>

      <DarkPanel
        title="Visual identity"
        description="Read by image generation, and by QA when it judges brand consistency."
        contentClassName="grid gap-3 sm:grid-cols-2"
      >
        <Field name="visualStyle" label="Visual style" errors={errors}>
          <Input
            id="visualStyle"
            name="visualStyle"
            defaultValue={profile?.visual_style ?? ""}
          />
        </Field>
        <Field
          name="photographyStyle"
          label="Photography style"
          errors={errors}
        >
          <NativeSelect
            name="photographyStyle"
            defaultValue={profile?.photography_style ?? ""}
            options={PHOTOGRAPHY_STYLES}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-4">
          {(["Primary", "Secondary", "Accent", "Background"] as const).map(
            (role) => {
              const key = role.toLowerCase() as keyof NonNullable<
                BrandProfile["brand_colors"]
              >;
              return (
                <Field
                  key={role}
                  name={`brandColors${role}`}
                  label={role}
                  errors={errors}
                >
                  <Input
                    id={`brandColors${role}`}
                    name={`brandColors${role}`}
                    placeholder="#B87333"
                    defaultValue={profile?.brand_colors?.[key] ?? ""}
                  />
                </Field>
              );
            },
          )}
        </div>

        <Field name="typographyNotes" label="Typography" errors={errors}>
          <Input
            id="typographyNotes"
            name="typographyNotes"
            defaultValue={profile?.typography_notes ?? ""}
          />
        </Field>
        <Field
          name="logoRules"
          label="Logo rules"
          hint="How the logo may and may not be used."
          errors={errors}
        >
          <Input
            id="logoRules"
            name="logoRules"
            defaultValue={profile?.logo_rules ?? ""}
          />
        </Field>
        <Field name="embossStyle" label="Emboss style" errors={errors}>
          <NativeSelect
            name="embossStyle"
            defaultValue={profile?.emboss_style ?? "none"}
            options={EMBOSS_STYLES}
          />
        </Field>
        <Field name="embossCustomNotes" label="Emboss notes" errors={errors}>
          <Input
            id="embossCustomNotes"
            name="embossCustomNotes"
            defaultValue={profile?.emboss_custom_notes ?? ""}
          />
        </Field>
        <Field name="foilStyle" label="Foil style" errors={errors}>
          <NativeSelect
            name="foilStyle"
            defaultValue={profile?.foil_style ?? "none"}
            options={FOIL_STYLES}
          />
        </Field>
        <Field name="foilCustomNotes" label="Foil notes" errors={errors}>
          <Input
            id="foilCustomNotes"
            name="foilCustomNotes"
            defaultValue={profile?.foil_custom_notes ?? ""}
          />
        </Field>
        <Field
          name="logoImageUrl"
          label="Logo URL (fallback)"
          hint="Only used when no logo exists in Brand Assets."
          errors={errors}
          className="sm:col-span-2"
        >
          <Input
            id="logoImageUrl"
            name="logoImageUrl"
            type="url"
            defaultValue={profile?.logo_image_url ?? ""}
          />
        </Field>
      </DarkPanel>

      <DarkPanel
        title="Founder"
        description="The real person who appears in creatives. Her photo lives in Brand Assets as an Owner / Founder asset — this is what generation knows about her before any image exists."
        contentClassName="grid gap-3 sm:grid-cols-2"
      >
        <Field name="founderName" label="Name" errors={errors}>
          <Input
            id="founderName"
            name="founderName"
            defaultValue={profile?.founder_name ?? ""}
          />
        </Field>
        <Field
          name="founderGender"
          label="Gender"
          hint="Stops generation inventing a different person."
          errors={errors}
        >
          <NativeSelect
            name="founderGender"
            defaultValue={profile?.founder_gender ?? ""}
            options={FOUNDER_GENDERS}
          />
        </Field>
        <Field name="founderAge" label="Age" errors={errors}>
          <Input
            id="founderAge"
            name="founderAge"
            type="number"
            min={16}
            max={120}
            defaultValue={profile?.founder_age ?? ""}
          />
        </Field>
        <Field
          name="founderBackground"
          label="Background"
          errors={errors}
          className="sm:col-span-2"
        >
          <Textarea
            id="founderBackground"
            name="founderBackground"
            rows={2}
            defaultValue={profile?.founder_background ?? ""}
          />
        </Field>
      </DarkPanel>

      <DarkPanel
        title="Product & positioning"
        contentClassName="grid gap-3 sm:grid-cols-2"
      >
        <Field
          name="productPositioning"
          label="Product positioning"
          errors={errors}
        >
          <Input
            id="productPositioning"
            name="productPositioning"
            defaultValue={profile?.product_positioning ?? ""}
          />
        </Field>
        <Field
          name="pricePositioning"
          label="Price positioning"
          errors={errors}
        >
          <NativeSelect
            name="pricePositioning"
            defaultValue={profile?.price_positioning ?? ""}
            options={PRICE_POSITIONING}
          />
        </Field>
        <Field
          name="materials"
          label="Materials"
          hint="Comma separated"
          errors={errors}
        >
          <Input
            id="materials"
            name="materials"
            defaultValue={list(profile?.materials)}
          />
        </Field>
        <Field
          name="brandValues"
          label="Brand values"
          hint="Comma separated"
          errors={errors}
        >
          <Input
            id="brandValues"
            name="brandValues"
            defaultValue={list(profile?.brand_values)}
          />
        </Field>
        <Field
          name="usps"
          label="Unique selling points"
          hint="One claim per line"
          errors={errors}
          className="sm:col-span-2"
        >
          <Textarea
            id="usps"
            name="usps"
            rows={4}
            defaultValue={(profile?.usps ?? []).join("\n")}
          />
        </Field>
      </DarkPanel>

      <DarkPanel
        title="Language rules"
        description="Applied to every piece of generated copy."
        contentClassName="grid gap-3 sm:grid-cols-2"
      >
        <Field
          name="wordsToAlwaysUse"
          label="Words to always use"
          hint="Comma separated"
          errors={errors}
        >
          <Input
            id="wordsToAlwaysUse"
            name="wordsToAlwaysUse"
            defaultValue={list(profile?.words_to_always_use)}
          />
        </Field>
        <Field
          name="wordsToNeverUse"
          label="Words to never use"
          hint="Comma separated"
          errors={errors}
        >
          <Input
            id="wordsToNeverUse"
            name="wordsToNeverUse"
            defaultValue={list(profile?.words_to_never_use)}
          />
        </Field>
      </DarkPanel>

      <DarkPanel
        title="Generation & QA rules"
        description="House rules handed to each module, plus the QA bar this brand is held to."
        contentClassName="grid gap-3 sm:grid-cols-2"
      >
        <Field
          name="copyGenerationRules"
          label="Copy rules"
          errors={errors}
          className="sm:col-span-2"
        >
          <Textarea
            id="copyGenerationRules"
            name="copyGenerationRules"
            rows={2}
            defaultValue={profile?.copy_generation_rules ?? ""}
          />
        </Field>
        <Field
          name="imageGenerationRules"
          label="Image rules"
          errors={errors}
          className="sm:col-span-2"
        >
          <Textarea
            id="imageGenerationRules"
            name="imageGenerationRules"
            rows={2}
            defaultValue={profile?.image_generation_rules ?? ""}
          />
        </Field>
        <Field name="qaExpectations" label="QA expectations" errors={errors}>
          <Textarea
            id="qaExpectations"
            name="qaExpectations"
            rows={2}
            defaultValue={profile?.qa_expectations ?? ""}
          />
        </Field>
        <Field
          name="qaMinScore"
          label="QA minimum score"
          hint="0-10. Blank uses the default of 7."
          errors={errors}
        >
          <Input
            id="qaMinScore"
            name="qaMinScore"
            type="number"
            min={0}
            max={10}
            step={0.5}
            defaultValue={profile?.qa_min_score ?? ""}
          />
        </Field>
      </DarkPanel>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Saving…" : "Save brand profile"}
      </Button>
    </form>
  );
}
