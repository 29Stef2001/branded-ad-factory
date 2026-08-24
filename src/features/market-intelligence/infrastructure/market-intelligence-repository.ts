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

export async function listCompetitorFeaturesForWhitespace(
  userId: string,
  db?: Db,
): Promise<FeatureRow[]> {
  const supabase = await resolve(db);
  return fetchAllRows(
    supabase
      .from("competitor_creative_features")
      .select("id, hook_type, angle, offer_type, emotional_driver")
      .eq("user_id", userId)
      .order("id", { ascending: true }),
  );
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
