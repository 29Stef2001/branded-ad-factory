"use server";

import { revalidatePath } from "next/cache";
import { refineConceptSchema } from "@/features/ad-concepts/domain/schemas";
import { refineConcept } from "@/features/ad-concepts/infrastructure/concept-generation-client";
import {
  getBrandProfile,
  getConcept,
  insertRefinedConcept,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { getCurrentUser } from "@/features/auth/infrastructure/auth-repository";
import type { ActionState } from "@/features/ad-concepts/application/types";

export async function refineConceptAction(
  conceptId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = refineConceptSchema.safeParse({
    instruction: formData.get("instruction"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "You must be signed in." };
  }

  const [original, brandProfile] = await Promise.all([
    getConcept(conceptId),
    getBrandProfile(),
  ]);

  if (!original) {
    return { status: "error", message: "Concept not found." };
  }
  if (!brandProfile) {
    return {
      status: "error",
      message: "Set up your brand profile before refining concepts.",
    };
  }

  try {
    const refined = await refineConcept(original, parsed.data.instruction, {
      brandName: brandProfile.brand_name,
      industry: brandProfile.industry,
      tone: brandProfile.tone,
      targetAudience: brandProfile.target_audience,
      uniqueSellingPoints: brandProfile.unique_selling_points,
    });

    await insertRefinedConcept(
      user.id,
      conceptId,
      parsed.data.instruction,
      refined,
    );
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Concept refinement failed.",
    };
  }

  revalidatePath("/dashboard/concepts");
  return { status: "success" };
}
