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
};

export type SyncStep = {
  cursor: SyncCursor;
  processed: number;
  done: boolean;
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
): Promise<SyncStep> {
  // Jobs pass the connection in: getConnection() reads through RLS, which a
  // service-role caller does not have.
  const connection = connectionOverride ?? (await getConnection());
  if (!connection) throw new MetaNotConnectedError();

  const { ad_account_id: adAccountId, access_token: accessToken } = connection;
  const current: SyncCursor = cursor ?? { phase: "campaigns" };

  switch (current.phase) {
    case "campaigns": {
      const page = await fetchCampaigns(
        adAccountId,
        accessToken,
        current.after,
      );
      await upsertMetaEntities(userId, page.items, db);
      return {
        cursor: page.nextCursor
          ? { phase: "campaigns", after: page.nextCursor }
          : { phase: "adsets" },
        processed: page.items.length,
        done: false,
      };
    }

    case "adsets": {
      const page = await fetchAdSets(adAccountId, accessToken, current.after);
      await upsertMetaEntities(userId, page.items, db);
      return {
        cursor: page.nextCursor
          ? { phase: "adsets", after: page.nextCursor }
          : { phase: "ads" },
        processed: page.items.length,
        done: false,
      };
    }

    case "ads": {
      const page = await fetchAds(adAccountId, accessToken, current.after);
      await upsertMetaEntities(userId, page.items, db);
      return {
        cursor: page.nextCursor
          ? { phase: "ads", after: page.nextCursor }
          : {
              phase: "insights",
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

      const [page, entityIds] = await Promise.all([
        fetchDailyInsights(
          adAccountId,
          accessToken,
          since,
          until,
          current.after,
        ),
        mapMetaAdIdsToEntityIds(userId, db),
      ]);

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
          return { ...row, metaEntityId, isFinal: isFinal(row.statDate) };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      await upsertDailyInsights(userId, rows, db);

      return {
        cursor: page.nextCursor
          ? { phase: "insights", after: page.nextCursor, since, until }
          : { phase: "done" },
        processed: rows.length,
        done: !page.nextCursor,
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
): Promise<SyncStep> {
  const deadline = Date.now() + budgetMs;
  let cursor = startCursor;
  let processed = 0;

  for (;;) {
    const step = await runSyncStep(userId, cursor, db, connectionOverride);
    processed += step.processed;
    cursor = step.cursor;

    if (step.done) return { cursor, processed, done: true };
    if (Date.now() >= deadline) return { cursor, processed, done: false };
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
