import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Small, explicitly tenant-scoped reads that exist only to compose
 * `factory_get_status()` and `approval_get_status()` — aggregations that
 * have no equivalent Server Component page today, so there's no existing
 * function to reuse. Everything else in this feature calls into the
 * already-tested repository functions of the features it reports on.
 *
 * Every query here filters by `user_id` explicitly: the caller is always the
 * admin client (no Supabase session exists for a bearer-token MCP request),
 * so there is no RLS safety net — omitting the filter would return every
 * tenant's rows.
 */

export type Db = SupabaseClient<Database>;

export async function getLastSyncStatus(userId: string, db: Db) {
  const { data, error } = await db
    .from("job_runs")
    .select("job_name, status, started_at, finished_at, processed_count, error")
    .eq("user_id", userId)
    .eq("job_name", "meta_sync")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getLastCompetitorResearchStatus(userId: string, db: Db) {
  const { data, error } = await db
    .from("job_runs")
    .select("job_name, status, started_at, finished_at, processed_count, error")
    .eq("user_id", userId)
    .eq("job_name", "competitor_research")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function countCompetitors(userId: string, db: Db): Promise<number> {
  const { count, error } = await db
    .from("competitors")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;
  return count ?? 0;
}

export async function countPendingSuggestions(
  userId: string,
  db: Db,
): Promise<number> {
  const { count, error } = await db
    .from("suggested_competitors")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "pending");

  if (error) throw error;
  return count ?? 0;
}

export async function countOwnCreativeFeatures(
  userId: string,
  db: Db,
): Promise<number> {
  const { count, error } = await db
    .from("creative_features")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;
  return count ?? 0;
}

export async function countCompetitorCreativeFeatures(
  userId: string,
  db: Db,
): Promise<number> {
  const { count, error } = await db
    .from("competitor_creative_features")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;
  return count ?? 0;
}

/**
 * The brand context competitor_discover() reasons from. A thin, explicitly
 * scoped read rather than reusing ad-concepts' `getBrandProfile()` — that
 * function is session-only (`createClient()`, no userId/db param) and used
 * by several other call sites, so extending it risks behaviour those don't
 * expect; a small dedicated read here is lower-risk than widening a shared
 * one for a single new caller.
 */
export async function getBrandProfileForUser(userId: string, db: Db) {
  const { data, error } = await db
    .from("brand_profiles")
    .select(
      "brand_name, brand_category, target_audience, markets, languages, usps, materials, price_positioning, product_positioning, brand_values, tone_attributes",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * `launch_batches.status` is the closest existing signal to "approval
 * state" — there is no dedicated Approval Service table yet (Phase 3). This
 * reports batch/launch-creation status honestly, not a real approval-gate
 * state, until that service exists.
 */
export async function getLaunchBatchStatus(
  batchId: string,
  userId: string,
  db: Db,
) {
  const { data, error } = await db
    .from("launch_batches")
    .select("id, status, ad_status, campaign_name, created_at")
    .eq("id", batchId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
