import { MetaApiError } from "@/lib/meta/graph-http";
import { env } from "@/lib/env";
import {
  fetchActiveAdsForPage,
  type MetaAd,
} from "@/features/competitor-analysis/infrastructure/meta-ad-library-client";
import {
  emptyResult,
  type CompetitorDataProvider,
  type CompetitorRef,
  type ProviderFetchResult,
  type RawCompetitorAd,
} from "@/features/competitor-analysis/domain/competitor-data-provider";

/**
 * Meta's public Ad Library, exactly as covered by its own documentation.
 *
 * Confirmed against Meta's Transparency Center: `ads_archive` only ever
 * returns ads that reached the EU, or ads about social issues, elections or
 * politics. An ordinary e-commerce competitor's ads have no path through this
 * endpoint at all — Meta's own community forum describes querying a known-
 * running commercial ad's page_id through the API and getting an empty
 * result, "not a bug." So an empty response here is the *expected* outcome
 * for most competitors, not a sign anything is broken — see the messages
 * below, which say so rather than reading as a failed lookup.
 *
 * Code 10 ("Application does not have permission for this action") is the
 * family that covers both "identity verification not completed" and "this ad
 * category has no path through this endpoint" (subcode 2332002 either way,
 * confirmed by live testing against this app's own token) — treated as
 * `not_covered` rather than `error`, because in practice it is the scope
 * boundary manifesting as an error rather than an empty array.
 */

function mapAd(ad: MetaAd): RawCompetitorAd {
  return {
    externalId: ad.metaAdArchiveId,
    pageName: ad.pageName,
    bodyText: ad.adCreativeBody,
    linkTitle: ad.adCreativeLinkTitle,
    linkDescription: ad.adCreativeLinkDescription,
    snapshotUrl: ad.adSnapshotUrl,
    // The Ad Library API has no image/video URL field — only ad_snapshot_url,
    // a link to Meta's own preview page. Nothing to map here.
    creativeImageUrl: null,
    creativeVideoUrl: null,
    landingPageUrl: null,
    firstSeenAt: ad.adDeliveryStartTime,
    lastSeenAt: ad.adDeliveryStopTime,
    isActive: ad.isActive,
  };
}

export const metaAdLibraryProvider: CompetitorDataProvider = {
  id: "meta_ad_library",

  isAvailable() {
    return Boolean(env.META_AD_LIBRARY_ACCESS_TOKEN);
  },

  async fetchAds(competitor: CompetitorRef): Promise<ProviderFetchResult> {
    if (!competitor.metaPageId) {
      return emptyResult(
        "meta_ad_library",
        "not_covered",
        "No Meta Page ID set for this competitor.",
      );
    }

    try {
      const ads = await fetchActiveAdsForPage(competitor.metaPageId);
      return {
        provider: "meta_ad_library",
        status: "ok",
        ads: ads.map(mapAd),
        message:
          ads.length === 0
            ? "No ads returned. The Ad Library API only covers ads that reached the EU, or political/social-issue ads — most ordinary commercial ads are outside its scope, so this is expected, not necessarily a sign of a problem."
            : `Found ${ads.length} ad(s) within the Ad Library API's EU/political-ads scope.`,
      };
    } catch (error) {
      if (error instanceof MetaApiError) {
        if (error.isTokenError) {
          return emptyResult(
            "meta_ad_library",
            "unavailable",
            `Meta access token is invalid or expired (${error.message}). Replace META_AD_LIBRARY_ACCESS_TOKEN.`,
          );
        }
        if (error.code === 10) {
          return emptyResult(
            "meta_ad_library",
            "not_covered",
            `Meta declined this request (${error.message}) — this is the same error the API returns for ads outside its EU/political-ads scope, not necessarily an account problem.`,
          );
        }
        if (error.isRateLimit) {
          return emptyResult(
            "meta_ad_library",
            "unavailable",
            `Meta is rate-limiting requests right now (${error.message}). Try again later.`,
          );
        }
      }
      return emptyResult(
        "meta_ad_library",
        "error",
        error instanceof Error ? error.message : "Unknown error.",
      );
    }
  },
};
