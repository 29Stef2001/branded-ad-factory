"use server";

import { revalidatePath } from "next/cache";
import { suggestCompetitorSchema } from "@/features/competitor-analysis/domain/schemas";
import {
  createCompetitor,
  createSuggestedCompetitor,
  getSuggestedCompetitor,
  updateSuggestedCompetitorStatus,
} from "@/features/competitor-analysis/infrastructure/competitor-repository";
import { researchCompetitorAds } from "@/features/competitor-analysis/application/research-competitor";
import { requireUserId } from "@/features/ad-concepts/application/require-user";
import type { ActionState } from "@/features/competitor-analysis/application/types";

/**
 * The review queue for competitors nobody has confirmed yet.
 *
 * Nothing in this file ever inserts into `competitors` except
 * `approveSuggestedCompetitorAction`, and that only runs on an explicit click
 * — a flag is a signal, never a decision made on someone's behalf.
 */

const COMPETITORS_PATH = "/dashboard/competitors";

export async function suggestCompetitorAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = suggestCompetitorSchema.safeParse({
    name: formData.get("name"),
    metaPageId: formData.get("metaPageId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { userId, denied } = await requireUserId();
  if (denied) return denied;

  await createSuggestedCompetitor(userId, {
    name: parsed.data.name,
    metaPageId: parsed.data.metaPageId || null,
    reason: parsed.data.reason,
  });

  revalidatePath(COMPETITORS_PATH);
  return { status: "success", message: "Flagged for review." };
}

export async function approveSuggestedCompetitorAction(
  suggestionId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const { userId, denied } = await requireUserId();
  if (denied) return denied;

  const suggestion = await getSuggestedCompetitor(suggestionId);
  if (!suggestion) {
    return { status: "error", message: "Suggestion not found." };
  }
  // A website is enough. This used to demand a Meta Page ID, which made every
  // automatically discovered candidate un-approvable: discovery yields a name
  // and a website, because a model cannot reliably know a numeric Page ID.
  // Ads no longer arrive only through the Meta Ad Library API, so the Page ID
  // is one way to identify a competitor rather than the only one.
  if (!suggestion.meta_page_id && !suggestion.website_url) {
    return {
      status: "error",
      message:
        "This suggestion has neither a website nor a Meta Page ID, so there is nothing to research. Dismiss it and add the competitor manually.",
    };
  }

  const competitor = await createCompetitor(
    userId,
    suggestion.name,
    {
      metaPageId: suggestion.meta_page_id,
      websiteUrl: suggestion.website_url,
    },
    "suggested",
  );

  // The competitor is tracked either way — never throws, and a quiet result
  // (no provider covers this competitor yet) shouldn't block the approval.
  await researchCompetitorAds(competitor.id, {
    name: suggestion.name,
    metaPageId: suggestion.meta_page_id,
    websiteUrl: suggestion.website_url,
  }).catch(() => null);

  await updateSuggestedCompetitorStatus(suggestionId, "approved");
  revalidatePath(COMPETITORS_PATH);
  return { status: "success", message: "Competitor added." };
}

export async function dismissSuggestedCompetitorAction(
  suggestionId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const { denied } = await requireUserId();
  if (denied) return denied;

  await updateSuggestedCompetitorStatus(suggestionId, "dismissed");
  revalidatePath(COMPETITORS_PATH);
  return { status: "success" };
}
