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
  if (!suggestion.meta_page_id) {
    return {
      status: "error",
      message:
        "This suggestion has no Meta Page ID yet — dismiss it and add the competitor manually once you have one.",
    };
  }

  const competitor = await createCompetitor(
    userId,
    suggestion.name,
    suggestion.meta_page_id,
    "suggested",
  );

  // The competitor is tracked either way — never throws, and a quiet result
  // (no provider covers this competitor yet) shouldn't block the approval.
  await researchCompetitorAds(competitor.id, {
    name: suggestion.name,
    metaPageId: suggestion.meta_page_id,
    websiteUrl: null,
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
