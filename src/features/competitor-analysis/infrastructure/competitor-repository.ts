import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type {
  ProviderId,
  RawCompetitorAd,
} from "@/features/competitor-analysis/domain/competitor-data-provider";
import type { Database, Tables } from "@/types/supabase";

/**
 * Which Supabase client a call runs against.
 *
 * Interactive requests pass nothing and get the session-scoped client, where
 * RLS does the scoping. The competitor-research cron job passes the
 * service-role client, because cron has no session and RLS would otherwise
 * hide every row — those callers are responsible for filtering by user_id
 * themselves. Same convention as creative-intelligence-repository.ts.
 */
export type Db = SupabaseClient<Database>;

async function resolve(db?: Db): Promise<Db> {
  return db ?? ((await createClient()) as unknown as Db);
}

/** PostgREST's own ceiling is 1000; paging at that size minimises round trips. */
const PAGE_SIZE = 1000;

/**
 * Reads every row a query matches, not the first thousand.
 *
 * See creative-intelligence-repository.ts's fetchAllRows for why this exists —
 * PostgREST silently truncates an unbounded select at 1000 rows.
 */
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

export type Competitor = Pick<
  Tables<"competitors">,
  "id" | "name" | "meta_page_id" | "website_url" | "created_at"
>;

/**
 * An ad plus its embedded analysis. The ad columns come from the generated
 * Row; the embed cannot, because PostgREST joins are query-specific.
 */
export type CompetitorAdWithAnalysis = Pick<
  Tables<"competitor_ads">,
  | "id"
  | "page_name"
  | "ad_creative_body"
  | "ad_creative_link_title"
  | "ad_creative_link_description"
  | "ad_snapshot_url"
  | "ad_delivery_start_time"
  | "ad_delivery_stop_time"
  | "is_active"
  | "first_seen_at"
> & {
  ad_analyses: Pick<
    Tables<"ad_analyses">,
    | "messaging_angle"
    | "hook"
    | "tone"
    | "target_audience"
    | "call_to_action"
    | "summary"
  > | null;
  competitor_creative_features: Pick<
    Tables<"competitor_creative_features">,
    | "hook_type"
    | "hook_text"
    | "angle"
    | "awareness_level"
    | "offer_type"
    | "offer_strength"
    | "emotional_driver"
    | "cta_style"
    | "observed_facts"
    | "inferred_hypotheses"
    | "confidence"
  > | null;
};

/**
 * Tracks a competitor.
 *
 * Both identifiers are optional individually but not together — a competitor
 * with neither a Meta Page ID nor a website is a name with nothing any
 * provider or research pass could act on. The Page ID stopped being required
 * once ads began arriving from sources other than the Meta Ad Library API
 * (see the migration that relaxed the column): automated discovery yields a
 * website, and `competitor_ads_submit` identifies ads by what Hermes
 * actually saw, not by a numeric Page ID.
 */
export async function createCompetitor(
  userId: string,
  name: string,
  identifiers: { metaPageId?: string | null; websiteUrl?: string | null },
  discoverySource: "manual" | "suggested" = "manual",
) {
  const metaPageId = identifiers.metaPageId ?? null;
  const websiteUrl = identifiers.websiteUrl ?? null;
  if (!metaPageId && !websiteUrl) {
    throw new Error(
      "A competitor needs either a Meta Page ID or a website — with neither there is nothing to research.",
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitors")
    .insert({
      user_id: userId,
      name,
      meta_page_id: metaPageId,
      website_url: websiteUrl,
      discovery_source: discoverySource,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data as { id: string };
}

export async function listCompetitors(
  /** See creative-intelligence-repository.ts's listScoredCreatives — required alongside `db` for session-less callers. */
  userId?: string,
  db?: Db,
): Promise<Competitor[]> {
  const supabase = await resolve(db);
  let query = supabase
    .from("competitors")
    .select("id, name, meta_page_id, website_url, created_at");
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) throw error;
  return data;
}

export async function getCompetitor(
  id: string,
  userId?: string,
  db?: Db,
): Promise<Competitor | null> {
  const supabase = await resolve(db);
  let query = supabase
    .from("competitors")
    .select("id, name, meta_page_id, website_url, created_at")
    .eq("id", id);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Writes ads from any provider, keyed on (provider, externalId) rather than
 * Meta's archive id — see the provider-generic migration and
 * domain/competitor-data-provider.ts for why. `meta_ad_archive_id` is still
 * populated when the source is Meta, for anything reading it directly.
 */
export async function upsertRawCompetitorAds(
  competitorId: string,
  provider: ProviderId,
  ads: RawCompetitorAd[],
  db?: Db,
) {
  if (ads.length === 0) return;

  const supabase = await resolve(db);
  const now = new Date().toISOString();
  const { error } = await supabase.from("competitor_ads").upsert(
    ads.map((ad) => ({
      competitor_id: competitorId,
      source_provider: provider,
      external_ad_id: ad.externalId,
      meta_ad_archive_id: provider === "meta_ad_library" ? ad.externalId : null,
      page_name: ad.pageName,
      ad_creative_body: ad.bodyText,
      ad_creative_link_title: ad.linkTitle,
      ad_creative_link_description: ad.linkDescription,
      ad_snapshot_url: ad.snapshotUrl,
      creative_image_url: ad.creativeImageUrl,
      creative_video_url: ad.creativeVideoUrl,
      landing_page_url: ad.landingPageUrl,
      ad_delivery_start_time: ad.firstSeenAt,
      ad_delivery_stop_time: ad.lastSeenAt,
      is_active: ad.isActive,
      last_seen_at: now,
      // first_seen_at is intentionally left out of the payload: the column
      // default sets it on first insert, and Postgres only updates columns
      // present in an upsert's ON CONFLICT SET — omitting it here is what
      // stops a refresh from resetting how long an ad has been tracked.
    })),
    { onConflict: "source_provider,external_ad_id" },
  );

  if (error) throw error;
}

export async function listAdsWithAnalysis(
  competitorId: string,
): Promise<CompetitorAdWithAnalysis[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitor_ads")
    .select(
      "id, page_name, ad_creative_body, ad_creative_link_title, ad_creative_link_description, ad_snapshot_url, ad_delivery_start_time, ad_delivery_stop_time, is_active, first_seen_at, ad_analyses(messaging_angle, hook, tone, target_audience, call_to_action, summary), competitor_creative_features(hook_type, hook_text, angle, awareness_level, offer_type, offer_strength, emotional_driver, cta_style, observed_facts, inferred_hypotheses, confidence)",
    )
    .eq("competitor_id", competitorId)
    .order("ad_delivery_start_time", { ascending: false });

  if (error) throw error;
  return data as unknown as CompetitorAdWithAnalysis[];
}

export async function getAd(adId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitor_ads")
    .select(
      "id, page_name, ad_creative_body, ad_creative_link_title, ad_creative_link_description, competitor_id",
    )
    .eq("id", adId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Competitor Creative DNA
// ---------------------------------------------------------------------------

export type CompetitorAdForDna = Pick<
  Tables<"competitor_ads">,
  | "id"
  | "page_name"
  | "ad_creative_body"
  | "ad_creative_link_title"
  | "ad_creative_link_description"
>;

/** Candidates for DNA analysis, most recent first. Capped, not exhaustive — the caller diffs against listAnalysedCompetitorAdIds and takes what's still needed. */
export async function listCompetitorAdsForDna(
  competitorId: string,
  limit: number,
  db?: Db,
): Promise<CompetitorAdForDna[]> {
  const supabase = await resolve(db);
  const { data, error } = await supabase
    .from("competitor_ads")
    .select(
      "id, page_name, ad_creative_body, ad_creative_link_title, ad_creative_link_description",
    )
    .eq("competitor_id", competitorId)
    .order("ad_delivery_start_time", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/** Ads that already have DNA, so a run skips what it has done. */
export async function listAnalysedCompetitorAdIds(
  userId: string,
  db?: Db,
): Promise<Set<string>> {
  const supabase = await resolve(db);
  const rows = await fetchAllRows(
    supabase
      .from("competitor_creative_features")
      .select("competitor_ad_id")
      .eq("user_id", userId)
      .order("competitor_ad_id", { ascending: true }),
  );
  return new Set(rows.map((row) => row.competitor_ad_id));
}

/**
 * Records one analysis attempt against the shared analysis_runs cache.
 *
 * Same table and same shape as creative-intelligence's recordAnalysisRun —
 * duplicated rather than imported, per this codebase's convention that
 * cross-feature reads happen at the database level, not by importing another
 * feature's repository functions.
 */
export async function recordCompetitorAnalysisRun(
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

export async function upsertCompetitorFeatures(
  userId: string,
  features: {
    competitorAdId: string;
    contentHash: string;
    analysisRunId: string | null;
    confidence: string;
    dna: Record<string, unknown>;
  },
  db?: Db,
): Promise<void> {
  const supabase = await resolve(db);
  const dna = features.dna as Record<string, never>;

  const { error } = await supabase.from("competitor_creative_features").upsert(
    {
      user_id: userId,
      competitor_ad_id: features.competitorAdId,
      content_hash: features.contentHash,
      analysis_run_id: features.analysisRunId,
      confidence: features.confidence,
      hook_type: dna.hookType,
      hook_text: dna.hookText,
      angle: dna.angle,
      awareness_level: dna.awarenessLevel,
      offer_type: dna.offerType,
      offer_strength: dna.offerStrength,
      emotional_driver: dna.emotionalDriver,
      cta_style: dna.ctaStyle,
      observed_facts: dna.observedFacts ?? [],
      inferred_hypotheses: dna.inferredHypotheses ?? [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "competitor_ad_id" },
  );

  if (error) throw error;
}

/** Every competitor feature row this user has, for the whitespace synthesis and dashboard panels. */
export async function listCompetitorFeatures(
  userId: string,
  db?: Db,
): Promise<Tables<"competitor_creative_features">[]> {
  const supabase = await resolve(db);
  return fetchAllRows(
    supabase
      .from("competitor_creative_features")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: true }),
  );
}

// ---------------------------------------------------------------------------
// Cron support
// ---------------------------------------------------------------------------

export type CompetitorForResearch = Pick<
  Tables<"competitors">,
  "id" | "user_id" | "name" | "meta_page_id" | "website_url" | "status"
>;

/** Every user's tracked, non-archived competitors — what the research cron walks. */
export async function listActiveCompetitorsForResearch(
  db?: Db,
): Promise<CompetitorForResearch[]> {
  const supabase = await resolve(db);
  return fetchAllRows(
    supabase
      .from("competitors")
      .select("id, user_id, name, meta_page_id, website_url, status")
      .eq("status", "active")
      .order("id", { ascending: true }),
  );
}

const JOB_NAME = "competitor_research";

/**
 * As stale as sync-performance's own claim (see
 * creative-intelligence-repository.ts's STALE_CLAIM_MS): a crashed process
 * should not block every future run's job_runs claim forever.
 */
const STALE_CLAIM_MS = 5 * 60 * 1000;

/**
 * Claims the competitor-research job for one user, or null if one is already
 * running for them.
 *
 * Reuses job_runs — the same single-flight ledger meta_sync claims — rather
 * than a parallel table, scoped by the existing
 * `(user_id, job_name) where status = 'running'` unique index. Duplicated
 * logic rather than an import of creative-intelligence's claimJobRun, per this
 * codebase's cross-feature convention.
 */
export async function claimCompetitorResearchJob(
  userId: string,
  trigger: "cron" | "manual",
  db?: Db,
): Promise<{ id: string } | null> {
  const supabase = await resolve(db);
  const { data, error } = await supabase
    .from("job_runs")
    .insert({ user_id: userId, job_name: JOB_NAME, status: "running", trigger })
    .select("id")
    .maybeSingle();

  if (!error) return data;
  if (error.code !== "23505") throw error;

  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const { data: reclaimed, error: reclaimError } = await supabase
    .from("job_runs")
    .update({ started_at: new Date().toISOString(), trigger })
    .eq("user_id", userId)
    .eq("job_name", JOB_NAME)
    .eq("status", "running")
    .lt("started_at", staleBefore)
    .select("id")
    .maybeSingle();

  if (reclaimError) throw reclaimError;
  return reclaimed;
}

export async function finishCompetitorResearchJob(
  jobRunId: string,
  update: {
    status: "succeeded" | "failed";
    processedCount?: number;
    error?: string;
  },
  db?: Db,
): Promise<void> {
  const supabase = await resolve(db);
  const { error } = await supabase
    .from("job_runs")
    .update({
      status: update.status,
      processed_count: update.processedCount,
      error: update.error ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobRunId);

  if (error) throw error;
}

export async function markCompetitorSynced(
  competitorId: string,
  db?: Db,
): Promise<void> {
  const supabase = await resolve(db);
  const { error } = await supabase
    .from("competitors")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", competitorId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Suggested competitors — flagged, never auto-promoted
// ---------------------------------------------------------------------------

export type SuggestedCompetitor = Pick<
  Tables<"suggested_competitors">,
  | "id"
  | "name"
  | "meta_page_id"
  | "reason"
  | "source"
  | "status"
  | "created_at"
>;

export async function createSuggestedCompetitor(
  userId: string,
  input: { name: string; metaPageId: string | null; reason: string },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("suggested_competitors").insert({
    user_id: userId,
    name: input.name,
    meta_page_id: input.metaPageId,
    reason: input.reason,
    source: "manual_search",
  });

  if (error) throw error;
}

export async function listPendingSuggestedCompetitors(): Promise<
  SuggestedCompetitor[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suggested_competitors")
    .select("id, name, meta_page_id, reason, source, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getSuggestedCompetitor(
  id: string,
): Promise<Pick<
  Tables<"suggested_competitors">,
  "id" | "name" | "meta_page_id" | "website_url" | "status"
> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suggested_competitors")
    .select("id, name, meta_page_id, website_url, status")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateSuggestedCompetitorStatus(
  id: string,
  status: "approved" | "dismissed",
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("suggested_competitors")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
