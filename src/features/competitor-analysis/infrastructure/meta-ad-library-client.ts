import { env } from "@/lib/env";

const AD_LIBRARY_ENDPOINT = "https://graph.facebook.com/v25.0/ads_archive";

const AD_FIELDS = [
  "id",
  "page_name",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_descriptions",
  "ad_snapshot_url",
  "ad_delivery_start_time",
].join(",");

export type MetaAd = {
  metaAdArchiveId: string;
  pageName: string | null;
  adCreativeBody: string | null;
  adCreativeLinkTitle: string | null;
  adCreativeLinkDescription: string | null;
  adSnapshotUrl: string | null;
  adDeliveryStartTime: string | null;
};

type AdsArchiveResponse = {
  data?: Array<{
    id: string;
    page_name?: string;
    ad_creative_bodies?: string[];
    ad_creative_link_titles?: string[];
    ad_creative_link_descriptions?: string[];
    ad_snapshot_url?: string;
    ad_delivery_start_time?: string;
  }>;
  error?: { message: string };
};

export async function fetchActiveAdsForPage(pageId: string): Promise<MetaAd[]> {
  const params = new URLSearchParams({
    search_page_ids: JSON.stringify([pageId]),
    ad_reached_countries: JSON.stringify(["ALL"]),
    ad_active_status: "ALL",
    fields: AD_FIELDS,
    access_token: env.META_AD_LIBRARY_ACCESS_TOKEN,
  });

  const response = await fetch(`${AD_LIBRARY_ENDPOINT}?${params.toString()}`);
  const body = (await response.json()) as AdsArchiveResponse;

  if (!response.ok || body.error) {
    throw new Error(
      body.error?.message ?? "Failed to fetch ads from the Meta Ad Library.",
    );
  }

  return (body.data ?? []).map((ad) => ({
    metaAdArchiveId: ad.id,
    pageName: ad.page_name ?? null,
    adCreativeBody: ad.ad_creative_bodies?.[0] ?? null,
    adCreativeLinkTitle: ad.ad_creative_link_titles?.[0] ?? null,
    adCreativeLinkDescription: ad.ad_creative_link_descriptions?.[0] ?? null,
    adSnapshotUrl: ad.ad_snapshot_url ?? null,
    adDeliveryStartTime: ad.ad_delivery_start_time ?? null,
  }));
}
