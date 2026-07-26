"use server";

import { redirect } from "next/navigation";
import { addCompetitorSchema } from "@/features/competitor-analysis/domain/schemas";
import { fetchActiveAdsForPage } from "@/features/competitor-analysis/infrastructure/meta-ad-library-client";
import {
  createCompetitor,
  upsertAds,
} from "@/features/competitor-analysis/infrastructure/competitor-repository";
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

  let ads;
  try {
    ads = await fetchActiveAdsForPage(parsed.data.metaPageId);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch ads from Meta.",
    };
  }

  const competitor = await createCompetitor(
    user.id,
    parsed.data.name,
    parsed.data.metaPageId,
  );
  await upsertAds(competitor.id, ads);

  redirect(`/dashboard/competitors/${competitor.id}`);
}
