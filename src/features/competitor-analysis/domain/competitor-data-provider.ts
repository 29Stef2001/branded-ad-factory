/**
 * The contract every competitor-ad source implements. Pure types — no IO.
 *
 * Built because the Meta Ad Library API turned out not to be a general
 * competitor-ads source: confirmed against Meta's own Transparency Center
 * docs, its `ads_archive` endpoint only ever returns ads that reached the EU,
 * or political/social-issue ads. An ordinary e-commerce competitor's ads have
 * no path through that endpoint — not a permission bug, a product boundary.
 * A pipeline hard-wired to "call Meta, anything else is an error" would
 * therefore be broken by design for most real competitors. This interface
 * lets the pipeline fan out to whichever sources are actually configured and
 * treat "this source doesn't cover this competitor" as a normal, expected
 * outcome rather than a failure.
 */

export type ProviderId =
  | "meta_ad_library"
  | "public_web_research"
  | "external_ad_intelligence"
  | "future_scraper"
  // Ads Hermes itself observed via its own browser automation and reported
  // back through the `competitor_ads_submit` MCP tool — not a
  // CompetitorDataProvider implementation (nothing here calls out to fetch
  // anything), just the correct provenance label for where these rows came
  // from. See src/features/hermes-gateway/application/tools.ts.
  | "hermes_research";

/**
 * - `ok`: the provider ran and returned what it found (possibly zero ads —
 *   zero is not itself a failure, see `message`).
 * - `not_covered`: this competitor is outside what the provider can see in
 *   principle (e.g. Meta Ad Library and a non-EU, non-political advertiser).
 *   Different from `ok` with zero ads so callers can distinguish "looked and
 *   found nothing" from "structurally can't look here."
 * - `unavailable`: the provider isn't usable right now (missing credentials,
 *   dead token, not yet configured) — an operational state, not a per-ad
 *   result.
 * - `error`: something genuinely broke (network failure, unexpected API
 *   response) that isn't explained by scope or availability.
 */
export type ProviderStatus = "ok" | "not_covered" | "unavailable" | "error";

/**
 * One ad, in provider-agnostic shape. Every field nullable on purpose: no
 * provider supplies all of them, and a missing field is a real, expected gap
 * rather than something to guess at.
 */
export type RawCompetitorAd = {
  /** Unique within this provider — the dedup key is (provider, externalId). */
  externalId: string;
  pageName: string | null;
  bodyText: string | null;
  linkTitle: string | null;
  linkDescription: string | null;
  /** A link to view the ad/source at its origin (Meta's preview page, etc.). */
  snapshotUrl: string | null;
  creativeImageUrl: string | null;
  creativeVideoUrl: string | null;
  landingPageUrl: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  isActive: boolean | null;
};

export type ProviderFetchResult = {
  provider: ProviderId;
  status: ProviderStatus;
  ads: RawCompetitorAd[];
  /** Always populated — the reason behind the status, meant to reach the UI. */
  message: string;
};

export type CompetitorRef = {
  name: string;
  metaPageId: string | null;
  websiteUrl: string | null;
};

/**
 * A competitor-ad source. `isAvailable()` is checked before `fetchAds()` is
 * even called — a provider with no credentials configured should not have to
 * fail at request time to say so.
 */
export interface CompetitorDataProvider {
  readonly id: ProviderId;
  isAvailable(): boolean;
  /**
   * Must never throw. Anything that would be a throw elsewhere belongs in a
   * `status: "error"` result instead — the orchestrator fans out to every
   * available provider, and one provider's exception must not take down the
   * others or the caller.
   */
  fetchAds(competitor: CompetitorRef): Promise<ProviderFetchResult>;
}

export function emptyResult(
  provider: ProviderId,
  status: ProviderStatus,
  message: string,
): ProviderFetchResult {
  return { provider, status, ads: [], message };
}
