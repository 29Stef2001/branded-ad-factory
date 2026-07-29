import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runSyncPass } from "@/features/creative-intelligence/application/run-sync";
import { env } from "@/lib/env";

/**
 * Scheduled Creative Intelligence sync: ingest → attribute → score.
 *
 * A route handler rather than a Server Action, for the reason this codebase
 * already reserves them: it needs its own HTTP contract, authenticated by a
 * shared secret rather than a user session, because cron has no session.
 *
 * Returns 200 with a body describing a partial run rather than an error status.
 * A sync that ran out of time is working as designed — Vercel Hobby kills a
 * function at 60 seconds regardless of maxDuration, so every job is built to
 * resume — and a non-2xx would make the scheduler treat progress as failure.
 */

export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  // Unset means unavailable, never open. An endpoint that runs a paid sync must
  // not be reachable because a variable was forgotten.
  if (!env.CRON_SECRET) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${env.CRON_SECRET}`;
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // RLS scopes every query to the caller, and cron has no session — so the
  // handler verifies the account exists rather than trusting the parameter.
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    return NextResponse.json({ error: "Unknown user" }, { status: 404 });
  }

  const outcome = await runSyncPass(userId, "cron");

  return NextResponse.json(outcome, {
    status: outcome.status === "failed" ? 500 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
