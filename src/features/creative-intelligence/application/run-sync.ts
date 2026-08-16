"use server";

import { revalidatePath } from "next/cache";
import {
  claimJobRun,
  finishJobRun,
  lastCursorFor,
  listSelectedAdAccounts,
  type Db,
} from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";
import {
  MetaNotConnectedError,
  runSyncUntilBudget,
  type SyncCursor,
} from "@/features/creative-intelligence/application/sync-meta-data";
import { attributeUnlinkedAds } from "@/features/creative-intelligence/application/attribute-creatives";
import { discoverAccountsAndPages } from "@/features/creative-intelligence/application/discover-accounts";
import {
  backfillConceptHashes,
  hashAdThumbnails,
} from "@/features/creative-intelligence/application/hash-ad-thumbnails";
import { scoreAllWindows } from "@/features/creative-intelligence/application/score-creatives";
import { requireUserId } from "@/features/ad-concepts/application/require-user";
import type { ActionState } from "@/features/ad-concepts/application/types";

const JOB_NAME = "meta_sync";

export type SyncOutcome = {
  status: "completed" | "partial" | "skipped" | "failed";
  processed: number;
  attributed?: number;
  scored?: number;
  hashed?: number;
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
  options: {
    db?: Db;
    connection?: { ad_account_id: string; access_token: string };
    /** Wall-clock budget for this pass. Defaults to a single-account run. */
    budgetMs?: number;
  } = {},
): Promise<SyncOutcome> {
  const { db, connection, budgetMs = 40_000 } = options;
  const job = await claimJobRun(userId, JOB_NAME, trigger, db);
  if (!job) {
    return {
      status: "skipped",
      processed: 0,
      message: "A sync is already running.",
    };
  }

  try {
    // Refresh the catalogue first: an account selected in the UI must exist as
    // a row before the sync can be told to walk it, and a newly added account
    // should not have to wait a day to be noticed.
    if (connection) {
      await discoverAccountsAndPages(userId, connection, db);
    }

    const selected = await listSelectedAdAccounts(userId, db);
    const accountIds = selected.map((account) => account.ad_account_id);

    const resumeFrom = (await lastCursorFor(
      JOB_NAME,
      userId,
      db,
    )) as SyncCursor | null;
    const step = await runSyncUntilBudget(
      userId,
      resumeFrom,
      budgetMs,
      db,
      connection,
      accountIds,
    );

    if (!step.done) {
      await finishJobRun(
        job.id,
        {
          status: "partial",
          processedCount: step.processed,
          cursor: step.cursor,
        },
        db,
      );
      return {
        status: "partial",
        processed: step.processed,
        message: `Synced ${step.processed} rows. More to fetch — the next run resumes from here.`,
      };
    }

    // Before attribution, so the fallback path has fingerprints to compare
    // against on this same pass rather than the next one.
    const hashing = await hashAdThumbnails(userId, db);
    // Our own side of the comparison. Runs through the session client, since
    // Storage reads and creative_generations are already scoped by RLS.
    const backfill = await backfillConceptHashes();
    const attribution = await attributeUnlinkedAds(userId, db);
    const scoring = await scoreAllWindows(userId, db);

    await finishJobRun(
      job.id,
      {
        status: "succeeded",
        processedCount: step.processed,
        cursor: null,
      },
      db,
    );

    return {
      status: "completed",
      processed: step.processed,
      attributed: attribution.autoConfirmed,
      scored: scoring.scored,
      hashed: hashing.hashed,
      message:
        `Synced ${step.processed} rows across ${accountIds.length || 1} account${accountIds.length === 1 ? "" : "s"}, ` +
        `scored ${scoring.scored} creatives. ` +
        `${attribution.autoConfirmed} linked automatically, ` +
        `${attribution.proposed - attribution.autoConfirmed} awaiting review, ` +
        `${attribution.unmatched} unmatched.` +
        (backfill.hashed > 0
          ? ` Fingerprinted ${backfill.hashed} of your own creative${backfill.hashed === 1 ? "" : "s"}.`
          : "") +
        (hashing.hashed > 0
          ? ` Fingerprinted ${hashing.hashed} thumbnail${hashing.hashed === 1 ? "" : "s"}${hashing.remaining ? " (more next run)" : ""}.`
          : ""),
    };
  } catch (error) {
    const message =
      error instanceof MetaNotConnectedError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);

    console.error("Meta sync failed", { userId, error });
    await finishJobRun(job.id, { status: "failed", error: message }, db);

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

/**
 * The cron entry point: one account, running as service role.
 *
 * A thin wrapper rather than a second implementation, so a scheduled sync and a
 * hand-triggered one cannot drift apart in what they actually do.
 */
export async function runSyncPassAsJob(
  userId: string,
  connection: { ad_account_id: string; access_token: string },
  db: Db,
  budgetMs?: number,
): Promise<SyncOutcome> {
  return runSyncPass(userId, "cron", { db, connection, budgetMs });
}
