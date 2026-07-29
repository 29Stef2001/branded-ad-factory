"use server";

import { revalidatePath } from "next/cache";
import {
  canAutoConfirm,
  findAttributionCandidates,
} from "@/features/creative-intelligence/domain/attribution";
import {
  deleteCreativeLink,
  listAdEntities,
  listConceptsForMatching,
  listCreativeLinks,
  setLinkConfirmed,
  upsertCreativeLink,
} from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";
import { requireUserId } from "@/features/ad-concepts/application/require-user";
import type { ActionState } from "@/features/ad-concepts/application/types";

const INTELLIGENCE_PATH = "/dashboard/intelligence/attribution";

/**
 * Proposes a link for every Meta ad that does not have one yet.
 *
 * Only concept-code matches are confirmed automatically. An image match is
 * recorded unconfirmed and waits for someone to look at it, because a wrong
 * link teaches the scoring model a false lesson with full confidence — worse
 * than having no link at all.
 */
export async function attributeUnlinkedAds(
  userId: string,
): Promise<{ proposed: number; autoConfirmed: number; unmatched: number }> {
  const [ads, concepts, existing] = await Promise.all([
    listAdEntities(),
    listConceptsForMatching(),
    listCreativeLinks(),
  ]);

  const linkedEntityIds = new Set(existing.map((link) => link.meta_entity_id));
  const matchable = concepts.map((concept) => ({
    id: concept.id,
    conceptCode: concept.concept_code,
    perceptualHash: concept.perceptual_hash,
  }));

  let proposed = 0;
  let autoConfirmed = 0;
  let unmatched = 0;

  for (const ad of ads) {
    if (linkedEntityIds.has(ad.id)) continue;

    const candidates = findAttributionCandidates(
      { name: ad.name, perceptualHash: ad.perceptual_hash },
      matchable,
    );

    if (candidates.length === 0) {
      unmatched += 1;
      continue;
    }

    // Only the single best candidate is proposed. Offering three guesses for
    // one ad turns a review queue into a puzzle.
    const best = candidates[0];
    const confirmed = canAutoConfirm(best);

    await upsertCreativeLink(userId, {
      metaEntityId: ad.id,
      conceptId: best.conceptId,
      matchMethod: best.method,
      matchConfidence: best.confidence,
      confirmed,
    });

    proposed += 1;
    if (confirmed) autoConfirmed += 1;
  }

  return { proposed, autoConfirmed, unmatched };
}

export async function confirmLinkAction(
  linkId: string,
  _prev: ActionState,
): Promise<ActionState> {
  const { denied } = await requireUserId();
  if (denied) return denied;

  await setLinkConfirmed(linkId, true);
  revalidatePath(INTELLIGENCE_PATH);
  return { status: "success", message: "Linked." };
}

export async function rejectLinkAction(
  linkId: string,
  _prev: ActionState,
): Promise<ActionState> {
  const { denied } = await requireUserId();
  if (denied) return denied;

  // Deleted rather than flagged: a rejected proposal should be re-proposable
  // once the ad is renamed, and a tombstone would block that.
  await deleteCreativeLink(linkId);
  revalidatePath(INTELLIGENCE_PATH);
  return { status: "success", message: "Rejected." };
}

export async function linkManuallyAction(
  metaEntityId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId, denied } = await requireUserId();
  if (denied) return denied;

  const conceptId = formData.get("conceptId");
  if (typeof conceptId !== "string" || conceptId.length === 0) {
    return { status: "error", message: "Pick a concept to link to." };
  }

  await upsertCreativeLink(userId, {
    metaEntityId,
    conceptId,
    matchMethod: "manual",
    matchConfidence: 1,
    confirmed: true,
  });

  revalidatePath(INTELLIGENCE_PATH);
  return { status: "success", message: "Linked." };
}
