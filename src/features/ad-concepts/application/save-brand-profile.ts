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

  const parsed = brandProfileSchema.safeParse({
    brandName: formData.get("brandName"),
    industry: formData.get("industry"),
    tone: formData.get("tone"),
    targetAudience: formData.get("targetAudience"),
    uniqueSellingPoints: formData.get("uniqueSellingPoints"),
    logoImageUrl: formData.get("logoImageUrl") || undefined,
    brandColors: hasBrandColors ? brandColors : undefined,
    typographyNotes: formData.get("typographyNotes") || undefined,
    embossStyle: formData.get("embossStyle") || undefined,
    embossCustomNotes: formData.get("embossCustomNotes") || undefined,
    foilStyle: formData.get("foilStyle") || undefined,
    foilCustomNotes: formData.get("foilCustomNotes") || undefined,
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
