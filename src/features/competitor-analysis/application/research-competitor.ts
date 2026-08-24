import type {
  CompetitorRef,
  ProviderFetchResult,
} from "@/features/competitor-analysis/domain/competitor-data-provider";
import { metaAdLibraryProvider } from "@/features/competitor-analysis/infrastructure/providers/meta-ad-library-provider";
import { publicWebResearchProvider } from "@/features/competitor-analysis/infrastructure/providers/public-web-research-provider";
import { externalAdIntelligenceProvider } from "@/features/competitor-analysis/infrastructure/providers/external-ad-intelligence-provider";
import { futureScraperProvider } from "@/features/competitor-analysis/infrastructure/providers/future-scraper-provider";
import {
  upsertRawCompetitorAds,
  type Db,
} from "@/features/competitor-analysis/infrastructure/competitor-repository";

/**
 * Fans out a competitor to every configured data provider, and never throws.
 *
 * This is what makes "the pipeline must not break when Meta has nothing"
 * structural rather than something every caller has to remember: each
 * provider's `fetchAds` already promises not to throw (see the interface),
 * and this loop treats every status — `ok`, `not_covered`, `unavailable`,
 * `error` — as data to report, not a reason to stop. A competitor with zero
 * available providers still returns a normal, empty summary.
 */

const PROVIDERS = [
  metaAdLibraryProvider,
  publicWebResearchProvider,
  externalAdIntelligenceProvider,
  futureScraperProvider,
];

export type ResearchOutcome = {
  totalAdsFound: number;
  results: ProviderFetchResult[];
};

export async function researchCompetitorAds(
  competitorId: string,
  competitor: CompetitorRef,
  db?: Db,
): Promise<ResearchOutcome> {
  const available = PROVIDERS.filter((provider) => provider.isAvailable());
  const results: ProviderFetchResult[] = [];
  let totalAdsFound = 0;

  for (const provider of available) {
    const result = await provider.fetchAds(competitor).catch(
      (error): ProviderFetchResult => ({
        provider: provider.id,
        status: "error",
        ads: [],
        message:
          error instanceof Error
            ? error.message
            : "Provider threw unexpectedly.",
      }),
    );

    results.push(result);

    if (result.ads.length > 0) {
      await upsertRawCompetitorAds(competitorId, provider.id, result.ads, db);
      totalAdsFound += result.ads.length;
    }
  }

  return { totalAdsFound, results };
}

/** One line per provider, for surfacing in a Server Action's message. */
export function summarizeResearch(outcome: ResearchOutcome): string {
  if (outcome.results.length === 0) {
    return "No competitor-ad providers are configured right now.";
  }
  return outcome.results
    .map((result) => `${result.provider}: ${result.message}`)
    .join(" ");
}
