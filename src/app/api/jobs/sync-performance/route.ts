import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSyncPassAsJob } from "@/features/creative-intelligence/application/run-sync";
import { env } from "@/lib/env";

/**
 * Scheduled Creative Intelligence sync: ingest → attribute → score.
 *
 * GET, because that is what Vercel Cron sends. It also attaches
 * `Authorization: Bearer $CRON_SECRET` automatically when that variable is set
 * on the project, which is the whole authentication story here — cron has no
 * user session to carry.
 *
 * Runs for every connected account rather than taking a userId, so adding a
 * second user needs no change to the schedule. That means service role and no
 * RLS, so every query in the job path filters by user_id by hand.
 *
 * Always answers 200 unless the whole handler failed. A per-account error is
 * reported in the body: one broken Meta token must not make the scheduler treat
 * the entire run as a failure and retry everyone.
 */

export const maxDuration = 60;

/**
 * The handler's own wall-clock ceiling, under the platform's 60s.
 *
 * Shared across accounts rather than given to each. Handing every account its
 * own 40 seconds meant three accounts asked for 120 and the function was killed
 * partway through the second — losing the cursor it had not written yet. The
 * budget is divided instead, and accounts that do not fit are picked up by the
 * next run, which is exactly what the resumable design is for.
 */
const HANDLER_BUDGET_MS = 45_000;
/**
 * Below this there is no point starting another connection.
 *
 * It has to cover what a pass actually costs, not just its ingest: every pass
 * ends with attribution and scoring, which runSyncPass reserves thirty seconds
 * for. Eight was the old figure, from when the budget bought ingestion alone —
 * with it, a connection could be started with eight seconds left, take thirty,
 * and be killed by the platform mid-write.
 */
const MIN_ACCOUNT_BUDGET_MS = 38_000;

function authorised(request: NextRequest): boolean {
  // Unset means unavailable, never open: an endpoint that spends API quota
  // must not become reachable because a variable was forgotten.
  if (!env.CRON_SECRET) return false;
  return request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 503 },
    );
  }

  const deadline = Date.now() + HANDLER_BUDGET_MS;
  const admin = createAdminClient();

  // Only accounts that can actually be synced. A user with no Meta connection
  // has nothing to fetch, and claiming a job row for them would just litter the
  // ledger with no-ops.
  const { data: connections, error } = await admin
    .from("meta_ad_account_connections")
    .select("user_id, ad_account_id, access_token");

  if (error) {
    console.error("Cron sync could not list connections", error);
    return NextResponse.json(
      { error: "Could not list accounts" },
      { status: 500 },
    );
  }

  const accounts = connections ?? [];
  const results = [];
  let deferred = 0;

  for (const [index, connection] of accounts.entries()) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_ACCOUNT_BUDGET_MS) {
      // Reported rather than attempted. Starting an account with four seconds
      // left produces a partial run whose cursor may not survive the kill.
      deferred = accounts.length - index;
      break;
    }

    // Even split of what is left, so one slow account cannot starve the rest.
    const share = Math.floor(remaining / (accounts.length - index));

    // Sequential on purpose: Meta rate-limits per app, and firing every
    // account at once is the fastest way to get throttled for all of them.
    const outcome = await runSyncPassAsJob(
      connection.user_id,
      {
        ad_account_id: connection.ad_account_id,
        access_token: connection.access_token,
      },
      admin,
      Math.max(share, MIN_ACCOUNT_BUDGET_MS),
    );
    results.push({ userId: connection.user_id, ...outcome });
  }

  return NextResponse.json(
    {
      accounts: accounts.length,
      synced: results.length,
      // Non-zero means the schedule is not keeping up and should run more
      // often, which is worth seeing rather than inferring.
      deferred,
      results,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
