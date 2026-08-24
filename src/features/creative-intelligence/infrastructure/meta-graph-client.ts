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

// ---------------------------------------------------------------------------
// Account and Page discovery
// ---------------------------------------------------------------------------

export type MetaAdAccountSummary = {
  adAccountId: string;
  name: string | null;
  currency: string | null;
  accountStatus: number | null;
  businessName: string | null;
};

/**
 * Every ad account this token can reach.
 *
 * `business` is requested separately from the rest because it needs
 * `business_management`, which a read-only connection does not have. Asking for
 * it in the main field list makes Graph reject the *whole* call with
 * "(#100) Requires business_management permission" — so the account list, which
 * `ads_read` alone can serve perfectly well, would come back empty.
 */
export async function fetchAdAccounts(
  accessToken: string,
  after?: string,
): Promise<Page<MetaAdAccountSummary>> {
  type RawAccount = {
    id: string;
    name?: string;
    currency?: string;
    account_status?: number;
    business?: { name?: string };
  };

  const request = (fields: string) =>
    graphGet<Paged<RawAccount>>(
      "me/adaccounts",
      { fields, limit: String(PAGE_SIZE), ...(after ? { after } : {}) },
      accessToken,
    );

  let body: Paged<RawAccount>;
  try {
    body = await request("id,name,currency,account_status,business{name}");
  } catch {
    // Fall back to what every connection can read.
    body = await request("id,name,currency,account_status");
  }

  return pageOf(body, (account) => ({
    adAccountId: account.id,
    name: account.name ?? null,
    currency: account.currency ?? null,
    accountStatus: account.account_status ?? null,
    businessName: account.business?.name ?? null,
  }));
}

export type MetaPageSummary = {
  pageId: string;
  name: string | null;
  pageAccessToken: string | null;
  instagramActorId: string | null;
};

/**
 * Facebook Pages this token can act for.
 *
 * Every ad creative must name a Page, so an empty result here is a hard block
 * on launching — not a cosmetic gap. It comes back empty both when the person
 * genuinely has no Page and when `pages_show_list` has not been granted, and
 * the caller cannot tell those apart from the payload alone.
 */
export async function fetchPages(
  accessToken: string,
  after?: string,
): Promise<Page<MetaPageSummary>> {
  type RawPage = {
    id: string;
    name?: string;
    access_token?: string;
    instagram_business_account?: { id?: string };
  };

  const body = await graphGet<Paged<RawPage>>(
    "me/accounts",
    {
      fields: "id,name,access_token,instagram_business_account{id}",
      limit: String(PAGE_SIZE),
      ...(after ? { after } : {}),
    },
    accessToken,
  );

  return pageOf(body, (page) => ({
    pageId: page.id,
    name: page.name ?? null,
    pageAccessToken: page.access_token ?? null,
    instagramActorId: page.instagram_business_account?.id ?? null,
  }));
}

/**
 * A thumbnail URL that will still work when it is fetched.
 *
 * The ones stored during sync do not: Meta serves them from a CDN with an
 * expiring signature, so a URL captured yesterday returns 403 today. Every DNA
 * analysis failed on exactly that before this existed. Asking Meta again costs
 * one small call and is the difference between an image and an error.
 */
export async function fetchFreshCreativeUrl(
  metaAdId: string,
  accessToken: string,
): Promise<string | null> {
  const params = new URLSearchParams({
    fields: "creative{thumbnail_url,image_url}",
    access_token: accessToken,
  });

  const response = await fetch(
    `${GRAPH_BASE}/${metaAdId}?${params.toString()}`,
  );
  const body = await response.json();
  if (!response.ok || body.error) return null;

  const creative = body.creative ?? {};
  // Thumbnail first: it is smaller, which matters when ten of them go to a
  // vision model in one run.
  return creative.thumbnail_url ?? creative.image_url ?? null;
}
