"use server";

import { revalidatePath } from "next/cache";
import { brandProfileSchema } from "@/features/ad-concepts/domain/schemas";
import { isAllowedExternalImageHost } from "@/features/ad-concepts/infrastructure/image-generation-client";
import { upsertBrandProfile } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { getCurrentUser } from "@/features/auth/infrastructure/auth-repository";
import type { ActionState } from "@/features/ad-concepts/application/types";

export async function saveBrandProfileAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const brandColors = {
    primary: formData.get("brandColorsPrimary") || undefined,
    secondary: formData.get("brandColorsSecondary") || undefined,
    accent: formData.get("brandColorsAccent") || undefined,
    background: formData.get("brandColorsBackground") || undefined,
  };
  const hasBrandColors = Object.values(brandColors).some(Boolean);

  // Every field is read by name; the schema decides which are required and
  // turns the comma-separated boxes into arrays.
  const parsed = brandProfileSchema.safeParse({
    brandName: formData.get("brandName"),
    brandCategory: formData.get("brandCategory"),
    markets: formData.get("markets") || undefined,
    languages: formData.get("languages") || undefined,
    brandStory: formData.get("brandStory") || undefined,
    brandMission: formData.get("brandMission") || undefined,

    targetAudience: formData.get("targetAudience"),
    toneAttributes: formData.get("toneAttributes") || undefined,
    toneNotes: formData.get("toneNotes") || undefined,
    writingStyle: formData.get("writingStyle") || undefined,

    visualStyle: formData.get("visualStyle") || undefined,
    photographyStyle: formData.get("photographyStyle") || undefined,
    brandColors: hasBrandColors ? brandColors : undefined,
    typographyNotes: formData.get("typographyNotes") || undefined,
    logoRules: formData.get("logoRules") || undefined,
    embossStyle: formData.get("embossStyle") || undefined,
    embossCustomNotes: formData.get("embossCustomNotes") || undefined,
    foilStyle: formData.get("foilStyle") || undefined,
    foilCustomNotes: formData.get("foilCustomNotes") || undefined,
    logoImageUrl: formData.get("logoImageUrl") || undefined,

    founderName: formData.get("founderName") || undefined,
    founderGender: formData.get("founderGender") || undefined,
    founderAge: formData.get("founderAge") || undefined,
    founderBackground: formData.get("founderBackground") || undefined,

    productPositioning: formData.get("productPositioning") || undefined,
    pricePositioning: formData.get("pricePositioning") || undefined,
    materials: formData.get("materials") || undefined,
    usps: formData.get("usps") || undefined,
    brandValues: formData.get("brandValues") || undefined,

    wordsToAlwaysUse: formData.get("wordsToAlwaysUse") || undefined,
    wordsToNeverUse: formData.get("wordsToNeverUse") || undefined,

    imageGenerationRules: formData.get("imageGenerationRules") || undefined,
    copyGenerationRules: formData.get("copyGenerationRules") || undefined,
    qaExpectations: formData.get("qaExpectations") || undefined,
    qaMinScore: formData.get("qaMinScore") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (
    parsed.data.logoImageUrl &&
    !isAllowedExternalImageHost(parsed.data.logoImageUrl)
  ) {
    return {
      status: "error",
      fieldErrors: {
        logoImageUrl: [
          "Only your configured Shopify store's asset URLs are supported",
        ],
      },
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "You must be signed in." };
  }

  await upsertBrandProfile(user.id, parsed.data);
  revalidatePath("/dashboard/concepts");

  return { status: "success", message: "Brand profile saved." };
}
