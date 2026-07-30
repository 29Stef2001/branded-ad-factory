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

  const results = [];
  for (const connection of connections ?? []) {
    // Sequential on purpose: Meta rate-limits per app, and firing every
    // account at once is the fastest way to get throttled for all of them.
    const outcome = await runSyncPassAsJob(
      connection.user_id,
      {
        ad_account_id: connection.ad_account_id,
        access_token: connection.access_token,
      },
      admin,
    );
    results.push({ userId: connection.user_id, ...outcome });
  }

  return NextResponse.json(
    { accounts: results.length, results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
