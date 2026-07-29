"use server";

import { revalidatePath } from "next/cache";
import {
  claimJobRun,
  finishJobRun,
  lastCursorFor,
} from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";
import {
  MetaNotConnectedError,
  runSyncUntilBudget,
  type SyncCursor,
} from "@/features/creative-intelligence/application/sync-meta-data";
import { attributeUnlinkedAds } from "@/features/creative-intelligence/application/attribute-creatives";
import { scoreAllWindows } from "@/features/creative-intelligence/application/score-creatives";
import { requireUserId } from "@/features/ad-concepts/application/require-user";
import type { ActionState } from "@/features/ad-concepts/application/types";

const JOB_NAME = "meta_sync";

export type SyncOutcome = {
  status: "completed" | "partial" | "skipped" | "failed";
  processed: number;
  attributed?: number;
  scored?: number;
  message: string;
};

/**
 * One pass of ingest → attribute → score.
 *
 * Attribution and scoring only run once ingestion has finished: scoring a
 * half-ingested window would write numbers that are wrong until the next run,
 * and a dashboard that is briefly wrong is worse than one that is briefly
 * stale.
 */
export async function runSyncPass(
  userId: string,
  trigger: "cron" | "manual",
): Promise<SyncOutcome> {
  const job = await claimJobRun(userId, JOB_NAME, trigger);
  if (!job) {
    return {
      status: "skipped",
      processed: 0,
      message: "A sync is already running.",
    };
  }

  try {
    const resumeFrom = (await lastCursorFor(JOB_NAME)) as SyncCursor | null;
    const step = await runSyncUntilBudget(userId, resumeFrom);

    if (!step.done) {
      await finishJobRun(job.id, {
        status: "partial",
        processedCount: step.processed,
        cursor: step.cursor,
      });
      return {
        status: "partial",
        processed: step.processed,
        message: `Synced ${step.processed} rows. More to fetch — the next run resumes from here.`,
      };
    }

    const attribution = await attributeUnlinkedAds(userId);
    const scoring = await scoreAllWindows(userId);

    await finishJobRun(job.id, {
      status: "succeeded",
      processedCount: step.processed,
      cursor: null,
    });

    return {
      status: "completed",
      processed: step.processed,
      attributed: attribution.autoConfirmed,
      scored: scoring.scored,
      message:
        `Synced ${step.processed} rows, scored ${scoring.scored} creatives. ` +
        `${attribution.autoConfirmed} linked automatically, ` +
        `${attribution.proposed - attribution.autoConfirmed} awaiting review, ` +
        `${attribution.unmatched} unmatched.`,
    };
  } catch (error) {
    const message =
      error instanceof MetaNotConnectedError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);

    console.error("Meta sync failed", { userId, error });
    await finishJobRun(job.id, { status: "failed", error: message });

    return { status: "failed", processed: 0, message };
  }
}

export async function syncNowAction(_prev: ActionState): Promise<ActionState> {
  const { userId, denied } = await requireUserId();
  if (denied) return denied;

  const outcome = await runSyncPass(userId, "manual");

  revalidatePath("/dashboard/intelligence");
  revalidatePath("/dashboard/intelligence/attribution");

  return outcome.status === "failed"
    ? { status: "error", message: outcome.message }
    : { status: "success", message: outcome.message };
}
