"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import {
  computeWhitespace,
  type WhitespaceResult,
} from "@/features/market-intelligence/domain/whitespace-analysis";
import { generateWhitespaceNarrative } from "@/features/market-intelligence/infrastructure/whitespace-narrative-client";
import {
  findCachedRun,
  listCompetitorFeaturesForWhitespace,
  listOwnFeatures,
  recordRun,
  type Db,
} from "@/features/market-intelligence/infrastructure/market-intelligence-repository";
import { requireUserId } from "@/features/ad-concepts/application/require-user";
import type { ActionState } from "@/features/market-intelligence/application/types";

/**
 * The whitespace panel's two halves: a cheap, always-fresh aggregation, and an
 * expensive, deliberately stale narrative.
 *
 * getWhitespaceView never calls Claude — a page render must not carry a paid
 * API call. Only refreshWhitespaceAction does that, on an explicit click, and
 * only once there is at least one pattern worth phrasing.
 */

const PROMPT_VERSION = "whitespace-1";
const CREATIVE_FACTORY_PATH = "/dashboard/intelligence/creative-factory";

function inputHashFor(result: WhitespaceResult): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        shared: result.sharedPatterns,
        leaning: result.competitorLeaning,
        whitespace: result.whitespace,
      }) + PROMPT_VERSION,
    )
    .digest("hex");
}

function allPatterns(result: WhitespaceResult) {
  return [
    ...result.sharedPatterns,
    ...result.competitorLeaning,
    ...result.whitespace,
  ];
}

export type WhitespaceView = {
  result: WhitespaceResult;
  observations: string[];
};

export async function getWhitespaceView(
  userId: string,
  db?: Db,
): Promise<WhitespaceView> {
  const [ours, theirs] = await Promise.all([
    listOwnFeatures(userId, db),
    listCompetitorFeaturesForWhitespace(userId, db),
  ]);
  const result = computeWhitespace(ours, theirs);

  if (allPatterns(result).length === 0) {
    return { result, observations: [] };
  }

  const cached = await findCachedRun(
    userId,
    "whitespace",
    PROMPT_VERSION,
    inputHashFor(result),
    db,
  );
  const observations =
    (cached?.result as { observations?: string[] } | null)?.observations ??
    [];

  return { result, observations };
}

export async function refreshWhitespaceAction(
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const { userId, denied } = await requireUserId();
  if (denied) return denied;

  const [ours, theirs] = await Promise.all([
    listOwnFeatures(userId),
    listCompetitorFeaturesForWhitespace(userId),
  ]);
  const result = computeWhitespace(ours, theirs);

  if (allPatterns(result).length === 0) {
    return {
      status: "error",
      message:
        "Not enough data on both sides yet to compare — keep syncing your own performance and researching competitors.",
    };
  }

  const hash = inputHashFor(result);

  try {
    const narrative = await generateWhitespaceNarrative(result);
    await recordRun(userId, {
      analysisType: "whitespace",
      subjectType: "account",
      subjectId: null,
      model: narrative.model,
      promptVersion: PROMPT_VERSION,
      inputHash: hash,
      status: "succeeded",
      inputTokens: narrative.usage.inputTokens,
      outputTokens: narrative.usage.outputTokens,
      result: { observations: narrative.observations },
    });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not generate observations.",
    };
  }

  revalidatePath(CREATIVE_FACTORY_PATH);
  return { status: "success", message: "Market analysis refreshed." };
}
