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
  /** Ads this call left untouched — either over `limit` or out of time. */
  remaining: number;
};

/**
 * What one analysis is assumed to cost, when a deadline is in play.
 *
 * Measured against real runs rather than guessed: a text-only DNA call takes
 * a few seconds, and the loop must not start one it cannot finish. The
 * reserve is deliberately generous because the two failures are not
 * symmetric — overshooting kills the whole invocation before its caller can
 * record what it did, while stopping early only leaves ads for the next
 * pass, which is what `remaining` exists to report.
 */
const ESTIMATED_ANALYSIS_MS = 12_000;

/**
 * Runs DNA analysis for one competitor's not-yet-analysed ads, up to `limit`.
 *
 * Used by the manual "Refresh ads" flow (interactive client, no `db`), the
 * `competitor_ads_submit` MCP tool, and the competitor-research cron job
 * (service-role client passed as `db`).
 *
 * `deadline` exists because this is the expensive half of that cron job and
 * it used to be invisible to the budget. The route checked the clock before
 * each competitor but never inside this loop, so a single competitor with
 * ten unanalysed ads could spend a minute here — past the platform's 60s
 * ceiling, killed before `finishCompetitorResearchJob` ran, leaving a
 * `running` claim that blocked every later run until it went stale. Callers
 * with a wall-clock limit pass it; callers without one (a user clicking a
 * button) omit it and get the old behaviour.
 */
export async function analyseCompetitorDnaForCompetitor(
  userId: string,
  competitorId: string,
  limit = DEFAULT_LIMIT,
  db?: Db,
  deadline?: number,
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
  let stoppedAt = todo.length;

  for (const [index, ad] of todo.entries()) {
    if (deadline !== undefined && Date.now() + ESTIMATED_ANALYSIS_MS > deadline) {
      stoppedAt = index;
      break;
    }
    if (await analyseOneAd(userId, ad, db)) analysed += 1;
    else failed += 1;
  }

  return { analysed, failed, remaining: todo.length - stoppedAt };
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
