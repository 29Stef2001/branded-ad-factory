"use server";

import { revalidatePath } from "next/cache";
import { generateConceptsSchema } from "@/features/ad-concepts/domain/schemas";
import { generateConcepts } from "@/features/ad-concepts/infrastructure/concept-generation-client";
import {
  getBrandProfile,
  getInspirationAd,
  insertConcepts,
  listEnabledApprovedMessages,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { toUserFacingError } from "@/features/ad-concepts/domain/generation-errors";
import { getCurrentUser } from "@/features/auth/infrastructure/auth-repository";
import type { ActionState } from "@/features/ad-concepts/application/types";

export async function generateConceptsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = generateConceptsSchema.safeParse({
    brief: formData.get("brief"),
    inspirationAdId: formData.get("inspirationAdId") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "You must be signed in." };
  }

  const brandProfile = await getBrandProfile();
  if (!brandProfile) {
    return {
      status: "error",
      message: "Set up your brand profile before generating concepts.",
    };
  }

  const [inspirationAd, enabledMessages] = await Promise.all([
    parsed.data.inspirationAdId
      ? getInspirationAd(parsed.data.inspirationAdId)
      : null,
    listEnabledApprovedMessages(),
  ]);

  try {
    const output = await generateConcepts(
      {
        brandName: brandProfile.brand_name,
        industry: brandProfile.industry,
        tone: brandProfile.tone,
        targetAudience: brandProfile.target_audience,
        uniqueSellingPoints: brandProfile.unique_selling_points,
      },
      {
        brandColors: brandProfile.brand_colors,
        typographyNotes: brandProfile.typography_notes,
        embossStyle: brandProfile.emboss_style,
        embossCustomNotes: brandProfile.emboss_custom_notes,
        foilStyle: brandProfile.foil_style,
        foilCustomNotes: brandProfile.foil_custom_notes,
      },
      parsed.data.brief,
      enabledMessages.map((m) => m.message),
      inspirationAd
        ? {
            competitorName: inspirationAd.competitorName,
            adCopy: inspirationAd.adCreativeBody ?? "",
            messagingAngle: inspirationAd.messagingAngle,
          }
        : null,
    );

    await insertConcepts(
      user.id,
      parsed.data.brief,
      parsed.data.inspirationAdId ?? null,
      output.concepts,
    );
  } catch (error) {
    // Provider errors arrive as raw JSON payloads; surfacing those verbatim
    // told the user nothing about whether to wait or change something.
    console.error("Concept generation failed", { error });
    return { status: "error", message: toUserFacingError(error).message };
  }

  revalidatePath("/dashboard/concepts");
  return { status: "success" };
}
