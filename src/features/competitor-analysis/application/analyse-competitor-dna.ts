"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import {
  COMPETITOR_DNA_PROMPT_VERSION,
  competitorConfidenceFor,
} from "@/features/competitor-analysis/domain/competitor-dna";
import { analyseCompetitorAdDna } from "@/features/competitor-analysis/infrastructure/competitor-dna-client";
import {
  getAd,
  listAnalysedCompetitorAdIds,
  listCompetitorAdsForDna,
  recordCompetitorAnalysisRun,
  upsertCompetitorFeatures,
  type CompetitorAdForDna,
  type Db,
} from "@/features/competitor-analysis/infrastructure/competitor-repository";
import { requireUserId } from "@/features/ad-concepts/application/require-user";
import type { ActionState } from "@/features/competitor-analysis/application/types";

/**
 * Reads the DNA of a competitor's ads that do not have it yet.
 *
 * Mirrors creative-intelligence's analyse-dna.ts orchestration — hash the
 * input, check the shared analysis_runs cache, call Claude, store the result —
 * but text-only and without an evidence-tier gate: competitor ads carry no
 * performance data to gate on, only copy.
 */

const DEFAULT_LIMIT = 10;

function inputHashFor(ad: CompetitorAdForDna): string {
  return createHash("sha256")
    .update(
      [
        ad.ad_creative_body ?? "",
        ad.ad_creative_link_title ?? "",
        ad.ad_creative_link_description ?? "",
        COMPETITOR_DNA_PROMPT_VERSION,
      ].join("|"),
    )
    .digest("hex");
}

/** One ad, analysed and stored. Failures are recorded, not thrown — a failure that leaves no trace gets retried forever at full price. */
async function analyseOneAd(
  userId: string,
  ad: CompetitorAdForDna,
  db?: Db,
): Promise<boolean> {
  const startedAt = Date.now();
  const hash = inputHashFor(ad);

  try {
    const result = await analyseCompetitorAdDna({
      pageName: ad.page_name,
      bodyText: ad.ad_creative_body,
      linkTitle: ad.ad_creative_link_title,
      linkDescription: ad.ad_creative_link_description,
    });

    const confidence = competitorConfidenceFor(
      ad.ad_creative_body,
      ad.ad_creative_link_title,
      ad.ad_creative_link_description,
    );

    const runId = await recordCompetitorAnalysisRun(
      userId,
      {
        analysisType: "competitor_dna",
        subjectType: "competitor_ad",
        subjectId: null,
        model: result.model,
        promptVersion: result.promptVersion,
        inputHash: hash,
        status: "succeeded",
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        durationMs: Date.now() - startedAt,
        result: result.dna,
      },
      db,
    );

    await upsertCompetitorFeatures(
      userId,
      {
        competitorAdId: ad.id,
        contentHash: hash,
        analysisRunId: runId,
        confidence,
        dna: result.dna as unknown as Record<string, unknown>,
      },
      db,
    );

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed.";
    await recordCompetitorAnalysisRun(
      userId,
      {
        analysisType: "competitor_dna",
        subjectType: "competitor_ad",
        subjectId: null,
        model: "claude-opus-5",
        promptVersion: COMPETITOR_DNA_PROMPT_VERSION,
        inputHash: hash,
        status: "failed",
        durationMs: Date.now() - startedAt,
        error: message,
      },
      db,
    ).catch(() => null);
    return false;
  }
}

export type CompetitorDnaRunResult = {
  analysed: number;
  failed: number;
};

/**
 * Runs DNA analysis for one competitor's not-yet-analysed ads, up to `limit`.
 *
 * Used both by the manual "Refresh ads" flow (interactive client, no `db`) and
 * the competitor-research cron job (service-role client passed as `db`).
 */
export async function analyseCompetitorDnaForCompetitor(
  userId: string,
  competitorId: string,
  limit = DEFAULT_LIMIT,
  db?: Db,
): Promise<CompetitorDnaRunResult> {
  const [candidates, alreadyDone] = await Promise.all([
    listCompetitorAdsForDna(competitorId, limit * 3, db),
    listAnalysedCompetitorAdIds(userId, db),
  ]);

  const todo = candidates
    .filter((ad) => !alreadyDone.has(ad.id))
    .filter((ad) => ad.ad_creative_body || ad.ad_creative_link_title)
    .slice(0, limit);

  let analysed = 0;
  let failed = 0;
  for (const ad of todo) {
    if (await analyseOneAd(userId, ad, db)) analysed += 1;
    else failed += 1;
  }

  return { analysed, failed };
}

export async function analyseCompetitorDnaAction(
  competitorId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const { userId, denied } = await requireUserId();
  if (denied) return denied;

  let result: CompetitorDnaRunResult;
  try {
    result = await analyseCompetitorDnaForCompetitor(userId, competitorId);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Analysis failed.",
    };
  }

  revalidatePath(`/dashboard/competitors/${competitorId}`);

  if (result.analysed === 0 && result.failed === 0) {
    return {
      status: "success",
      message: "Nothing new to analyse — every ad already has DNA.",
    };
  }

  return {
    status: "success",
    message:
      `Analysed ${result.analysed} ad${result.analysed === 1 ? "" : "s"}` +
      (result.failed > 0 ? `, ${result.failed} failed` : "") +
      ".",
  };
}

/** The per-ad "Analyze" button's action — one ad, on demand. */
export async function analyseCompetitorAdDnaAction(
  adId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const { userId, denied } = await requireUserId();
  if (denied) return denied;

  const ad = await getAd(adId);
  if (!ad) {
    return { status: "error", message: "Ad not found." };
  }
  if (!ad.ad_creative_body && !ad.ad_creative_link_title) {
    return { status: "error", message: "This ad has no text to analyze." };
  }

  const ok = await analyseOneAd(userId, ad, undefined);

  revalidatePath(`/dashboard/competitors/${ad.competitor_id}`);
  return ok
    ? { status: "success" }
    : { status: "error", message: "Analysis failed." };
}
