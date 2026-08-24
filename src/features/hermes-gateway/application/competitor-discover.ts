import { discoverCompetitors } from "@/features/hermes-gateway/infrastructure/discovery-client";
import { getBrandProfileForUser } from "@/features/hermes-gateway/infrastructure/queries";
import { insertSuggestionIfNew } from "@/features/hermes-gateway/infrastructure/suggestion-writer";
import {
  isKnownName,
  normalizeCompetitorName,
} from "@/features/hermes-gateway/domain/discovery-dedup";
import type { DiscoveredCompetitor } from "@/features/hermes-gateway/domain/discovery-schema";
import {
  listCompetitors,
  type Db,
} from "@/features/competitor-analysis/infrastructure/competitor-repository";

/**
 * `competitor_discover()` — the one MCP tool that writes anything. Even so,
 * it only ever inserts into `suggested_competitors`: nothing here can create
 * a tracked competitor, exactly like the existing manual-flag flow
 * (`suggest-competitor.ts`). A human still approves each one before it
 * becomes real.
 *
 * Duplicate-safety under concurrency: earlier testing found that two
 * overlapping discovery calls (a client retry after a slow response, or two
 * concurrent Hermes tool calls) could both read "this name isn't suggested
 * yet" and both insert — a read-then-write race no amount of in-memory
 * checking can close, because the gap is between two separate database
 * round trips in two separate processes.
 *
 * The fix: `suggested_competitors` now has a unique index on
 * `(user_id, lower(btrim(name)))` (see the accompanying migration), and
 * every insert here is one row at a time, catching Postgres's `23505`
 * (unique violation) as "already suggested," not an error — the exact
 * pattern `recordAnalysisRun`/`recordCompetitorAnalysisRun` already use for
 * the same reason against `analysis_runs`' cache index. The in-memory
 * `knownNames` check below is a pre-filter that skips an obviously wasted
 * round trip; it is not what makes this safe. The reported counts are built
 * from what each insert actually did, not from the pre-filter's guess — so
 * even a stale pre-filter (another call inserted the same name a moment
 * ago) still produces an accurate result.
 */

export type CompetitorDiscoverResult = {
  brandName: string;
  candidatesGenerated: number;
  candidatesSuggested: number;
  candidatesSkippedAsDuplicate: number;
  suggestions: {
    name: string;
    competitorType: string;
    relevanceScore: number;
    relevanceReasoning: string;
    websiteUrl: string | null;
  }[];
};

export async function competitorDiscover(
  input: { maxCandidates: number },
  userId: string,
  db: Db,
): Promise<CompetitorDiscoverResult> {
  const brand = await getBrandProfileForUser(userId, db);
  if (!brand) {
    throw new Error(
      "No brand profile is set up for this workspace yet — competitor discovery needs brand_name/category/audience context to reason from.",
    );
  }

  const [discovery, existingCompetitors, existingSuggestions] =
    await Promise.all([
      discoverCompetitors(
        {
          brandName: brand.brand_name,
          brandCategory: brand.brand_category,
          targetAudience: brand.target_audience,
          markets: brand.markets,
          usps: brand.usps,
          materials: brand.materials,
          pricePositioning: brand.price_positioning,
          productPositioning: brand.product_positioning,
        },
        input.maxCandidates,
      ),
      listCompetitors(userId, db),
      db
        .from("suggested_competitors")
        .select("name")
        .eq("user_id", userId)
        .then(({ data, error }) => {
          if (error) throw error;
          return data;
        }),
    ]);

  // Pre-filter only — see module comment. Skips an obviously wasted insert
  // attempt; does not decide the final answer.
  const knownNames = new Set([
    ...existingCompetitors.map((c) => normalizeCompetitorName(c.name)),
    ...existingSuggestions.map((s) => normalizeCompetitorName(s.name)),
  ]);
  const worthTrying = discovery.candidates.filter(
    (c) => !isKnownName(c.name, knownNames),
  );

  // Sequential, not Promise.all: this is a handful of candidates (≤30), and
  // serializing the inserts keeps the connection footprint small without
  // sacrificing correctness — each row's atomicity comes from the unique
  // index, not from ordering.
  const inserted: DiscoveredCompetitor[] = [];
  for (const candidate of worthTrying) {
    if (await insertSuggestionIfNew(db, userId, candidate)) {
      inserted.push(candidate);
    }
  }

  const skipped = discovery.candidates.length - inserted.length;

  return {
    brandName: brand.brand_name,
    candidatesGenerated: discovery.candidates.length,
    candidatesSuggested: inserted.length,
    candidatesSkippedAsDuplicate: skipped,
    suggestions: inserted.map((c) => ({
      name: c.name,
      competitorType: c.competitorType,
      relevanceScore: c.relevanceScore,
      relevanceReasoning: c.relevanceReasoning,
      websiteUrl: c.websiteUrl,
    })),
  };
}
