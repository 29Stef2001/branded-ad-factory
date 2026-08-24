"use server";

import { revalidatePath } from "next/cache";
import { getCompetitor } from "@/features/competitor-analysis/infrastructure/competitor-repository";
import {
  researchCompetitorAds,
  summarizeResearch,
} from "@/features/competitor-analysis/application/research-competitor";
import { analyseCompetitorDnaForCompetitor } from "@/features/competitor-analysis/application/analyse-competitor-dna";
import { requireUserId } from "@/features/ad-concepts/application/require-user";
import type { ActionState } from "@/features/competitor-analysis/application/types";

export async function refreshAdsAction(
  competitorId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const { userId, denied } = await requireUserId();
  if (denied) return denied;

  const competitor = await getCompetitor(competitorId);
  if (!competitor) {
    return { status: "error", message: "Competitor not found." };
  }

  // Never throws — see researchCompetitorAds. A provider having nothing to
  // say (Meta out of scope, others not configured) is reported, not treated
  // as a failed refresh.
  const research = await researchCompetitorAds(competitorId, {
    name: competitor.name,
    metaPageId: competitor.meta_page_id,
    websiteUrl: competitor.website_url,
  });

  // Best-effort: a refresh that pulled new ads should not be reported as
  // failed just because the DNA read on top of it had trouble.
  const dna = await analyseCompetitorDnaForCompetitor(
    userId,
    competitorId,
  ).catch(() => null);

  revalidatePath(`/dashboard/competitors/${competitorId}`);
  return {
    status: "success",
    message:
      `${research.totalAdsFound} ad${research.totalAdsFound === 1 ? "" : "s"} found.` +
      (dna && dna.analysed > 0
        ? ` Read DNA for ${dna.analysed} ad${dna.analysed === 1 ? "" : "s"}.`
        : "") +
      ` ${summarizeResearch(research)}`,
  };
}
