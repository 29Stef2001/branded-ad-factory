import {
  emptyResult,
  type CompetitorDataProvider,
  type CompetitorRef,
  type ProviderFetchResult,
} from "@/features/competitor-analysis/domain/competitor-data-provider";

/**
 * NOT BUILT — explicitly out of scope until asked for by name.
 *
 * This is the slot for directly automating Meta's public Ad Library
 * *website* (not the `ads_archive` API) — the website UI shows every active
 * ad for any advertiser, commercial or political, with no identity
 * verification gate, which is exactly what the official API cannot do. That
 * also makes it the most fragile option: it isn't a stable, documented
 * public API, it can break whenever Meta changes the page, and running it
 * carries more direct ToS exposure than paying a vendor (Foreplay, Apify's
 * actors) to absorb that risk on our behalf. Left as an interface-conforming
 * stub only so the provider list's shape doesn't change if this is ever
 * built — no scraping logic exists here, and none should be added without a
 * separate, explicit decision to do so.
 */
export const futureScraperProvider: CompetitorDataProvider = {
  id: "future_scraper",

  isAvailable() {
    return false;
  },

  async fetchAds(_competitor: CompetitorRef): Promise<ProviderFetchResult> {
    return emptyResult(
      "future_scraper",
      "unavailable",
      "Not built, and not planned without an explicit decision to do so — see module comment.",
    );
  },
};
