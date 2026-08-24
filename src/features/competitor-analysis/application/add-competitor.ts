"use server";

import { redirect } from "next/navigation";
import { addCompetitorSchema } from "@/features/competitor-analysis/domain/schemas";
import { createCompetitor } from "@/features/competitor-analysis/infrastructure/competitor-repository";
import { researchCompetitorAds } from "@/features/competitor-analysis/application/research-competitor";
import { getCurrentUser } from "@/features/auth/infrastructure/auth-repository";
import type { ActionState } from "@/features/competitor-analysis/application/types";

export async function addCompetitorAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addCompetitorSchema.safeParse({
    name: formData.get("name"),
    metaPageId: formData.get("metaPageId"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "You must be signed in." };
  }

  const competitor = await createCompetitor(
    user.id,
    parsed.data.name,
    parsed.data.metaPageId,
  );

  // Tracking the competitor never depends on a provider actually finding
  // ads: most ordinary commercial competitors are outside Meta Ad Library's
  // scope by design, and no provider being available yet is a normal state,
  // not a failure — see researchCompetitorAds.
  await researchCompetitorAds(competitor.id, {
    name: parsed.data.name,
    metaPageId: parsed.data.metaPageId,
    websiteUrl: null,
  }).catch(() => null);

  redirect(`/dashboard/competitors/${competitor.id}`);
}
