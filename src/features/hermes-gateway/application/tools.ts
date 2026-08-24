import {
  listScoredCreatives,
  listCreativeFeatures,
} from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";
import { dnaLabel } from "@/features/creative-intelligence/domain/creative-dna";
import type { EvidenceTier } from "@/features/creative-intelligence/domain/scoring";
import {
  listCompetitors,
  listCompetitorFeatures,
} from "@/features/competitor-analysis/infrastructure/competitor-repository";
import { researchCompetitorAds } from "@/features/competitor-analysis/application/research-competitor";
import { getWhitespaceView } from "@/features/market-intelligence/application/synthesize-whitespace";
import {
  countCompetitorCreativeFeatures,
  countCompetitors,
  countOwnCreativeFeatures,
  countPendingSuggestions,
  getLastCompetitorResearchStatus,
  getLastSyncStatus,
  getLaunchBatchStatus,
  type Db,
} from "@/features/hermes-gateway/infrastructure/queries";

/**
 * The 8 read-only tool handlers. Every one is a thin composition of
 * already-tested application/repository functions — no scoring, ranking, or
 * DNA logic is reimplemented here. Each takes `(userId, db)` explicitly:
 * there is no Supabase session on an MCP request, so tenant scope has to be
 * threaded through by hand rather than picked up from RLS.
 */

export async function metaGetWinners(
  input: { windowDays: number; limit: number },
  userId: string,
  db: Db,
) {
  const scored = await listScoredCreatives(input.windowDays, userId, db);
  const top = scored
    .filter((row) => row.evidence_tier !== "insufficient")
    .slice(0, input.limit);

  return {
    windowDays: input.windowDays,
    totalScored: scored.length,
    returned: top.length,
    winners: top.map((row) => ({
      id: row.id,
      name: row.concept_headline ?? row.ad_name ?? "Unnamed ad",
      compositeScore: row.composite_score,
      evidenceTier: row.evidence_tier as EvidenceTier,
      primaryMetric: row.primary_metric,
      impressions: Number(row.impressions),
      spend: Number(row.spend),
      roas: row.roas === null ? null : Number(row.roas),
      metaEntityId: row.meta_entity_id,
    })),
  };
}

export async function metaGetCreativeDna(
  input: { adAccountIds: string[] },
  userId: string,
  db: Db,
) {
  const features = await listCreativeFeatures(input.adAccountIds, db, userId);
  return {
    count: features.length,
    creatives: features.map((f) => ({
      id: f.id,
      adName: f.ad_name,
      hookType: dnaLabel(f.hook_type),
      angle: dnaLabel(f.angle),
      awarenessLevel: dnaLabel(f.awareness_level),
      visualPattern: dnaLabel(f.visual_pattern),
      offerType: dnaLabel(f.offer_type),
      whyItWorks: f.why_it_works ?? [],
    })),
  };
}

export async function competitorList(userId: string, db: Db) {
  const competitors = await listCompetitors(userId, db);
  return {
    count: competitors.length,
    competitors: competitors.map((c) => ({
      id: c.id,
      name: c.name,
      metaPageId: c.meta_page_id,
      websiteUrl: c.website_url,
    })),
  };
}

export async function competitorResearch(
  input: { competitorId: string },
  userId: string,
  db: Db,
) {
  // Ownership check before doing anything: a competitorId that doesn't
  // belong to this tenant must fail closed, not silently research (and
  // write into) another tenant's data.
  const competitors = await listCompetitors(userId, db);
  const competitor = competitors.find((c) => c.id === input.competitorId);
  if (!competitor) {
    throw new Error(
      `No competitor ${input.competitorId} found for this tenant.`,
    );
  }

  const outcome = await researchCompetitorAds(
    competitor.id,
    {
      name: competitor.name,
      metaPageId: competitor.meta_page_id,
      websiteUrl: competitor.website_url,
    },
    db,
  );

  return {
    competitorId: competitor.id,
    competitorName: competitor.name,
    totalAdsFound: outcome.totalAdsFound,
    providers: outcome.results.map((r) => ({
      provider: r.provider,
      status: r.status,
      adsFound: r.ads.length,
      message: r.message,
    })),
  };
}

export async function competitorGetCreativeDna(userId: string, db: Db) {
  const features = await listCompetitorFeatures(userId, db);
  return {
    count: features.length,
    creatives: features.map((f) => ({
      id: f.id,
      competitorAdId: f.competitor_ad_id,
      hookType: dnaLabel(f.hook_type),
      angle: dnaLabel(f.angle),
      offerType: dnaLabel(f.offer_type),
      ctaStyle: dnaLabel(f.cta_style),
      confidence: f.confidence,
      observedFacts: f.observed_facts,
      inferredHypotheses: f.inferred_hypotheses,
    })),
  };
}

export async function competitorGetWhitespace(userId: string, db: Db) {
  const view = await getWhitespaceView(userId, db);
  return {
    ourSampleSize: view.result.oursSampleSize,
    competitorSampleSize: view.result.theirsSampleSize,
    sharedPatterns: view.result.sharedPatterns,
    competitorLeaning: view.result.competitorLeaning,
    whitespace: view.result.whitespace,
    observations: view.observations,
  };
}

export async function factoryGetStatus(userId: string, db: Db) {
  const [
    lastSync,
    lastCompetitorResearch,
    competitors,
    pendingSuggestions,
    ownCreatives,
    competitorCreatives,
  ] = await Promise.all([
    getLastSyncStatus(userId, db),
    getLastCompetitorResearchStatus(userId, db),
    countCompetitors(userId, db),
    countPendingSuggestions(userId, db),
    countOwnCreativeFeatures(userId, db),
    countCompetitorCreativeFeatures(userId, db),
  ]);

  return {
    ownIntelligence: {
      lastSync,
      creativesAnalysed: ownCreatives,
    },
    competitorIntelligence: {
      lastResearch: lastCompetitorResearch,
      competitorsTracked: competitors,
      pendingSuggestions,
      creativesAnalysed: competitorCreatives,
    },
  };
}

export async function approvalGetStatus(
  input: { batchId: string },
  userId: string,
  db: Db,
) {
  const batch = await getLaunchBatchStatus(input.batchId, userId, db);
  if (!batch) {
    throw new Error(`No launch batch ${input.batchId} found for this tenant.`);
  }
  return {
    batchId: batch.id,
    // Honest label: there is no dedicated Approval Service yet (Phase 3).
    // This is launch-batch creation status, not an approval-gate state.
    status: batch.status,
    adStatus: batch.ad_status,
    campaignName: batch.campaign_name,
    createdAt: batch.created_at,
    note: "No Approval Service exists yet — this reflects launch-batch creation status, not a dedicated approval-gate state.",
  };
}
