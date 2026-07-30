import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { env } from "@/lib/env";

/**
 * Service-role Supabase client. **Bypasses RLS entirely.**
 *
 * Exists for exactly one reason: background jobs have no user session, and RLS
 * scopes every query to the caller — so a cron-triggered sync using the normal
 * client would see nothing at all. Iterating every connected account is the
 * whole job.
 *
 * Rules for using this:
 *
 * - Only from `src/app/api/jobs/**`. Never from a page, a Server Action, or
 *   anything a request with a user session can reach.
 * - Always scope queries by `user_id` by hand. RLS is not there to catch a
 *   missing filter any more, so a forgotten `.eq("user_id", …)` silently reads
 *   or writes across every account.
 * - Never return its rows to a browser without re-checking ownership.
 *
 * The key is optional in the schema so local development and the normal app
 * run without it; the jobs that need it fail with a clear message instead of
 * falling back to a client that would quietly return empty results.
 */
export function createAdminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — scheduled jobs cannot run without it.",
    );
  }

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** True when scheduled jobs are configured to run at all. */
export function canRunScheduledJobs(): boolean {
  return Boolean(env.SUPABASE_SERVICE_ROLE_KEY && env.CRON_SECRET);
}
