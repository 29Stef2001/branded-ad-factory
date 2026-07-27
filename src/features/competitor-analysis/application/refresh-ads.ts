"use server";

import { revalidatePath } from "next/cache";
import { fetchActiveAdsForPage } from "@/features/competitor-analysis/infrastructure/meta-ad-library-client";
import {
  getCompetitor,
  upsertAds,
} from "@/features/competitor-analysis/infrastructure/competitor-repository";
import type { ActionState } from "@/features/competitor-analysis/application/types";

export async function refreshAdsAction(
  competitorId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const competitor = await getCompetitor(competitorId);
  if (!competitor) {
    return { status: "error", message: "Competitor not found." };
  }

  try {
    const ads = await fetchActiveAdsForPage(competitor.meta_page_id);
    await upsertAds(competitorId, ads);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to refresh ads from Meta.",
    };
  }

  revalidatePath(`/dashboard/competitors/${competitorId}`);
  return { status: "success", message: "Ads refreshed." };
}
