"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import {
  DNA_PROMPT_VERSION,
  isWorthAnalysing,
} from "@/features/creative-intelligence/domain/creative-dna";
import {
  analyseCreativeDna,
  toMediaType,
} from "@/features/creative-intelligence/infrastructure/dna-client";
import {
  listAnalysedEntityIds,
  listCreativesForDna,
  recordAnalysisRun,
  upsertCreativeFeatures,
} from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";
import { requireUserId } from "@/features/ad-concepts/application/require-user";

/**
 * Reads the DNA of the creatives that have earned it.
 *
 * Two limits, both deliberate. Only `directional` and `confident` creatives are
 * analysed, because describing an ad with forty impressions produces a
 * confident-sounding vocabulary for noise. And a run has a hard ceiling on how
 * many it will do, because this is a paid vision call per creative and an
 * unbounded loop over 5,896 ads is a bill nobody agreed to.
 */

const TIERS = ["confident", "directional"];

/** Per run. Enough to be useful, small enough to be an obvious cost. */
const DEFAULT_LIMIT = 10;

export type DnaRunResult = {
  analysed: number;
  skipped: number;
  failed: number;
  message: string;
  error: string | null;
};

/**
 * Identifies an analysis by what went into it.
 *
 * The image plus the metrics: re-analysing the same picture with materially
 * the same performance would produce the same answer, so it is not paid for
 * twice. Performance is rounded before hashing, since a single extra
 * impression is not a new creative.
 */
function inputHashFor(
  thumbnailUrl: string,
  metrics: { impressions: number; spend: number; purchases: number },
): string {
  return createHash("sha256")
    .update(
      [
        thumbnailUrl,
        DNA_PROMPT_VERSION,
        Math.round(metrics.impressions / 100),
        Math.round(metrics.spend),
        metrics.purchases,
      ].join("|"),
    )
    .digest("hex");
}

export async function analyseCreativeDnaAction(
  limit = DEFAULT_LIMIT,
): Promise<DnaRunResult> {
  const { userId, denied } = await requireUserId();
  if (denied) {
    return {
      analysed: 0,
      skipped: 0,
      failed: 0,
      message: "",
      error: denied.message ?? "Not signed in.",
    };
  }

  let candidates;
  let alreadyDone: Set<string>;
  try {
    [candidates, alreadyDone] = await Promise.all([
      listCreativesForDna(userId, TIERS, limit * 3),
      listAnalysedEntityIds(userId),
    ]);
  } catch (error) {
    return {
      analysed: 0,
      skipped: 0,
      failed: 0,
      message: "",
      error:
        error instanceof Error ? error.message : "Could not read creatives.",
    };
  }

  const todo = candidates
    .filter((creative) => isWorthAnalysing(creative.evidenceTier))
    .filter((creative) => !alreadyDone.has(creative.metaEntityId))
    .slice(0, limit);

  if (todo.length === 0) {
    return {
      analysed: 0,
      skipped: candidates.length,
      failed: 0,
      message:
        candidates.length === 0
          ? "No creative has enough delivery to analyse yet. Analysis needs at least directional evidence — describing an ad with a handful of impressions would only describe noise."
          : `Nothing new to analyse — all ${candidates.length} eligible creatives already have DNA.`,
      error: null,
    };
  }

  let analysed = 0;
  let failed = 0;

  for (const creative of todo) {
    const startedAt = Date.now();
    const hash = inputHashFor(creative.thumbnailUrl!, creative);

    try {
      const response = await fetch(creative.thumbnailUrl!);
      if (!response.ok) {
        throw new Error(
          `Could not fetch the creative (HTTP ${response.status}).`,
        );
      }
      const bytes = Buffer.from(await response.arrayBuffer());

      const result = await analyseCreativeDna({
        imageBase64: bytes.toString("base64"),
        mediaType: toMediaType(response.headers.get("content-type")),
        adName: creative.adName,
        bodyText: null,
        headline: null,
        metrics: creative,
      });

      const runId = await recordAnalysisRun(userId, {
        analysisType: "creative_dna",
        subjectType: "meta_ad",
        subjectId: null,
        model: result.model,
        promptVersion: result.promptVersion,
        inputHash: hash,
        status: "succeeded",
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        durationMs: Date.now() - startedAt,
        result: result.dna,
      });

      await upsertCreativeFeatures(userId, {
        metaEntityId: creative.metaEntityId,
        contentHash: hash,
        analysisRunId: runId,
        dna: result.dna as unknown as Record<string, unknown>,
      });

      analysed += 1;
    } catch (error) {
      failed += 1;
      const message =
        error instanceof Error ? error.message : "Analysis failed.";
      // Recorded rather than swallowed: a failure that leaves no trace is one
      // that gets retried for ever at full price.
      await recordAnalysisRun(userId, {
        analysisType: "creative_dna",
        subjectType: "meta_ad",
        subjectId: null,
        model: "claude-opus-5",
        promptVersion: DNA_PROMPT_VERSION,
        inputHash: hash,
        status: "failed",
        durationMs: Date.now() - startedAt,
        error: message,
      }).catch(() => null);
    }
  }

  revalidatePath("/dashboard/intelligence/dna");
  revalidatePath("/dashboard/intelligence");

  return {
    analysed,
    skipped: candidates.length - todo.length,
    failed,
    message:
      `Analysed ${analysed} creative${analysed === 1 ? "" : "s"}` +
      (failed > 0 ? `, ${failed} failed` : "") +
      (candidates.length > todo.length
        ? `. ${candidates.length - todo.length} already had DNA.`
        : "."),
    error: null,
  };
}
