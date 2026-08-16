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

export type AdSetDetails = {
  id: string;
  name: string;
  status: string | null;
  /** When delivery starts. Already set on the ad set, not per ad. */
  startTime: string | null;
  endTime: string | null;
  dailyBudget: string | null;
  optimizationGoal: string | null;
  billingEvent: string | null;
  /** The pixel and conversion event this ad set optimises for. */
  pixelId: string | null;
  customEventType: string | null;
  countries: string[];
  ageMin: number | null;
  ageMax: number | null;
};

/**
 * Everything an ad set already decides on behalf of the ads inside it.
 *
 * Shown before launching rather than asked for, because these are not the
 * launcher's to set: the pixel, the conversion event, the schedule, the budget
 * and the targeting all live here. Choosing an ad set *is* choosing them. The
 * screen displays them so the choice is verified rather than assumed — picking
 * the wrong ad set is otherwise invisible until the money has moved.
 */
export async function getAdSetDetails(
  adSetId: string,
  accessToken: string,
): Promise<AdSetDetails> {
  const params = new URLSearchParams({
    fields:
      "id,name,status,start_time,end_time,daily_budget,optimization_goal,billing_event,promoted_object,targeting",
    access_token: accessToken,
  });

  const response = await fetch(`${GRAPH_BASE}/${adSetId}?${params.toString()}`);
  const body = await response.json();
  if (!response.ok || body.error) throw toLaunchError(body);

  const promoted = body.promoted_object ?? {};
  const targeting = body.targeting ?? {};

  return {
    id: body.id,
    name: body.name,
    status: body.status ?? null,
    startTime: body.start_time ?? null,
    endTime: body.end_time ?? null,
    dailyBudget: body.daily_budget ?? null,
    optimizationGoal: body.optimization_goal ?? null,
    billingEvent: body.billing_event ?? null,
    pixelId: promoted.pixel_id ?? null,
    customEventType: promoted.custom_event_type ?? null,
    countries: targeting.geo_locations?.countries ?? [],
    ageMin: targeting.age_min ?? null,
    ageMax: targeting.age_max ?? null,
  };
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

/** Conversion pixels on the account, for the ad set's promoted_object. */
export type PixelSummary = { id: string; name: string };

export async function listPixels(
  adAccountId: string,
  accessToken: string,
): Promise<PixelSummary[]> {
  const params = new URLSearchParams({
    fields: "id,name",
    limit: "100",
    access_token: accessToken,
  });

  const response = await fetch(
    `${GRAPH_BASE}/${adAccountId}/adspixels?${params.toString()}`,
  );
  const body = await response.json();
  if (!response.ok || body.error) throw toLaunchError(body);

  return (body.data ?? []).map((row: { id: string; name?: string }) => ({
    id: row.id,
    name: row.name ?? row.id,
  }));
}

export type CampaignInput = {
  name: string;
  objective: string;
  /** Minor units, as Meta expects: 2000 is £20.00. */
  dailyBudgetMinor: number | null;
};

/**
 * Creates a campaign, always paused.
 *
 * A daily budget here rather than on the ad set is what makes it a CBO
 * campaign — Meta then distributes across ad sets itself. Passing null leaves
 * the budget to the ad set instead, which is the non-CBO shape.
 */
export async function createCampaign(
  adAccountId: string,
  accessToken: string,
  input: CampaignInput,
  validateOnly = false,
): Promise<{ id: string }> {
  return graphPost<{ id: string }>(
    `${adAccountId}/campaigns`,
    {
      name: input.name,
      objective: input.objective,
      status: "PAUSED",
      special_ad_categories: "[]",
      // Meta rejects the call outright without this when no campaign budget is
      // set, and its own error only says "Invalid parameter" until you ask for
      // the user-facing message.
      is_adset_budget_sharing_enabled: "false",
      ...(input.dailyBudgetMinor !== null
        ? { daily_budget: String(input.dailyBudgetMinor) }
        : {}),
    },
    accessToken,
    validateOnly,
  );
}

export type AdSetInput = {
  name: string;
  campaignId: string;
  /** Omitted when the campaign holds the budget (CBO). */
  dailyBudgetMinor: number | null;
  countries: string[];
  ageMin: number;
  ageMax: number;
  /** ISO 8601. Meta refuses a start in the past. */
  startTime: string | null;
  endTime: string | null;
  pixelId: string | null;
  customEventType: string;
  optimizationGoal: string;
  billingEvent: string;
  /**
   * Whether ads may appear on Threads.
   *
   * Off means naming the other platforms explicitly, since there is no
   * "exclude one" switch — and naming any of them turns off Advantage+
   * placements, so Meta stops adding new surfaces on its own. That trade is
   * the reason this is a deliberate choice rather than a default.
   */
  includeThreads: boolean;
};

/** Everything except Threads. Listing these is how Threads is excluded. */
const PLACEMENTS_WITHOUT_THREADS = [
  "facebook",
  "instagram",
  "audience_network",
  "messenger",
];

/**
 * Creates an ad set, always paused.
 *
 * This is where the pixel lives: `promoted_object` binds the ad set to a pixel
 * and the conversion event it optimises for. Without it Meta refuses any
 * conversion-optimised ad set, and with the wrong event it will happily
 * optimise for the wrong thing — which is why the caller names both rather
 * than getting a default.
 */
export async function createAdSet(
  adAccountId: string,
  accessToken: string,
  input: AdSetInput,
  validateOnly = false,
): Promise<{ id: string }> {
  const targeting: Record<string, unknown> = {
    geo_locations: { countries: input.countries },
    age_min: input.ageMin,
    age_max: input.ageMax,
  };

  if (!input.includeThreads) {
    // Omitting publisher_platforms entirely leaves Meta free to place ads
    // anywhere it likes, Threads included.
    targeting.publisher_platforms = PLACEMENTS_WITHOUT_THREADS;
  }

  return graphPost<{ id: string }>(
    `${adAccountId}/adsets`,
    {
      name: input.name,
      campaign_id: input.campaignId,
      status: "PAUSED",
      optimization_goal: input.optimizationGoal,
      billing_event: input.billingEvent,
      targeting: JSON.stringify(targeting),
      ...(input.dailyBudgetMinor !== null
        ? { daily_budget: String(input.dailyBudgetMinor) }
        : {}),
      ...(input.startTime ? { start_time: input.startTime } : {}),
      ...(input.endTime ? { end_time: input.endTime } : {}),
      ...(input.pixelId
        ? {
            promoted_object: JSON.stringify({
              pixel_id: input.pixelId,
              custom_event_type: input.customEventType,
            }),
          }
        : {}),
    },
    accessToken,
    validateOnly,
  );
}

/**
 * Uploads a video and waits for Meta to finish processing it.
 *
 * Unlike an image, a video is not usable the moment it is accepted: Meta
 * transcodes it, and creating a creative against one still in `processing`
 * fails with an error that says nothing about waiting. So this polls until it
 * is ready, which is the difference between a batch that works and one that
 * fails on every video for no visible reason.
 */
export async function uploadAdVideo(
  adAccountId: string,
  accessToken: string,
  video: { filename: string; bytes: Uint8Array },
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const form = new FormData();
  form.set("access_token", accessToken);
  form.set("source", new Blob([new Uint8Array(video.bytes)]), video.filename);
  form.set("name", video.filename);

  const response = await fetch(`${GRAPH_BASE}/${adAccountId}/advideos`, {
    method: "POST",
    body: form,
  });
  const body = await response.json();
  if (!response.ok || body.error) throw toLaunchError(body);

  const videoId = body.id as string | undefined;
  if (!videoId) {
    throw new MetaLaunchError(
      "Meta accepted the video but returned no id.",
      null,
      null,
      null,
    );
  }

  await waitForVideo(videoId, accessToken, options.timeoutMs ?? 180_000);
  return videoId;
}

/** Polls until Meta has transcoded the video, or gives up with a clear reason. */
async function waitForVideo(
  videoId: string,
  accessToken: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const params = new URLSearchParams({
      fields: "status",
      access_token: accessToken,
    });
    const response = await fetch(
      `${GRAPH_BASE}/${videoId}?${params.toString()}`,
    );
    const body = await response.json();
    if (!response.ok || body.error) throw toLaunchError(body);

    const phase = body.status?.video_status as string | undefined;
    if (phase === "ready") return;

    if (phase === "error") {
      throw new MetaLaunchError(
        "Meta could not process this video.",
        null,
        null,
        body.status?.processing_progress
          ? `Stopped at ${body.status.processing_progress}%.`
          : null,
      );
    }

    if (Date.now() > deadline) {
      throw new MetaLaunchError(
        "Meta is still processing this video.",
        null,
        null,
        "Uploaded successfully but not ready in time. It usually finishes on its own — try again in a few minutes.",
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

export type CreativeInput = {
  name: string;
  pageId: string;
  /** Empty for a video ad. */
  imageHash: string;
  /** The body text above the image. */
  primaryText: string;
  headline: string;
  description: string | null;
  linkUrl: string;
  callToAction: string;
  instagramActorId: string | null;
  /**
   * Set for a video ad. Meta uses a different story spec entirely — video_data
   * rather than link_data — so this is not an optional extra field but a fork
   * in what is being created.
   */
  videoId?: string | null;
  /** Thumbnail for the video. Meta requires one. */
  videoThumbnailUrl?: string | null;
};

export async function createAdCreative(
  adAccountId: string,
  accessToken: string,
  input: CreativeInput,
  validateOnly = false,
): Promise<{ id: string }> {
  const storySpec: Record<string, unknown> = input.videoId
    ? {
        page_id: input.pageId,
        video_data: {
          video_id: input.videoId,
          // Meta rejects a video creative without a thumbnail. When one was
          // not given it falls back to the frame Meta picked itself.
          ...(input.videoThumbnailUrl
            ? { image_url: input.videoThumbnailUrl }
            : {}),
          message: input.primaryText,
          title: input.headline,
          ...(input.description ? { link_description: input.description } : {}),
          // The link lives inside the call to action for video, not beside it.
          call_to_action: {
            type: input.callToAction,
            value: { link: input.linkUrl },
          },
        },
      }
    : {
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

/**
 * Whether the new ads start delivering.
 *
 * PAUSED is the default and the safe answer, but not the only allowed one:
 * launching ads that actually run is the point of a launcher, and forcing
 * every batch to be switched on by hand in Ads Manager afterwards just moves
 * the risk somewhere with less context. ACTIVE is deliberate — the caller has
 * to ask for it, and the screen states what will begin spending.
 *
 * Either way the ad set governs *when*: an ad set with a future start_time
 * does not deliver today just because its ads are active.
 */
export type LaunchStatus = "PAUSED" | "ACTIVE";

export async function createAd(
  adAccountId: string,
  accessToken: string,
  input: {
    name: string;
    adsetId: string;
    creativeId: string;
    status: LaunchStatus;
  },
  validateOnly = false,
): Promise<{ id: string }> {
  return graphPost<{ id: string }>(
    `${adAccountId}/ads`,
    {
      name: input.name,
      adset_id: input.adsetId,
      creative: JSON.stringify({ creative_id: input.creativeId }),
      status: input.status,
    },
    accessToken,
    validateOnly,
  );
}
