import {
  emptyResult,
  type CompetitorDataProvider,
  type CompetitorRef,
  type ProviderFetchResult,
} from "@/features/competitor-analysis/domain/competitor-data-provider";

/**
 * NOT YET CONFIGURED — stub only, pending a vendor decision.
 *
 * This is the slot for a paid ad-intelligence API (Foreplay, Apify's Meta Ads
 * Scraper actors, or similar) — a vendor that does the actual ad collection
 * (by consuming Meta's public website rather than the restricted `ads_archive`
 * API, or by running their own infrastructure) and exposes it as a clean,
 * self-serve API. See the Phase 1 competitor-research writeup for the
 * comparison and recommendation.
 *
 * Not implemented against a specific vendor yet because none has been chosen
 * — wiring one up means: an API key (add to `src/lib/env.ts`'s server
 * schema, never the client schema), a client module in this same
 * `infrastructure/providers/` directory mapping that vendor's response shape
 * to `RawCompetitorAd`, and flipping `isAvailable()` to check for the key.
 * Once a vendor is chosen, its API key belongs in `src/lib/env.ts`'s server
 * schema (never the client schema) — nothing is declared there yet.
 */
export const externalAdIntelligenceProvider: CompetitorDataProvider = {
  id: "external_ad_intelligence",

  isAvailable() {
    // No vendor chosen yet — see module comment. Intentionally always false
    // until a real key/client exists; env.ts has no such key declared today.
    return false;
  },

  async fetchAds(_competitor: CompetitorRef): Promise<ProviderFetchResult> {
    return emptyResult(
      "external_ad_intelligence",
      "unavailable",
      "No external ad-intelligence provider is configured yet — a vendor still needs to be chosen (see the Phase 1 competitor-research provider comparison).",
    );
  },
};
