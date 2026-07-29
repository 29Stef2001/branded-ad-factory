import {
  parseInsightRow,
  type DailyInsight,
  type MetaInsightRow,
} from "@/features/creative-intelligence/domain/meta-metrics";

/**
 * Meta Graph reads for Creative Intelligence.
 *
 * Everything here is cursor-paginated and returns a page at a time rather than
 * looping to exhaustion internally. That is deliberate: the caller is a
 * background job that has to checkpoint and resume, because Vercel Hobby kills
 * a function at 60 seconds regardless of `maxDuration` — a limit image
 * generation has already hit. A client that hides pagination would make a
 * resumable job impossible to write.
 *
 * Only `ads_read` is needed for any of this.
 */

const GRAPH_API_VERSION = "v25.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/** Meta's cap is 500; 200 keeps a page comfortably inside the time budget. */
const PAGE_SIZE = 200;

export type MetaEntity = {
  entityType: "campaign" | "adset" | "ad";
  metaId: string;
  parentMetaId: string | null;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  creativeMetaId: string | null;
  imageHash: string | null;
  thumbnailUrl: string | null;
};

export type Page<T> = {
  items: T[];
  /** Pass back as `after` to continue. Null when the last page was reached. */
  nextCursor: string | null;
};

export class MetaGraphError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly isRateLimit: boolean,
    readonly isTokenError: boolean,
  ) {
    super(message);
    this.name = "MetaGraphError";
  }
}

/** Throttling codes. Meta wants a pause, not a retry storm. */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80000, 80004]);
/** The token is gone or was revoked — retrying will never help. */
const TOKEN_ERROR_CODES = new Set([190, 102, 463, 467]);

async function graphGet<T>(
  path: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<T> {
  const search = new URLSearchParams({ ...params, access_token: accessToken });
  const response = await fetch(`${GRAPH_BASE}/${path}?${search.toString()}`);
  const body = await response.json();

  if (!response.ok || body.error) {
    const code = body.error?.code ?? null;
    throw new MetaGraphError(
      body.error?.message ?? `Meta request failed (HTTP ${response.status}).`,
      code,
      RATE_LIMIT_CODES.has(code),
      TOKEN_ERROR_CODES.has(code),
    );
  }

  return body as T;
}

type Paged<T> = {
  data: T[];
  paging?: { cursors?: { after?: string }; next?: string };
};

function pageOf<T, R>(body: Paged<T>, map: (item: T) => R): Page<R> {
  return {
    items: body.data.map(map),
    // `next` is what says another page exists; a cursor alone is returned even
    // on the final page, so keying off it would loop forever.
    nextCursor: body.paging?.next ? (body.paging.cursors?.after ?? null) : null,
  };
}

type RawCampaign = {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
};
type RawAdSet = RawCampaign & { campaign_id?: string };
type RawAd = RawCampaign & {
  adset_id?: string;
  creative?: { id?: string; image_hash?: string; thumbnail_url?: string };
};

export async function fetchCampaigns(
  adAccountId: string,
  accessToken: string,
  after?: string,
): Promise<Page<MetaEntity>> {
  const body = await graphGet<Paged<RawCampaign>>(
    `${adAccountId}/campaigns`,
    {
      fields: "id,name,status,effective_status",
      limit: String(PAGE_SIZE),
      ...(after ? { after } : {}),
    },
    accessToken,
  );

  return pageOf(body, (campaign) => ({
    entityType: "campaign" as const,
    metaId: campaign.id,
    parentMetaId: null,
    name: campaign.name,
    status: campaign.status ?? null,
    effectiveStatus: campaign.effective_status ?? null,
    creativeMetaId: null,
    imageHash: null,
    thumbnailUrl: null,
  }));
}

export async function fetchAdSets(
  adAccountId: string,
  accessToken: string,
  after?: string,
): Promise<Page<MetaEntity>> {
  const body = await graphGet<Paged<RawAdSet>>(
    `${adAccountId}/adsets`,
    {
      fields: "id,name,status,effective_status,campaign_id",
      limit: String(PAGE_SIZE),
      ...(after ? { after } : {}),
    },
    accessToken,
  );

  return pageOf(body, (adset) => ({
    entityType: "adset" as const,
    metaId: adset.id,
    parentMetaId: adset.campaign_id ?? null,
    name: adset.name,
    status: adset.status ?? null,
    effectiveStatus: adset.effective_status ?? null,
    creativeMetaId: null,
    imageHash: null,
    thumbnailUrl: null,
  }));
}

export async function fetchAds(
  adAccountId: string,
  accessToken: string,
  after?: string,
): Promise<Page<MetaEntity>> {
  const body = await graphGet<Paged<RawAd>>(
    `${adAccountId}/ads`,
    {
      // The creative sub-object carries what attribution needs: the ad name
      // holds the concept code, and the thumbnail is what the perceptual-hash
      // fallback compares against.
      fields:
        "id,name,status,effective_status,adset_id,creative{id,image_hash,thumbnail_url}",
      limit: String(PAGE_SIZE),
      ...(after ? { after } : {}),
    },
    accessToken,
  );

  return pageOf(body, (ad) => ({
    entityType: "ad" as const,
    metaId: ad.id,
    parentMetaId: ad.adset_id ?? null,
    name: ad.name,
    status: ad.status ?? null,
    effectiveStatus: ad.effective_status ?? null,
    creativeMetaId: ad.creative?.id ?? null,
    imageHash: ad.creative?.image_hash ?? null,
    thumbnailUrl: ad.creative?.thumbnail_url ?? null,
  }));
}

/**
 * Every metric the scoring model can use, at ad level, one row per day.
 *
 * `time_increment=1` is what makes this a daily fact feed rather than a period
 * total — without it Meta collapses the range into a single row and the daily
 * table cannot be built.
 */
const INSIGHT_FIELDS = [
  "ad_id",
  "impressions",
  "reach",
  "frequency",
  "spend",
  "clicks",
  "inline_link_clicks",
  "outbound_clicks",
  "actions",
  "action_values",
  "video_play_actions",
  "video_p25_watched_actions",
  "video_p50_watched_actions",
  "video_p75_watched_actions",
  "video_p100_watched_actions",
  "video_thruplay_watched_actions",
].join(",");

export async function fetchDailyInsights(
  adAccountId: string,
  accessToken: string,
  since: string,
  until: string,
  after?: string,
): Promise<Page<DailyInsight>> {
  const body = await graphGet<Paged<MetaInsightRow>>(
    `${adAccountId}/insights`,
    {
      level: "ad",
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
      fields: INSIGHT_FIELDS,
      limit: String(PAGE_SIZE),
      ...(after ? { after } : {}),
    },
    accessToken,
  );

  const page = pageOf(body, (row) => row);
  return {
    // Rows Meta cannot key are dropped rather than guessed at.
    items: page.items
      .map(parseInsightRow)
      .filter((row): row is DailyInsight => row !== null),
    nextCursor: page.nextCursor,
  };
}
