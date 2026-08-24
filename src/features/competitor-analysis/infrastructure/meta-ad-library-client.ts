import { env } from "@/lib/env";
import { graphGet, pageOf, type Page, type Paged } from "@/lib/meta/graph-http";

/**
 * Meta Ad Library reads for competitor research.
 *
 * Shares its HTTP plumbing (JSON-vs-HTML handling, rate-limit classification)
 * with creative-intelligence's Graph client via `@/lib/meta/graph-http` — the
 * same "Meta sometimes answers with HTML" fix, paid for once.
 *
 * `ads_archive` is a different surface from the rest of the Graph API: it
 * reads *other* businesses' public ads via a static, app-level token
 * (`META_AD_LIBRARY_ACCESS_TOKEN`), not a per-user OAuth connection, and it
 * requires the token owner's Facebook account to have completed Meta's
 * identity-verification process or every call fails with
 * `error_subcode 2332002` (see ARCHITECTURE.md).
 */

const AD_LIBRARY_PATH = "ads_archive";

const AD_FIELDS = [
  "id",
  "page_name",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_descriptions",
  "ad_snapshot_url",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
].join(",");

export type MetaAd = {
  metaAdArchiveId: string;
  pageName: string | null;
  adCreativeBody: string | null;
  adCreativeLinkTitle: string | null;
  adCreativeLinkDescription: string | null;
  adSnapshotUrl: string | null;
  adDeliveryStartTime: string | null;
  adDeliveryStopTime: string | null;
  /** Derived: Meta has not recorded a stop time for this ad. */
  isActive: boolean;
};

type RawAd = {
  id: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: string[];
  ad_snapshot_url?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
};

function mapAd(ad: RawAd): MetaAd {
  return {
    metaAdArchiveId: ad.id,
    pageName: ad.page_name ?? null,
    // Meta can return several creative variants per ad; only the first is
    // genuinely representable per ads_archive row, so the rest are dropped
    // rather than merged into something that reads as one ad but isn't.
    adCreativeBody: ad.ad_creative_bodies?.[0] ?? null,
    adCreativeLinkTitle: ad.ad_creative_link_titles?.[0] ?? null,
    adCreativeLinkDescription: ad.ad_creative_link_descriptions?.[0] ?? null,
    adSnapshotUrl: ad.ad_snapshot_url ?? null,
    adDeliveryStartTime: ad.ad_delivery_start_time ?? null,
    adDeliveryStopTime: ad.ad_delivery_stop_time ?? null,
    isActive: !ad.ad_delivery_stop_time,
  };
}

/** One page of a page's ad archive. */
export async function fetchAdsPage(
  pageId: string,
  after?: string,
): Promise<Page<MetaAd>> {
  const body = await graphGet<Paged<RawAd>>(
    AD_LIBRARY_PATH,
    {
      search_page_ids: JSON.stringify([pageId]),
      ad_reached_countries: JSON.stringify(["ALL"]),
      ad_active_status: "ALL",
      fields: AD_FIELDS,
      ...(after ? { after } : {}),
    },
    env.META_AD_LIBRARY_ACCESS_TOKEN,
  );

  return pageOf(body, mapAd);
}

/** Meta's rate limits on ads_archive are undocumented; conservative until measured. */
const MAX_PAGES = 5;

/**
 * Every ad Meta will show for this page, up to `MAX_PAGES`.
 *
 * A cap, not exhaustion: unlike a workspace's own ad accounts (tens), a
 * page's public ad archive can run into the thousands, and walking all of it
 * would blow the competitor-research job's per-competitor time budget on a
 * single large advertiser.
 */
export async function fetchActiveAdsForPage(pageId: string): Promise<MetaAd[]> {
  const ads: MetaAd[] = [];
  let cursor: string | undefined;
  let pages = 0;

  do {
    const page = await fetchAdsPage(pageId, cursor);
    ads.push(...page.items);
    cursor = page.nextCursor ?? undefined;
    pages += 1;
  } while (cursor && pages < MAX_PAGES);

  return ads;
}
