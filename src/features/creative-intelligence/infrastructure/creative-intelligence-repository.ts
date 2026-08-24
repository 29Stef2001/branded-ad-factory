import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { DailyInsight } from "@/features/creative-intelligence/domain/meta-metrics";
import type { MetaEntity } from "@/features/creative-intelligence/infrastructure/meta-graph-client";
import type {
  CreativeScore,
  MetricTotals,
} from "@/features/creative-intelligence/domain/scoring";
import type { Database, Tables } from "@/types/supabase";

/**
 * The platform's single store of advertising performance.
 *
 * Every later module — Creative Generator, Competitor Intelligence, Winning
 * Ads, Campaigns, Batch Generation — reads performance facts, attribution and
 * scores through this module rather than querying these tables directly. One
 * source of truth for the data means one place to fix when the meaning of a
 * number changes.
 */

/**
 * Which Supabase client a call runs against.
 *
 * Interactive requests pass nothing and get the session-scoped client, where
 * RLS does the scoping. Scheduled jobs pass the service-role client, because
 * cron has no session and RLS would otherwise hide every row — those callers
 * are responsible for filtering by user_id themselves, which is why every
 * function taking `db` also takes the userId explicitly.
 */
export type Db = SupabaseClient<Database>;

/** PostgREST's own ceiling is 1000; paging at that size minimises round trips. */
const PAGE_SIZE = 1000;

/**
 * Scopes a query to one user when the caller supplied an id.
 *
 * Interactive calls omit it and lean on RLS. Scheduled jobs run as service
 * role, where RLS is off — so they pass the id and this applies the filter that
 * would otherwise be missing. Applying it unconditionally would break the UI
 * path, which has no id to give.
 */
function scopedToUser<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  userId: string | undefined,
): T {
  return userId ? query.eq("user_id", userId) : query;
}

async function resolve(db?: Db): Promise<Db> {
  return db ?? ((await createClient()) as unknown as Db);
}

type MetaAdEntityTable = Tables<"meta_ad_entities">;
type CreativeLinkTable = Tables<"creative_links">;
type CreativeMetricTable = Tables<"creative_metrics">;
type JobRunTable = Tables<"job_runs">;

export type MetaAdEntityRow = Pick<
  MetaAdEntityTable,
  | "id"
  | "entity_type"
  | "meta_id"
  | "parent_meta_id"
  | "name"
  | "status"
  | "effective_status"
  | "creative_meta_id"
  | "thumbnail_url"
  | "perceptual_hash"
>;

export type CreativeLinkRow = Pick<
  CreativeLinkTable,
  | "id"
  | "meta_entity_id"
  | "concept_id"
  | "match_method"
  | "match_confidence"
  | "confirmed"
  | "created_at"
>;

export type CreativeMetricRow = Pick<
  CreativeMetricTable,
  | "id"
  | "concept_id"
  | "meta_entity_id"
  | "window_days"
  | "impressions"
  | "clicks"
  | "link_clicks"
  | "spend"
  | "purchases"
  | "revenue"
  | "ctr"
  | "ctr_lower_bound"
  | "cpc"
  | "cpm"
  | "cpa"
  | "roas"
  | "roas_shrunk"
  | "composite_score"
  | "primary_metric"
  | "evidence_tier"
  | "percentile_rank"
  | "computed_at"
>;

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

/**
 * Upserts a page of Meta objects.
 *
 * `first_seen_at` is deliberately not in the update list: it records when we
 * first saw the object, and refreshing it on every sync would erase that.
 */
export async function upsertMetaEntities(
  userId: string,
  entities: MetaEntity[],
  db?: Db,
  adAccountId?: string,
): Promise<void> {
  if (entities.length === 0) return;
  const supabase = await resolve(db);

  const { error } = await supabase.from("meta_ad_entities").upsert(
    entities.map((entity) => ({
      user_id: userId,
      entity_type: entity.entityType,
      meta_id: entity.metaId,
      parent_meta_id: entity.parentMetaId,
      name: entity.name,
      status: entity.status,
      effective_status: entity.effectiveStatus,
      creative_meta_id: entity.creativeMetaId,
      image_hash: entity.imageHash,
      thumbnail_url: entity.thumbnailUrl,
      // Which account this object belongs to. With one account it was
      // implicit; with several it is the difference between one brand's
      // ranking and everything pooled together.
      ad_account_id: adAccountId ?? null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "user_id,meta_id" },
  );

  if (error) throw error;
}

/** Ad-level entities, which are the only ones attribution and scoring care about. */
export async function listAdEntities(
  userId?: string,
  db?: Db,
): Promise<MetaAdEntityRow[]> {
  const supabase = await resolve(db);
  const { data, error } = await scopedToUser(
    supabase
      .from("meta_ad_entities")
      .select(
        "id, entity_type, meta_id, parent_meta_id, name, status, effective_status, creative_meta_id, thumbnail_url, perceptual_hash",
      )
      .eq("entity_type", "ad"),
    userId,
  ).order("name", { ascending: true });

  if (error) throw error;
  return data;
}

/** Meta ad id → our row id, for keying insights without a second round trip. */
export async function mapMetaAdIdsToEntityIds(
  userId?: string,
  db?: Db,
): Promise<Map<string, string>> {
  const supabase = await resolve(db);
  const { data, error } = await scopedToUser(
    supabase
      .from("meta_ad_entities")
      .select("id, meta_id")
      .eq("entity_type", "ad"),
    userId,
  );

  if (error) throw error;
  return new Map(data.map((row) => [row.meta_id, row.id]));
}

/** Ads we could fingerprint but have not yet. */
export async function listAdsNeedingHash(
  userId?: string,
  db?: Db,
  limit = 25,
): Promise<{ id: string; thumbnail_url: string | null }[]> {
  const supabase = await resolve(db);
  const { data, error } = await scopedToUser(
    supabase
      .from("meta_ad_entities")
      .select("id, thumbnail_url")
      .eq("entity_type", "ad")
      .is("perceptual_hash", null)
      .not("thumbnail_url", "is", null),
    userId,
  ).limit(limit);

  if (error) throw error;
  return data;
}

export async function setEntityPerceptualHash(
  entityId: string,
  hash: string,
  db?: Db,
): Promise<void> {
  const supabase = await resolve(db);
  const { error } = await supabase
    .from("meta_ad_entities")
    .update({ perceptual_hash: hash })
    .eq("id", entityId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

/** Creates the monthly partition covering a date, if it does not exist yet. */
export async function ensureInsightsPartition(
  statDate: string,
  db?: Db,
): Promise<void> {
  const supabase = await resolve(db);
  const { error } = await supabase.rpc("ensure_insights_partition", {
    target: statDate,
  });
  if (error) throw error;
}

/**
 * Upserts daily facts.
 *
 * Keyed on `(meta_entity_id, stat_date)` so re-fetching the restatement window
 * corrects rows rather than duplicating them — running the same sync twice is a
 * no-op, which is what lets a job be safely retried.
 */
export async function upsertDailyInsights(
  userId: string,
  rows: (DailyInsight & {
    metaEntityId: string;
    isFinal: boolean;
    adAccountId?: string;
  })[],
  db?: Db,
): Promise<void> {
  if (rows.length === 0) return;
  const supabase = await resolve(db);

  const { error } = await supabase.from("ad_insights_daily").upsert(
    rows.map((row) => ({
      user_id: userId,
      meta_entity_id: row.metaEntityId,
      stat_date: row.statDate,
      impressions: row.impressions,
      reach: row.reach,
      frequency: row.frequency,
      spend: row.spend,
      clicks: row.clicks,
      link_clicks: row.linkClicks,
      outbound_clicks: row.outboundClicks,
      landing_page_views: row.landingPageViews,
      post_engagements: row.postEngagements,
      purchases: row.purchases,
      revenue: row.revenue,
      add_to_cart: row.addToCart,
      add_to_cart_value: row.addToCartValue,
      initiate_checkout: row.initiateCheckout,
      initiate_checkout_value: row.initiateCheckoutValue,
      leads: row.leads,
      registrations: row.registrations,
      video_plays: row.videoPlays,
      video_p25: row.videoP25,
      video_p50: row.videoP50,
      video_p75: row.videoP75,
      video_p100: row.videoP100,
      video_thruplays: row.videoThruplays,
      is_final: row.isFinal,
      ad_account_id: row.adAccountId ?? null,
      synced_at: new Date().toISOString(),
    })),
    { onConflict: "meta_entity_id,stat_date" },
  );

  if (error) throw error;
}

export type EntityTotals = MetricTotals & {
  metaEntityId: string;
  conceptId: string | null;
  lastServedDate: string | null;
  /** Which account these facts came from, carried into the scores. */
  adAccountId: string | null;
};

/**
 * Totals per ad over a window, summed from the daily facts.
 *
 * Sums are pooled and rates derived afterwards — averaging the daily CTRs would
 * give the mean of ratios, which is not the ratio of the period.
 */
export async function totalsByEntity(
  windowDays: number,
  userId?: string,
  db?: Db,
): Promise<EntityTotals[]> {
  const supabase = await resolve(db);

  let query = scopedToUser(
    supabase
      .from("ad_insights_daily")
      .select(
        "meta_entity_id, stat_date, ad_account_id, impressions, clicks, link_clicks, spend, purchases, revenue, add_to_cart, initiate_checkout, landing_page_views",
      ),
    userId,
  );

  if (windowDays > 0) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    query = query.gte("stat_date", since);
  }

  // Paged explicitly. PostgREST caps a response at 1000 rows, and this table
  // grows by one row per ad per day — 38 ads over a 28-day window is already
  // past the cap. Without paging the totals would silently be computed from
  // part of the data and still look entirely plausible, which is the worst
  // shape a bug can take in a system whose whole job is measurement.
  type InsightRow = {
    meta_entity_id: string;
    stat_date: string;
    ad_account_id: string | null;
    impressions: number;
    clicks: number;
    link_clicks: number;
    spend: number;
    purchases: number;
    revenue: number;
    add_to_cart: number;
    initiate_checkout: number;
    landing_page_views: number;
  };

  const rows: InsightRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  const byEntity = new Map<string, EntityTotals>();
  for (const row of rows) {
    const existing = byEntity.get(row.meta_entity_id) ?? {
      metaEntityId: row.meta_entity_id,
      conceptId: null,
      lastServedDate: null,
      adAccountId: row.ad_account_id,
      impressions: 0,
      clicks: 0,
      linkClicks: 0,
      spend: 0,
      purchases: 0,
      revenue: 0,
      addToCart: 0,
      initiateCheckout: 0,
      landingPageViews: 0,
    };

    existing.impressions += Number(row.impressions);
    existing.clicks += Number(row.clicks);
    existing.linkClicks += Number(row.link_clicks);
    existing.spend += Number(row.spend);
    existing.purchases += Number(row.purchases);
    existing.revenue += Number(row.revenue);
    existing.addToCart += Number(row.add_to_cart);
    existing.initiateCheckout += Number(row.initiate_checkout);
    existing.landingPageViews += Number(row.landing_page_views);

    // Only days that actually delivered count as "last served" — a zero-
    // impression row is a reporting artefact, not evidence the ad ran.
    if (
      Number(row.impressions) > 0 &&
      (existing.lastServedDate === null ||
        row.stat_date > existing.lastServedDate)
    ) {
      existing.lastServedDate = row.stat_date;
    }

    byEntity.set(row.meta_entity_id, existing);
  }

  return [...byEntity.values()];
}

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

export type ConceptForMatchingRow = {
  id: string;
  concept_code: string | null;
  perceptual_hash: string | null;
};

/** Concepts an ad could belong to, with what attribution matches against. */
export async function listConceptsForMatching(
  userId?: string,
  db?: Db,
): Promise<ConceptForMatchingRow[]> {
  const supabase = await resolve(db);
  const { data, error } = await scopedToUser(
    supabase
      .from("ad_concepts")
      .select("id, concept_code, creative_generations(perceptual_hash)"),
    userId,
  ).order("created_at", { ascending: false });

  if (error) throw error;

  return data.map((concept) => {
    const generations = concept.creative_generations as unknown as {
      perceptual_hash: string | null;
    }[];
    return {
      id: concept.id,
      concept_code: concept.concept_code,
      // The most recent generation's hash represents the concept: it is the
      // image the user would have downloaded and uploaded to Meta.
      perceptual_hash:
        generations.find((g) => g.perceptual_hash)?.perceptual_hash ?? null,
    };
  });
}

export async function upsertCreativeLink(
  userId: string,
  link: {
    metaEntityId: string;
    conceptId: string;
    matchMethod: string;
    matchConfidence: number;
    confirmed: boolean;
  },
  db?: Db,
): Promise<void> {
  const supabase = await resolve(db);
  const { error } = await supabase.from("creative_links").upsert(
    {
      user_id: userId,
      meta_entity_id: link.metaEntityId,
      concept_id: link.conceptId,
      match_method: link.matchMethod,
      match_confidence: link.matchConfidence,
      confirmed: link.confirmed,
      confirmed_at: link.confirmed ? new Date().toISOString() : null,
    },
    { onConflict: "meta_entity_id,concept_id" },
  );

  if (error) throw error;
}

export async function listCreativeLinks(
  userId?: string,
  db?: Db,
): Promise<CreativeLinkRow[]> {
  const supabase = await resolve(db);
  const { data, error } = await scopedToUser(
    supabase
      .from("creative_links")
      .select(
        "id, meta_entity_id, concept_id, match_method, match_confidence, confirmed, created_at",
      ),
    userId,
  ).order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function setLinkConfirmed(
  linkId: string,
  confirmed: boolean,
): Promise<void> {
  const supabase = await resolve();
  const { error } = await supabase
    .from("creative_links")
    .update({
      confirmed,
      confirmed_at: confirmed ? new Date().toISOString() : null,
    })
    .eq("id", linkId);

  if (error) throw error;
}

export async function deleteCreativeLink(linkId: string): Promise<void> {
  const supabase = await resolve();
  const { error } = await supabase
    .from("creative_links")
    .delete()
    .eq("id", linkId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

export async function upsertCreativeMetrics(
  userId: string,
  rows: (CreativeScore & {
    conceptId: string | null;
    metaEntityId: string;
    windowDays: number;
    totals: MetricTotals;
    percentileRank: number | null;
    adAccountId: string | null;
  })[],
  db?: Db,
): Promise<void> {
  if (rows.length === 0) return;
  const supabase = await resolve(db);

  const { error } = await supabase.from("creative_metrics").upsert(
    rows.map((row) => ({
      user_id: userId,
      concept_id: row.conceptId,
      meta_entity_id: row.metaEntityId,
      // Without this every score is unattributable to a brand, and filtering
      // the DNA page by account finds almost nothing.
      ad_account_id: row.adAccountId,
      window_days: row.windowDays,
      impressions: row.totals.impressions,
      clicks: row.totals.clicks,
      link_clicks: row.totals.linkClicks,
      spend: row.totals.spend,
      purchases: row.totals.purchases,
      revenue: row.totals.revenue,
      add_to_cart: row.totals.addToCart,
      initiate_checkout: row.totals.initiateCheckout,
      landing_page_views: row.totals.landingPageViews,
      ctr: row.ctr,
      ctr_lower_bound: row.ctrLowerBound,
      link_ctr: row.linkCtr,
      cpc: row.cpc,
      cpm: row.cpm,
      cpa: row.cpa,
      roas: row.roas,
      roas_shrunk: row.roasShrunk,
      conversion_rate: row.conversionRate,
      composite_score: row.compositeScore,
      primary_metric: row.primaryMetric,
      evidence_tier: row.evidenceTier,
      percentile_rank: row.percentileRank,
      computed_at: new Date().toISOString(),
    })),
    // Keyed on the ad and the window only. concept_id was in this key and
    // is nullable, and Postgres treats NULLs as distinct in a unique
    // constraint — so an unattributed ad never matched and every sync
    // inserted a duplicate set.
    { onConflict: "meta_entity_id,window_days" },
  );

  if (error) throw error;
}

/**
 * Scored creatives for a window, best first.
 *
 * The read path every dashboard and every later module uses. It hits the
 * rollup, never the daily facts, which is what keeps a page render cheap at a
 * million creatives.
 */
export async function listScoredCreatives(windowDays = 30): Promise<
  (CreativeMetricRow & {
    concept_headline: string | null;
    ad_name: string | null;
  })[]
> {
  const supabase = await resolve();
  const { data, error } = await supabase
    .from("creative_metrics")
    .select(
      "id, concept_id, meta_entity_id, window_days, impressions, clicks, link_clicks, spend, purchases, revenue, ctr, ctr_lower_bound, cpc, cpm, cpa, roas, roas_shrunk, composite_score, primary_metric, evidence_tier, percentile_rank, computed_at, ad_concepts(headline), meta_ad_entities(name)",
    )
    .eq("window_days", windowDays)
    .order("composite_score", { ascending: false, nullsFirst: false });

  if (error) throw error;

  // Evidence outranks score. The domain already refuses to rank an
  // `insufficient` creative — percentileRanks drops them — but the table was
  // still sorting on score alone, so an ad with two impressions and one click
  // sat second in a list captioned "best first". Position reads louder than a
  // badge, so the ordering has to agree with the badge rather than contradict
  // it.
  const TIER_ORDER = { confident: 0, directional: 1, insufficient: 2 } as const;
  const ordered = [...data].sort((a, b) => {
    const tierDelta =
      (TIER_ORDER[a.evidence_tier as keyof typeof TIER_ORDER] ?? 3) -
      (TIER_ORDER[b.evidence_tier as keyof typeof TIER_ORDER] ?? 3);
    if (tierDelta !== 0) return tierDelta;
    return Number(b.composite_score ?? 0) - Number(a.composite_score ?? 0);
  });

  return ordered.map((row) => {
    const concept = row.ad_concepts as unknown as { headline: string } | null;
    const entity = row.meta_ad_entities as unknown as { name: string } | null;
    return {
      ...row,
      concept_headline: concept?.headline ?? null,
      ad_name: entity?.name ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Job ledger
// ---------------------------------------------------------------------------

export type JobRunRow = Pick<
  JobRunTable,
  | "id"
  | "job_name"
  | "status"
  | "cursor"
  | "processed_count"
  | "started_at"
  | "finished_at"
  | "error"
>;

/**
 * A run older than this cannot still be alive.
 *
 * The handler budgets 45 seconds against a 60-second platform ceiling, so
 * anything still marked running after five minutes is a row left behind by a
 * process that died, not work in progress.
 */
const STALE_CLAIM_MS = 5 * 60 * 1000;

/**
 * Claims a job, or returns null when one is genuinely already running.
 *
 * The partial unique index on `(user_id, job_name) where status = 'running'`
 * does the enforcing, so two overlapping cron invocations cannot both ingest
 * the same window. The insert failing is the expected outcome, not an error.
 *
 * A crashed process never gets to write its own ending, though, and the row it
 * leaves behind would block every future run for ever — which is not
 * hypothetical: the dev server died mid-sync while this was being built. So a
 * claim older than STALE_CLAIM_MS is taken over rather than respected. The
 * takeover is itself conditional on the row still being `running`, so two
 * invocations racing to reclaim the same corpse cannot both win.
 */
export async function claimJobRun(
  userId: string,
  jobName: string,
  trigger: "cron" | "manual",
  db?: Db,
): Promise<JobRunRow | null> {
  const supabase = await resolve(db);
  const columns =
    "id, job_name, status, cursor, processed_count, started_at, finished_at, error";

  const { data, error } = await supabase
    .from("job_runs")
    .insert({ user_id: userId, job_name: jobName, status: "running", trigger })
    .select(columns)
    .maybeSingle();

  if (!error) return data;
  // 23505: someone holds the claim. It may or may not still be alive.
  if (error.code !== "23505") throw error;

  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const { data: reclaimed, error: reclaimError } = await supabase
    .from("job_runs")
    .update({ started_at: new Date().toISOString(), trigger })
    .eq("user_id", userId)
    .eq("job_name", jobName)
    .eq("status", "running")
    .lt("started_at", staleBefore)
    .select(columns)
    .maybeSingle();

  if (reclaimError) throw reclaimError;
  // Null means the holder is recent enough to still be working.
  return reclaimed;
}

export async function finishJobRun(
  jobRunId: string,
  update: {
    status: "succeeded" | "failed" | "partial";
    processedCount?: number;
    cursor?: unknown;
    error?: string;
  },
  db?: Db,
): Promise<void> {
  const supabase = await resolve(db);
  const { data, error } = await supabase
    .from("job_runs")
    .update({
      status: update.status,
      processed_count: update.processedCount,
      cursor:
        update.cursor === undefined ? undefined : (update.cursor as never),
      error: update.error ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobRunId)
    .select("user_id, job_name")
    .maybeSingle();

  if (error) throw error;

  // A completed pass makes every earlier partial obsolete. Left alone they stay
  // `partial` for ever, so the next run resumes from a cursor belonging to a
  // cycle that already finished — re-walking accounts that are up to date while
  // never reaching the ones that are not. They are closed rather than deleted:
  // they were real steps in a pass that has now completed.
  if (update.status === "succeeded" && data) {
    const { error: closeError } = await supabase
      .from("job_runs")
      .update({ status: "succeeded", cursor: null })
      .eq("user_id", data.user_id)
      .eq("job_name", data.job_name)
      .eq("status", "partial")
      .neq("id", jobRunId);

    if (closeError) throw closeError;
  }
}

/** The cursor a partial run left behind, so the next invocation resumes. */
/**
 * Where the last unfinished run stopped.
 *
 * Filters on `status = 'partial'` in the query rather than taking the newest
 * row and checking afterwards. The caller has already claimed this run, so a
 * row with status 'running' exists with a timestamp from the same instant —
 * and "newest row" would sometimes pick that one, find it is not partial, and
 * report no cursor. The sync then restarted from the first account.
 *
 * That was not a rare race. Four consecutive runs over thirty accounts each
 * re-synced around 1,500 rows and the cursor wandered 9 → 7 → 8 → 9 instead of
 * advancing: progress was partly luck, and a large account set might never
 * have finished.
 */
export async function lastCursorFor(
  jobName: string,
  userId?: string,
  db?: Db,
): Promise<Record<string, unknown> | null> {
  const supabase = await resolve(db);
  const { data, error } = await scopedToUser(
    supabase
      .from("job_runs")
      .select("cursor")
      .eq("job_name", jobName)
      .eq("status", "partial"),
    userId,
  )
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.cursor as Record<string, unknown> | null) ?? null;
}

export async function listRecentJobRuns(limit = 10): Promise<JobRunRow[]> {
  const supabase = await resolve();
  const { data, error } = await supabase
    .from("job_runs")
    .select(
      "id, job_name, status, cursor, processed_count, started_at, finished_at, error",
    )
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Ad accounts and Pages
// ---------------------------------------------------------------------------

export type AdAccountRow = Pick<
  Tables<"meta_ad_accounts">,
  | "id"
  | "ad_account_id"
  | "name"
  | "currency"
  | "account_status"
  | "business_name"
  | "is_selected"
  | "is_default"
>;

export type PageRow = Pick<
  Tables<"meta_pages">,
  "id" | "page_id" | "name" | "instagram_actor_id" | "is_default"
>;

/** Meta's code for an account that can actually run ads. */
export const ACCOUNT_STATUS_ACTIVE = 1;

/**
 * Refreshes the account catalogue.
 *
 * Selection flags are deliberately absent from the update: this runs on every
 * sync, and overwriting `is_selected` would undo the user's choices each time.
 * A returning account keeps whatever it was set to; only its name, status and
 * currency are refreshed.
 */
export async function upsertAdAccounts(
  userId: string,
  accounts: {
    adAccountId: string;
    name: string | null;
    currency: string | null;
    accountStatus: number | null;
    businessName: string | null;
  }[],
  db?: Db,
): Promise<void> {
  if (accounts.length === 0) return;
  const supabase = await resolve(db);

  const { error } = await supabase.from("meta_ad_accounts").upsert(
    accounts.map((account) => ({
      user_id: userId,
      ad_account_id: account.adAccountId,
      name: account.name,
      currency: account.currency,
      account_status: account.accountStatus,
      business_name: account.businessName,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "user_id,ad_account_id", ignoreDuplicates: false },
  );

  if (error) throw error;
}

export async function listAdAccounts(
  userId?: string,
  db?: Db,
): Promise<AdAccountRow[]> {
  const supabase = await resolve(db);
  const { data, error } = await scopedToUser(
    supabase
      .from("meta_ad_accounts")
      .select(
        "id, ad_account_id, name, currency, account_status, business_name, is_selected, is_default",
      ),
    userId,
  ).order("name", { ascending: true });

  if (error) throw error;
  return data;
}

/** The accounts the sync and the launcher actually work with. */
export async function listSelectedAdAccounts(
  userId?: string,
  db?: Db,
): Promise<AdAccountRow[]> {
  const supabase = await resolve(db);
  const { data, error } = await scopedToUser(
    supabase
      .from("meta_ad_accounts")
      .select(
        "id, ad_account_id, name, currency, account_status, business_name, is_selected, is_default",
      )
      .eq("is_selected", true),
    userId,
  ).order("name", { ascending: true });

  if (error) throw error;
  return data;
}

export async function setAdAccountSelected(
  adAccountId: string,
  selected: boolean,
): Promise<void> {
  const supabase = await resolve();
  const { error } = await supabase
    .from("meta_ad_accounts")
    .update({ is_selected: selected, updated_at: new Date().toISOString() })
    .eq("ad_account_id", adAccountId);

  if (error) throw error;
}

/**
 * Selects every account that can actually run ads.
 *
 * Disabled accounts are left out rather than selected and skipped later: they
 * cannot be launched into and syncing them spends API calls to learn nothing.
 */
export async function selectAllActiveAdAccounts(
  userId: string,
  db?: Db,
): Promise<number> {
  const supabase = await resolve(db);
  const { data, error } = await supabase
    .from("meta_ad_accounts")
    .update({ is_selected: true, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("account_status", ACCOUNT_STATUS_ACTIVE)
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}

/**
 * Makes one account the default, clearing any previous one.
 *
 * Two statements rather than one because a partial unique index enforces a
 * single default per user: setting the new one first would collide with the
 * old.
 */
export async function setDefaultAdAccount(
  userId: string,
  adAccountId: string,
): Promise<void> {
  const supabase = await resolve();

  const { error: clearError } = await supabase
    .from("meta_ad_accounts")
    .update({ is_default: false })
    .eq("user_id", userId)
    .eq("is_default", true);
  if (clearError) throw clearError;

  const { error } = await supabase
    .from("meta_ad_accounts")
    .update({ is_default: true, is_selected: true })
    .eq("user_id", userId)
    .eq("ad_account_id", adAccountId);
  if (error) throw error;
}

export async function upsertPages(
  userId: string,
  pages: {
    pageId: string;
    name: string | null;
    pageAccessToken: string | null;
    instagramActorId: string | null;
  }[],
  db?: Db,
): Promise<void> {
  if (pages.length === 0) return;
  const supabase = await resolve(db);

  const { error } = await supabase.from("meta_pages").upsert(
    pages.map((page) => ({
      user_id: userId,
      page_id: page.pageId,
      name: page.name,
      page_access_token: page.pageAccessToken,
      instagram_actor_id: page.instagramActorId,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "user_id,page_id" },
  );

  if (error) throw error;
}

export async function listPages(userId?: string, db?: Db): Promise<PageRow[]> {
  const supabase = await resolve(db);
  const { data, error } = await scopedToUser(
    supabase
      .from("meta_pages")
      .select("id, page_id, name, instagram_actor_id, is_default"),
    userId,
  ).order("name", { ascending: true });

  if (error) throw error;
  return data;
}

export async function setDefaultPage(
  userId: string,
  pageId: string,
): Promise<void> {
  const supabase = await resolve();

  const { error: clearError } = await supabase
    .from("meta_pages")
    .update({ is_default: false })
    .eq("user_id", userId)
    .eq("is_default", true);
  if (clearError) throw clearError;

  const { error } = await supabase
    .from("meta_pages")
    .update({ is_default: true })
    .eq("user_id", userId)
    .eq("page_id", pageId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Creative DNA
// ---------------------------------------------------------------------------

export type CreativeFeatureRow = Pick<
  Tables<"creative_features">,
  | "id"
  | "meta_entity_id"
  | "hook_type"
  | "hook_text"
  | "angle"
  | "awareness_level"
  | "offer_type"
  | "offer_strength"
  | "emotional_driver"
  | "format"
  | "composition"
  | "visual_pattern"
  | "has_person"
  | "shows_product"
  | "text_on_image"
  | "proof_type"
  | "brightness"
  | "why_it_works"
  | "created_at"
>;

/**
 * Creatives worth analysing, best first.
 *
 * Joined to their scores because the analysis is only meaningful beside them —
 * and ordered by score so a budget-limited run spends what it has on the ads
 * that actually matter.
 */
export async function listCreativesForDna(
  /**
   * Optional, and normally omitted.
   *
   * RLS already scopes this table to the caller, so the interactive path does
   * not need it — and requiring it added a way to return nothing at all when a
   * session lookup came back empty, which is exactly what happened. Jobs
   * running as service role pass it, because there RLS is off.
   */
  userId: string | undefined,
  tiers: string[],
  limit: number,
  /**
   * Scoped to the chosen accounts.
   *
   * Empty means none: nothing is read until a choice is made. Reading every
   * account together would count a jewellery hook and a headwear hook as the
   * same finding, which is how a tally stops meaning anything — but several
   * accounts for one brand belong together, so this takes a list rather than
   * one.
   */
  adAccountIds: string[],
  db?: Db,
): Promise<
  {
    metaEntityId: string;
    metaAdId: string;
    adAccountId: string | null;
    adName: string;
    thumbnailUrl: string | null;
    impressions: number;
    clicks: number;
    spend: number;
    purchases: number;
    revenue: number;
    ctr: number | null;
    roas: number | null;
    evidenceTier: string;
  }[]
> {
  const supabase = await resolve(db);

  const query = supabase
    .from("creative_metrics")
    .select(
      "meta_entity_id, ad_account_id, impressions, clicks, spend, purchases, revenue, ctr, roas, evidence_tier, meta_ad_entities(name, meta_id, thumbnail_url)",
    )
    .eq("window_days", 30)
    .in("evidence_tier", tiers);

  if (adAccountIds.length === 0) return [];
  const scoped = scopedToUser(query, userId).in("ad_account_id", adAccountIds);

  const { data, error } = await scoped
    .order("composite_score", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const entity = row.meta_ad_entities as unknown as {
        name: string;
        meta_id: string;
        thumbnail_url: string | null;
      } | null;
      if (!row.meta_entity_id || !entity?.thumbnail_url) return null;

      return {
        metaEntityId: row.meta_entity_id,
        metaAdId: entity.meta_id,
        adAccountId: row.ad_account_id,
        adName: entity.name,
        thumbnailUrl: entity.thumbnail_url,
        impressions: Number(row.impressions),
        clicks: Number(row.clicks),
        spend: Number(row.spend),
        purchases: Number(row.purchases),
        revenue: Number(row.revenue),
        ctr: row.ctr === null ? null : Number(row.ctr),
        roas: row.roas === null ? null : Number(row.roas),
        evidenceTier: row.evidence_tier,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

/** Entities that already have DNA, so a run skips what it has done. */
export async function listAnalysedEntityIds(
  userId: string,
  db?: Db,
): Promise<Set<string>> {
  const supabase = await resolve(db);
  const { data, error } = await supabase
    .from("creative_features")
    .select("meta_entity_id, content_hash")
    .eq("user_id", userId);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.meta_entity_id));
}

export async function recordAnalysisRun(
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

export async function upsertCreativeFeatures(
  userId: string,
  features: {
    metaEntityId: string;
    contentHash: string;
    analysisRunId: string | null;
    dna: Record<string, unknown>;
  },
  db?: Db,
): Promise<void> {
  const supabase = await resolve(db);
  const dna = features.dna as Record<string, never>;

  const { error } = await supabase.from("creative_features").upsert(
    {
      user_id: userId,
      meta_entity_id: features.metaEntityId,
      content_hash: features.contentHash,
      analysis_run_id: features.analysisRunId,
      hook_type: dna.hookType,
      hook_text: dna.hookText,
      angle: dna.angle,
      awareness_level: dna.awarenessLevel,
      offer_type: dna.offerType,
      offer_strength: dna.offerStrength,
      emotional_driver: dna.emotionalDriver,
      format: dna.format,
      composition: dna.composition,
      visual_pattern: dna.visualPattern,
      has_person: dna.hasPerson,
      shows_product: dna.showsProduct,
      text_on_image: dna.textOnImage,
      proof_type: dna.proofType,
      dominant_colors: dna.dominantColors,
      brightness: dna.brightness,
      why_it_works: dna.whyItWorks,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "meta_entity_id" },
  );

  if (error) throw error;
}

export async function listCreativeFeatures(
  adAccountIds: string[],
  db?: Db,
): Promise<(CreativeFeatureRow & { ad_name: string | null })[]> {
  if (adAccountIds.length === 0) return [];

  const supabase = await resolve(db);
  const { data, error } = await supabase
    .from("creative_features")
    .select(
      "id, meta_entity_id, hook_type, hook_text, angle, awareness_level, offer_type, offer_strength, emotional_driver, format, composition, visual_pattern, has_person, shows_product, text_on_image, proof_type, brightness, why_it_works, created_at, meta_ad_entities(name, ad_account_id)",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (
    (data ?? [])
      .map((row) => {
        const entity = row.meta_ad_entities as unknown as {
          name: string;
          ad_account_id: string | null;
        } | null;
        return {
          ...row,
          ad_name: entity?.name ?? null,
          _account: entity?.ad_account_id ?? null,
        };
      })
      // Filtered here rather than in the query: the account lives on the joined
      // entity, and PostgREST cannot filter a parent by a child column without a
      // view. At this volume the difference is not measurable.
      .filter(
        (row) => row._account !== null && adAccountIds.includes(row._account),
      )
      .map(({ _account: _drop, ...row }) => row)
  );
}
