"use server";

import { revalidatePath } from "next/cache";
import { generateConceptsSchema } from "@/features/ad-concepts/domain/schemas";
import { generateConcepts } from "@/features/ad-concepts/infrastructure/concept-generation-client";
import {
  getBrandProfile,
  getInspirationAd,
  insertConcepts,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
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

  const inspirationAd = parsed.data.inspirationAdId
    ? await getInspirationAd(parsed.data.inspirationAdId)
    : null;

  try {
    const output = await generateConcepts(
      {
        brandName: brandProfile.brand_name,
        industry: brandProfile.industry,
        tone: brandProfile.tone,
        targetAudience: brandProfile.target_audience,
        uniqueSellingPoints: brandProfile.unique_selling_points,
      },
      parsed.data.brief,
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
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Concept generation failed.",
    };
  }

  revalidatePath("/dashboard/concepts");
  return { status: "success" };
}
