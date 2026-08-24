import {
  isFinal,
  RESTATEMENT_WINDOW_DAYS,
} from "@/features/creative-intelligence/domain/meta-metrics";
import {
  fetchAdSets,
  fetchAds,
  fetchCampaigns,
  fetchDailyInsights,
  MetaGraphError,
} from "@/features/creative-intelligence/infrastructure/meta-graph-client";
import {
  ensureInsightsPartition,
  mapMetaAdIdsToEntityIds,
  upsertDailyInsights,
  upsertMetaEntities,
} from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";
import { getConnection } from "@/features/ad-performance/infrastructure/ad-performance-repository";
import type { Db } from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";

/**
 * Ingestion. Mirrors the account, then pulls daily facts for the restatement
 * window.
 *
 * Written to be resumable rather than fast. Vercel Hobby kills a function at 60
 * seconds regardless of `maxDuration` — a limit image generation has already
 * hit — so every step takes a page, records where it got to, and returns. The
 * caller re-invokes until `done`. The same property is what lets this work at a
 * thousand ads as well as at five.
 */

export type SyncCursor = {
  phase: "campaigns" | "adsets" | "ads" | "insights" | "done";
  after?: string;
  /** Insights only: the window being fetched, fixed at the start of the phase. */
  since?: string;
  until?: string;
  /**
   * Which selected account this cursor is partway through.
   *
   * Position rather than id, so a run that is interrupted resumes on the same
   * account. Storing the id instead would strand the cursor if that account
   * were deselected between invocations.
   */
  accountIndex?: number;
};

export type SyncStep = {
  cursor: SyncCursor;
  processed: number;
  done: boolean;
  /**
   * Accounts this pass gave up on, and why.
   *
   * Reported rather than thrown. Twenty of these thirty accounts belong to
   * business portfolios the user is only a limited member of, so a permission
   * error on one is the normal case, not an emergency — and letting it abort the
   * pass meant the twenty-nine healthy accounts were never reached and the
   * cursor was never written. Named so a persistent failure is visible instead
   * of merely quiet.
   */
  skipped?: { adAccountId: string; reason: string }[];
};

export class MetaNotConnectedError extends Error {
  constructor() {
    super("No Meta ad account is connected.");
    this.name = "MetaNotConnectedError";
  }
}

function isoDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Advances the sync by exactly one page.
 *
 * Entities are mirrored before insights on purpose: an insight row keys on an
 * ad we must already know about, and a fact whose dimension is missing is a
 * fact nobody can interpret.
 */
export async function runSyncStep(
  userId: string,
  cursor: SyncCursor | null,
  db?: Db,
  connectionOverride?: { ad_account_id: string; access_token: string },
  accounts?: string[],
): Promise<SyncStep> {
  // Jobs pass the connection in: getConnection() reads through RLS, which a
  // service-role caller does not have.
  const connection = connectionOverride ?? (await getConnection());
  if (!connection) throw new MetaNotConnectedError();

  const { access_token: accessToken } = connection;
  const current: SyncCursor = cursor ?? { phase: "campaigns", accountIndex: 0 };

  // The account list is the selection; the connection's own ad_account_id is
  // only the fallback for a workspace that has not chosen yet.
  const accountIds =
    accounts && accounts.length > 0 ? accounts : [connection.ad_account_id];
  const accountIndex = current.accountIndex ?? 0;
  const adAccountId = accountIds[accountIndex];

  // Ran past the end of the list: every selected account has been walked.
  if (!adAccountId) {
    return { cursor: { phase: "done" }, processed: 0, done: true };
  }

  /**
   * Moves to the next account, or finishes.
   *
   * Each account restarts at `campaigns` because the phases describe one
   * account's objects, not the run as a whole.
   */
  const nextAccount = (): SyncCursor =>
    accountIndex + 1 < accountIds.length
      ? { phase: "campaigns", accountIndex: accountIndex + 1 }
      : { phase: "done" };

  switch (current.phase) {
    case "campaigns": {
      const page = await fetchCampaigns(
        adAccountId,
        accessToken,
        current.after,
      );
      await upsertMetaEntities(userId, page.items, db, adAccountId);
      return {
        cursor: page.nextCursor
          ? { phase: "campaigns", after: page.nextCursor, accountIndex }
          : { phase: "adsets", accountIndex },
        processed: page.items.length,
        done: false,
      };
    }

    case "adsets": {
      const page = await fetchAdSets(adAccountId, accessToken, current.after);
      await upsertMetaEntities(userId, page.items, db, adAccountId);
      return {
        cursor: page.nextCursor
          ? { phase: "adsets", after: page.nextCursor, accountIndex }
          : { phase: "ads", accountIndex },
        processed: page.items.length,
        done: false,
      };
    }

    case "ads": {
      const page = await fetchAds(adAccountId, accessToken, current.after);
      await upsertMetaEntities(userId, page.items, db, adAccountId);
      return {
        cursor: page.nextCursor
          ? { phase: "ads", after: page.nextCursor, accountIndex }
          : {
              phase: "insights",
              accountIndex,
              // Fixed now rather than recomputed per page, so a sync that
              // straddles midnight does not shift its own window and leave a
              // day unfetched.
              since: isoDate(RESTATEMENT_WINDOW_DAYS),
              until: isoDate(0),
            },
        processed: page.items.length,
        done: false,
      };
    }

    case "insights": {
      const since = current.since ?? isoDate(RESTATEMENT_WINDOW_DAYS);
      const until = current.until ?? isoDate(0);

      const page = await fetchDailyInsights(
        adAccountId,
        accessToken,
        since,
        until,
        current.after,
      );

      // Looked up for exactly the ads this page names, rather than fetching the
      // whole ad table and hoping the ones we need are in it. They were not:
      // an unbounded select returns PostgREST's first 1000 rows of 6,918, so
      // 86% of every insights page was dropped by the guard below as "not
      // mirrored yet" — for ever, since the truncation is deterministic.
      const entityIds = await mapMetaAdIdsToEntityIds(
        userId,
        db,
        page.items.map((row) => row.metaAdId),
      );

      // A partition has to exist before the upsert, and the window can span a
      // month boundary.
      await Promise.all(
        [...new Set(page.items.map((row) => row.statDate.slice(0, 7)))].map(
          (month) => ensureInsightsPartition(`${month}-01`, db),
        ),
      );

      const rows = page.items
        .map((row) => {
          const metaEntityId = entityIds.get(row.metaAdId);
          // An insight for an ad we have not mirrored yet is dropped rather
          // than invented — it will arrive on the next run once the entity
          // phase has caught up.
          if (!metaEntityId) return null;
          return {
            ...row,
            metaEntityId,
            isFinal: isFinal(row.statDate),
            adAccountId,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      await upsertDailyInsights(userId, rows, db);

      return {
        cursor: page.nextCursor
          ? {
              phase: "insights",
              after: page.nextCursor,
              since,
              until,
              accountIndex,
            }
          : nextAccount(),
        processed: rows.length,
        // Only truly done once the last selected account has been walked.
        done: !page.nextCursor && accountIndex + 1 >= accountIds.length,
      };
    }

    case "done":
      return { cursor: { phase: "done" }, processed: 0, done: true };
  }
}

/**
 * Runs sync steps until the time budget is spent or the sync completes.
 *
 * The budget is deliberately well under the platform limit: a step that starts
 * at 55 seconds still has to finish, and a killed invocation loses the cursor
 * it never wrote.
 */
export async function runSyncUntilBudget(
  userId: string,
  startCursor: SyncCursor | null,
  budgetMs = 40_000,
  db?: Db,
  connectionOverride?: { ad_account_id: string; access_token: string },
  accounts?: string[],
): Promise<SyncStep> {
  const deadline = Date.now() + budgetMs;
  let cursor = startCursor;
  let processed = 0;
  const skipped: { adAccountId: string; reason: string }[] = [];

  const accountIds =
    accounts && accounts.length > 0
      ? accounts
      : [connectionOverride?.ad_account_id ?? "unknown"];

  for (;;) {
    let step: SyncStep;
    try {
      step = await runSyncStep(
        userId,
        cursor,
        db,
        connectionOverride,
        accounts,
      );
    } catch (error) {
      // A missing connection is about the workspace, not an account: there is
      // nothing to skip past, so it still stops the pass.
      if (error instanceof MetaNotConnectedError) throw error;

      // Throttling applies to the app, not to one account. Skipping forward
      // would spend the rest of the budget collecting the same refusal thirty
      // times, so stop and let the next run resume from here.
      if (error instanceof MetaGraphError && error.isRateLimit) {
        return {
          cursor: cursor ?? { phase: "campaigns", accountIndex: 0 },
          processed,
          done: false,
          skipped,
        };
      }

      const index = cursor?.accountIndex ?? 0;
      skipped.push({
        adAccountId: accountIds[index] ?? "unknown",
        reason: error instanceof Error ? error.message : String(error),
      });

      // Past this account rather than stuck on it. One portfolio we are only a
      // limited member of used to stall every account behind it in the list.
      if (index + 1 >= accountIds.length) {
        return { cursor: { phase: "done" }, processed, done: true, skipped };
      }
      cursor = { phase: "campaigns", accountIndex: index + 1 };
      if (Date.now() >= deadline)
        return { cursor, processed, done: false, skipped };
      continue;
    }

    processed += step.processed;
    cursor = step.cursor;

    if (step.done) return { cursor, processed, done: true, skipped };
    if (Date.now() >= deadline)
      return { cursor, processed, done: false, skipped };
  }
}

/** Whether a failed sync is worth retrying, or needs a human. */
export function isRetryable(error: unknown): boolean {
  if (error instanceof MetaGraphError) {
    // A revoked token will never fix itself; throttling will.
    return error.isRateLimit && !error.isTokenError;
  }
  return false;
}
