"use server";

import { revalidatePath } from "next/cache";
import { brandProfileSchema } from "@/features/ad-concepts/domain/schemas";
import { upsertBrandProfile } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { getCurrentUser } from "@/features/auth/infrastructure/auth-repository";
import type { ActionState } from "@/features/ad-concepts/application/types";

export async function saveBrandProfileAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = brandProfileSchema.safeParse({
    brandName: formData.get("brandName"),
    industry: formData.get("industry"),
    tone: formData.get("tone"),
    targetAudience: formData.get("targetAudience"),
    uniqueSellingPoints: formData.get("uniqueSellingPoints"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "You must be signed in." };
  }

  await upsertBrandProfile(user.id, parsed.data);
  revalidatePath("/dashboard/concepts");

  return { status: "success", message: "Brand profile saved." };
}
