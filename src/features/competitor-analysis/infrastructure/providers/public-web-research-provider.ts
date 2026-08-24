import {
  emptyResult,
  type CompetitorDataProvider,
  type CompetitorRef,
  type ProviderFetchResult,
} from "@/features/competitor-analysis/domain/competitor-data-provider";

/**
 * NOT YET BUILT — stub only. Deliberately not implemented in the same change
 * that introduced the provider interface: fetching an arbitrary,
 * user-supplied `competitor.websiteUrl` server-side is a genuinely new attack
 * surface for this codebase (SSRF), and the only precedent here
 * (`isAllowedExternalImageHost` in ad-concepts/infrastructure/image-generation-client.ts)
 * is a narrow allowlist of specific known Shopify hosts — it does not
 * generalize to "any competitor's website," which is arbitrary by
 * definition. This should not be built without that safety layer designed
 * and reviewed first.
 *
 * Intended behaviour once built:
 * - Fetch `competitor.websiteUrl`'s homepage (or a specific landing page URL,
 *   if one is stored) with a short timeout and a response-size cap.
 * - Reject the URL before fetching unless it resolves to a public IP: block
 *   private/loopback/link-local ranges (10/8, 172.16/12, 192.168/16,
 *   127/8, 169.254/16, and the IPv6 equivalents), block non-http(s) schemes,
 *   and do not follow redirects into a blocked range.
 * - Extract `<title>`, `og:title`, `og:description`, and `meta[name=description]`
 *   as the closest legitimate public signal to ad copy/headlines — this is
 *   landing-page messaging, not a literal running ad, and the mapped
 *   `RawCompetitorAd` should say so rather than implying it observed an ad.
 * - Return `status: "not_covered"` when `competitor.websiteUrl` is unset —
 *   this provider has nothing to look at without one.
 *
 * Kept as a real, interface-conforming stub (rather than omitted) so the
 * provider list in the orchestrator doesn't need to change shape once this
 * is filled in.
 */
export const publicWebResearchProvider: CompetitorDataProvider = {
  id: "public_web_research",

  isAvailable() {
    return false;
  },

  async fetchAds(_competitor: CompetitorRef): Promise<ProviderFetchResult> {
    return emptyResult(
      "public_web_research",
      "unavailable",
      "Not yet built — needs SSRF-safe URL fetching designed first (see module comment).",
    );
  },
};
