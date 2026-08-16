const GRAPH_API_VERSION = "v25.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Creating ads in Meta. Every write the launcher makes lives here.
 *
 * Three rules this module holds to, because each one is a way real money gets
 * spent by accident:
 *
 * 1. Ads are created PAUSED, always. Nothing this app makes can start serving
 *    on its own; going live is a deliberate act in Ads Manager.
 * 2. Campaigns and ad sets are never created implicitly. The caller picks an
 *    existing one, so a mistyped budget cannot become a live ad set.
 * 3. Every call can be validated first. `validateOnly` runs Meta's own checks
 *    and creates nothing, which is what lets a batch be dry-run before it is
 *    committed.
 */

export type GraphErrorShape = {
  message?: string;
  code?: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
};

export class MetaLaunchError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly subcode: number | null,
    /** Meta's own plain-language explanation, when it gives one. */
    readonly userMessage: string | null,
  ) {
    super(message);
    this.name = "MetaLaunchError";
  }

  /**
   * The app is in Development mode, so Meta refuses the creative.
   *
   * Worth naming because it is the one failure that no retry, permission or
   * parameter change fixes — the app has to be switched to Live.
   */
  get isDevelopmentModeBlock(): boolean {
    return (
      this.subcode === 1885183 ||
      this.message.includes("development mode") ||
      (this.userMessage ?? "").includes("development mode")
    );
  }

  /** The ad account cannot run ads at all — disabled, unsettled or closed. */
  get isAccountDisabled(): boolean {
    return (
      this.subcode === 1885316 ||
      this.message.includes("Disabled accounts can't create or edit ads")
    );
  }
}

function toLaunchError(body: { error?: GraphErrorShape }): MetaLaunchError {
  const error = body.error ?? {};
  return new MetaLaunchError(
    error.error_user_title ?? error.message ?? "Meta rejected the request.",
    error.code ?? null,
    error.error_subcode ?? null,
    error.error_user_msg ?? null,
  );
}

async function graphPost<T>(
  path: string,
  params: Record<string, string>,
  accessToken: string,
  validateOnly: boolean,
): Promise<T> {
  const body = new URLSearchParams({ ...params, access_token: accessToken });
  if (validateOnly) {
    // Meta runs the full validation and creates nothing. The only honest way
    // to tell a user what a batch will do before it does it.
    body.set("execution_options", JSON.stringify(["validate_only"]));
  }

  const response = await fetch(`${GRAPH_BASE}/${path}`, {
    method: "POST",
    body,
  });
  const json = await response.json();

  if (!response.ok || json.error) throw toLaunchError(json);
  return json as T;
}

// ---------------------------------------------------------------------------
// Reading what already exists
// ---------------------------------------------------------------------------

export type CampaignSummary = {
  id: string;
  name: string;
  objective: string | null;
  status: string | null;
  /** Set when the campaign holds the budget — a CBO campaign. */
  dailyBudget: string | null;
  lifetimeBudget: string | null;
};

export async function listCampaigns(
  adAccountId: string,
  accessToken: string,
): Promise<CampaignSummary[]> {
  const params = new URLSearchParams({
    fields: "id,name,objective,status,daily_budget,lifetime_budget",
    // Archived campaigns cannot take new ad sets, so offering them would only
    // produce a confusing failure later.
    effective_status: JSON.stringify(["ACTIVE", "PAUSED"]),
    limit: "200",
    access_token: accessToken,
  });

  const response = await fetch(
    `${GRAPH_BASE}/${adAccountId}/campaigns?${params.toString()}`,
  );
  const body = await response.json();
  if (!response.ok || body.error) throw toLaunchError(body);

  return (body.data ?? []).map(
    (row: {
      id: string;
      name: string;
      objective?: string;
      status?: string;
      daily_budget?: string;
      lifetime_budget?: string;
    }) => ({
      id: row.id,
      name: row.name,
      objective: row.objective ?? null,
      status: row.status ?? null,
      dailyBudget: row.daily_budget ?? null,
      lifetimeBudget: row.lifetime_budget ?? null,
    }),
  );
}

export type AdSetSummary = {
  id: string;
  name: string;
  campaignId: string | null;
  status: string | null;
  dailyBudget: string | null;
};

export async function listAdSets(
  campaignId: string,
  accessToken: string,
): Promise<AdSetSummary[]> {
  const params = new URLSearchParams({
    fields: "id,name,campaign_id,status,daily_budget",
    effective_status: JSON.stringify(["ACTIVE", "PAUSED"]),
    limit: "200",
    access_token: accessToken,
  });

  const response = await fetch(
    `${GRAPH_BASE}/${campaignId}/adsets?${params.toString()}`,
  );
  const body = await response.json();
  if (!response.ok || body.error) throw toLaunchError(body);

  return (body.data ?? []).map(
    (row: {
      id: string;
      name: string;
      campaign_id?: string;
      status?: string;
      daily_budget?: string;
    }) => ({
      id: row.id,
      name: row.name,
      campaignId: row.campaign_id ?? null,
      status: row.status ?? null,
      dailyBudget: row.daily_budget ?? null,
    }),
  );
}

// ---------------------------------------------------------------------------
// Creating
// ---------------------------------------------------------------------------

/**
 * Uploads an image and returns the hash Meta refers to it by.
 *
 * Sent as base64 rather than multipart because the image comes from our own
 * Storage bucket as bytes; there is no file on disk to stream.
 */
export async function uploadAdImage(
  adAccountId: string,
  accessToken: string,
  image: { filename: string; bytes: Uint8Array },
): Promise<string> {
  const form = new FormData();
  form.set("access_token", accessToken);
  form.set("filename", new Blob([new Uint8Array(image.bytes)]), image.filename);

  const response = await fetch(`${GRAPH_BASE}/${adAccountId}/adimages`, {
    method: "POST",
    body: form,
  });
  const body = await response.json();
  if (!response.ok || body.error) throw toLaunchError(body);

  // Meta keys the response by the filename it was given, which is why the
  // filename has to be known rather than guessed at.
  const images = body.images ?? {};
  const entry = images[image.filename] ?? Object.values(images)[0];
  const hash = (entry as { hash?: string } | undefined)?.hash;

  if (!hash) {
    throw new MetaLaunchError(
      "Meta accepted the image but returned no hash.",
      null,
      null,
      null,
    );
  }
  return hash;
}

export type CreativeInput = {
  name: string;
  pageId: string;
  imageHash: string;
  /** The body text above the image. */
  primaryText: string;
  headline: string;
  description: string | null;
  linkUrl: string;
  callToAction: string;
  instagramActorId: string | null;
};

export async function createAdCreative(
  adAccountId: string,
  accessToken: string,
  input: CreativeInput,
  validateOnly = false,
): Promise<{ id: string }> {
  const storySpec: Record<string, unknown> = {
    page_id: input.pageId,
    link_data: {
      image_hash: input.imageHash,
      link: input.linkUrl,
      message: input.primaryText,
      name: input.headline,
      ...(input.description ? { description: input.description } : {}),
      call_to_action: { type: input.callToAction },
    },
  };

  if (input.instagramActorId) {
    storySpec.instagram_actor_id = input.instagramActorId;
  }

  return graphPost<{ id: string }>(
    `${adAccountId}/adcreatives`,
    {
      name: input.name,
      object_story_spec: JSON.stringify(storySpec),
      degrees_of_freedom_spec: JSON.stringify({
        // Meta's automatic "enhancements" rewrite copy and crop images. This
        // app spends a QA pass proving the creative is on brand and the text
        // is exactly the approved wording, so letting Meta alter it afterwards
        // would throw that away.
        creative_features_spec: {
          standard_enhancements: { enroll_status: "OPT_OUT" },
        },
      }),
    },
    accessToken,
    validateOnly,
  );
}

export async function createAd(
  adAccountId: string,
  accessToken: string,
  input: { name: string; adsetId: string; creativeId: string },
  validateOnly = false,
): Promise<{ id: string }> {
  return graphPost<{ id: string }>(
    `${adAccountId}/ads`,
    {
      name: input.name,
      adset_id: input.adsetId,
      creative: JSON.stringify({ creative_id: input.creativeId }),
      // Never anything else. An ad this app creates does not start spending on
      // its own; someone has to turn it on in Ads Manager.
      status: "PAUSED",
    },
    accessToken,
    validateOnly,
  );
}
