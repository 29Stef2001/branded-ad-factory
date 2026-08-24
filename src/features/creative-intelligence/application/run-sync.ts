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

/**
 * Names the accounts a pass could not read.
 *
 * Skipping is the right behaviour — one inaccessible account must not stall the
 * other twenty-nine — but a skip that says nothing is indistinguishable from an
 * account with no ads, which is exactly the confusion that hid a missing
 * $25,000 of revenue. So the reason travels with the result.
 */
function skippedNote(skipped: { adAccountId: string; reason: string }[] = []) {
  if (skipped.length === 0) return "";
  const named = skipped
    .slice(0, 3)
    .map((entry) => `${entry.adAccountId} (${entry.reason})`)
    .join("; ");
  return ` Skipped ${skipped.length} account${skipped.length === 1 ? "" : "s"}: ${named}${
    skipped.length > 3 ? `; and ${skipped.length - 3} more` : ""
  }.`;
}

export type SyncOutcome = {
  status: "completed" | "partial" | "skipped" | "failed";
  processed: number;
  attributed?: number;
  scored?: number;
  hashed?: number;
  /** Accounts this pass could not read, and why. Empty is the happy case. */
  skipped?: { adAccountId: string; reason: string }[];
  message: string;
};

/**
 * One pass of ingest → attribute → score.
 */

/**
 * Held back from the ingest budget for the work that always follows it.
 *
 * `budgetMs` used to be spent entirely on ingestion, but attribution and
 * scoring run after it on every pass, partial ones included. The caller's
 * budget is a promise about the whole invocation — the platform kills the
 * function at its own ceiling regardless of what this code intended — so
 * giving ingest all of it put the tail over the edge: a 45s ingest followed by
 * ~16s of attribution and scoring was killed at 61s, and `finishJobRun` never
 * ran, so the pass lost the cursor recording where it had got to.
 *
 * Generous on purpose. Overshooting the ceiling costs the whole pass and its
 * cursor; reserving too much only fetches fewer rows, and the next run resumes
 * from where this one stopped.
 *
 * Thirty seconds because twenty was measured to be too few: a pass that scored
 * 1,267 creatives spent 28.5s past its ingest and finished the invocation at
 * 53.5 of the available 60. That margin is not a margin. Note that this is a
 * reserve, not a limit — scoring is not itself interruptible, so a large enough
 * account can still overshoot. Bounding scoring the way ingestion is bounded is
 * the real fix, and this constant is what buys time until then.
 */
const POST_PROCESSING_RESERVE_MS = 30_000;

/** Below this an ingest pass fetches too little to be worth claiming the job. */
const MIN_INGEST_MS = 5_000;
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
      Math.max(budgetMs - POST_PROCESSING_RESERVE_MS, MIN_INGEST_MS),
      db,
      connection,
      accountIds,
    );

    if (!step.done) {
      // Score what has landed rather than waiting for the whole sync.
      //
      // With thirty accounts a pass never finishes inside one invocation, so
      // gating scoring on completion meant it simply stopped running: the
      // scores froze on the day the account list grew, and forty-one purchases
      // sat in the facts while every ranking still read zero. Scoring is
      // deterministic and cheap, so running it on a partial ingest costs
      // nothing and keeps the numbers honest about what is known so far.
      const partialAttribution = await attributeUnlinkedAds(userId, db);
      const partialScoring = await scoreAllWindows(userId, db);

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
        attributed: partialAttribution.autoConfirmed,
        scored: partialScoring.scored,
        skipped: step.skipped,
        message:
          `Synced ${step.processed} rows and scored ${partialScoring.scored} creatives so far. ` +
          `More to fetch — the next run resumes from here.` +
          skippedNote(step.skipped),
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
      skipped: step.skipped,
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
          : "") +
        skippedNote(step.skipped),
    };
  } catch (error) {
    const message =
      error instanceof MetaNotConnectedError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);

    // Logged field by field: an Error does not survive JSON serialisation, so
    // the object form printed "{}" and hid every failure behind "An unknown
    // error occurred". A log that cannot say what broke costs more than the
    // bug it is hiding.
    console.error("Meta sync failed", {
      userId,
      message,
      name: error instanceof Error ? error.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      // Supabase errors carry these instead of a stack.
      details: (error as { details?: string })?.details,
      hint: (error as { hint?: string })?.hint,
      code: (error as { code?: string })?.code,
    });
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
