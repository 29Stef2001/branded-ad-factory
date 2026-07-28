"use server";

import { revalidatePath } from "next/cache";
import { generateConceptsSchema } from "@/features/ad-concepts/domain/schemas";
import { generateConcepts } from "@/features/ad-concepts/infrastructure/concept-generation-client";
import {
  getBrandProfile,
  getInspirationAd,
  insertConcepts,
  listBrandAssets,
  listEnabledApprovedMessages,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { buildBrandContext } from "@/features/ad-concepts/domain/brand-context";
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

  const [inspirationAd, enabledMessages, brandAssets] = await Promise.all([
    parsed.data.inspirationAdId
      ? getInspirationAd(parsed.data.inspirationAdId)
      : null,
    listEnabledApprovedMessages(),
    listBrandAssets(),
  ]);

  // Only active assets count: a disabled one will not be attached at
  // generation time, so promising it to the model would be a lie.
  const activeAssets = brandAssets.filter((asset) => asset.is_active);
  const availableTypes = [...new Set(activeAssets.map((a) => a.asset_type))];
  const availableTags = [...new Set(activeAssets.flatMap((a) => a.tags))];

  try {
    const output = await generateConcepts(
      buildBrandContext(brandProfile),
      parsed.data.brief,
      enabledMessages.map((m) => m.message),
      {
        types: availableTypes,
        tags: availableTags,
        hasOwner: availableTypes.includes("owner"),
        hasProduct: availableTypes.includes("product"),
      },
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
