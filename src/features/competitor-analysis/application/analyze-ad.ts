"use server";

import { revalidatePath } from "next/cache";
import { analyzeAdCopy } from "@/features/competitor-analysis/infrastructure/claude-analysis-client";
import {
  getAd,
  saveAnalysis,
} from "@/features/competitor-analysis/infrastructure/competitor-repository";
import type { ActionState } from "@/features/competitor-analysis/application/types";

export async function analyzeAdAction(
  adId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const ad = await getAd(adId);
  if (!ad) {
    return { status: "error", message: "Ad not found." };
  }

  const adCopy = [
    ad.ad_creative_body,
    ad.ad_creative_link_title,
    ad.ad_creative_link_description,
  ]
    .filter(Boolean)
    .join("\n");

  if (!adCopy) {
    return { status: "error", message: "This ad has no text to analyze." };
  }

  try {
    const analysis = await analyzeAdCopy(adCopy);
    await saveAnalysis(adId, analysis);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Analysis failed.",
    };
  }

  revalidatePath(`/dashboard/competitors/${ad.competitor_id}`);
  return { status: "success" };
}
