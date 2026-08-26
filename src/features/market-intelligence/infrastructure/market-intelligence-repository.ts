import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { FeatureRow } from "@/features/market-intelligence/domain/whitespace-analysis";
import type { Database } from "@/types/supabase";

/**
 * Reads for the whitespace synthesis, queried directly against
 * creative_features and competitor_creative_features rather than by
 * importing creative-intelligence's or competitor-analysis's repository
 * functions — this codebase's convention for cross-feature reads: at the
 * database, not through another feature's code (see ad-concepts' inspiration
 * lookup for the precedent).
 */

export type Db = SupabaseClient<Database>;

async function resolve(db?: Db): Promise<Db> {
  return db ?? ((await createClient()) as unknown as Db);
}

/** PostgREST's own ceiling is 1000; paging at that size minimises round trips. */
const PAGE_SIZE = 1000;

async function fetchAllRows<Row>(query: {
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;
}): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Every creative_features row this user has.
 *
 * No evidence-tier filter needed here: DNA analysis already refuses to run on
 * anything below `directional` (see creative-intelligence's isWorthAnalysing),
 * so every row that exists already cleared that gate.
 */
export async function listOwnFeatures(
  userId: string,
  db?: Db,
): Promise<FeatureRow[]> {
  const supabase = await resolve(db);
  return fetchAllRows(
    supabase
      .from("creative_features")
      .select("id, hook_type, angle, offer_type, emotional_driver")
      .eq("user_id", userId)
      .order("id", { ascending: true }),
  );
}

/**
 * The advertiser behind each tracked competitor page, keyed by the landing
 * page its ads actually point at.
 *
 * The page name cannot do this job. Three advertisers ran all 141 competitor
 * ads here through persona pages — "Dr. Cindy Stafford", "The Wellness
 * Digest", "Sarah Walker" — and only the destination reveals that they are
 * one advertiser. The name is what someone typed when adding the competitor;
 * the domain is a fact about the ad.
 *
 * A page whose ads carry no landing page falls back to its own id, so it
 * counts as its own advertiser. That is the conservative direction: it can
 * split one advertiser into several, which understates how concentrated the
 * market is, where the opposite would invent breadth that isn't there.
 */
async function advertiserByCompetitor(
  userId: string,
  db: Db,
): Promise<Map<string, string>> {
  const ads = await fetchAllRows<{
    id: string;
    competitor_id: string;
    landing_page_url: string | null;
  }>(
    db
      .from("competitor_ads")
      .select("id, competitor_id, landing_page_url, competitors!inner(user_id)")
      .eq("competitors.user_id", userId)
      .order("id", { ascending: true }),
  );

  const domainsPerCompetitor = new Map<string, Map<string, number>>();
  for (const ad of ads) {
    if (!ad.landing_page_url) continue;
    let host: string;
    try {
      host = new URL(ad.landing_page_url).hostname.toLowerCase();
    } catch {
      continue;
    }
    host = host.replace(/^www\./, "");
    const counts = domainsPerCompetitor.get(ad.competitor_id) ?? new Map();
    counts.set(host, (counts.get(host) ?? 0) + 1);
    domainsPerCompetitor.set(ad.competitor_id, counts);
  }

  const result = new Map<string, string>();
  for (const ad of ads) {
    if (result.has(ad.competitor_id)) continue;
    const counts = domainsPerCompetitor.get(ad.competitor_id);
    // The competitor's most common destination — a persona page occasionally
    // links elsewhere, and one stray link should not rename the advertiser.
    const dominant = counts
      ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : `competitor:${ad.competitor_id}`;
    result.set(ad.competitor_id, dominant);
  }
  return result;
}

export async function listCompetitorFeaturesForWhitespace(
  userId: string,
  db?: Db,
): Promise<FeatureRow[]> {
  const supabase = await resolve(db);
  const [rows, advertisers] = await Promise.all([
    fetchAllRows<{
      id: string;
      hook_type: string | null;
      angle: string | null;
      offer_type: string | null;
      emotional_driver: string | null;
      competitor_ads: { competitor_id: string } | null;
    }>(
      supabase
        .from("competitor_creative_features")
        .select(
          "id, hook_type, angle, offer_type, emotional_driver, competitor_ads(competitor_id)",
        )
        .eq("user_id", userId)
        .order("id", { ascending: true }),
    ),
    advertiserByCompetitor(userId, supabase),
  ]);

  return rows.map((row) => {
    const competitorId = row.competitor_ads?.competitor_id;
    return {
      hook_type: row.hook_type,
      angle: row.angle,
      offer_type: row.offer_type,
      emotional_driver: row.emotional_driver,
      advertiser: competitorId
        ? (advertisers.get(competitorId) ?? `competitor:${competitorId}`)
        : null,
    };
  });
}

/** The last cached run for this exact input, if the aggregation hasn't changed since. */
export async function findCachedRun(
  userId: string,
  analysisType: string,
  promptVersion: string,
  inputHash: string,
  db?: Db,
): Promise<{ id: string; result: unknown } | null> {
  const supabase = await resolve(db);
  const { data, error } = await supabase
    .from("analysis_runs")
    .select("id, result")
    .eq("user_id", userId)
    .eq("analysis_type", analysisType)
    .eq("prompt_version", promptVersion)
    .eq("input_hash", inputHash)
    .eq("status", "succeeded")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function recordRun(
  userId: string,
  run: {
    analysisType: string;
    subjectType: string;
    subjectId: string | null;
    model: string;
    promptVersion: string;
    inputHash: string;
    status: "succeeded" | "failed";
    inputTokens?: number;
    outputTokens?: number;
    durationMs?: number;
    error?: string;
    result?: unknown;
  },
  db?: Db,
): Promise<string | null> {
  const supabase = await resolve(db);
  const { data, error } = await supabase
    .from("analysis_runs")
    .insert({
      user_id: userId,
      analysis_type: run.analysisType,
      subject_type: run.subjectType,
      subject_id: run.subjectId,
      model: run.model,
      prompt_version: run.promptVersion,
      input_hash: run.inputHash,
      status: run.status,
      input_tokens: run.inputTokens,
      output_tokens: run.outputTokens,
      duration_ms: run.durationMs,
      error: run.error,
      result: (run.result ?? null) as never,
    })
    .select("id")
    .maybeSingle();

  // 23505: this exact analysis already succeeded, which is the cache working.
  if (error?.code === "23505") return null;
  if (error) throw error;
  return data?.id ?? null;
}
