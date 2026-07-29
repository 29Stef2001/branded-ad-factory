/**
 * Turning Meta's insights payload into our metric columns. Pure — no IO.
 *
 * Meta does not return conversions as fields. They arrive as an `actions` array
 * of `{ action_type, value }` and a parallel `action_values` array for revenue,
 * with several action types meaning the same thing depending on how the pixel
 * was set up. Getting this mapping wrong is silent: the numbers still add up,
 * they are just the wrong numbers.
 */

export type MetaAction = { action_type: string; value: string | number };

export type MetaInsightRow = {
  date_start?: string;
  date_stop?: string;
  ad_id?: string;
  impressions?: string | number;
  reach?: string | number;
  frequency?: string | number;
  spend?: string | number;
  clicks?: string | number;
  inline_link_clicks?: string | number;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  outbound_clicks?: MetaAction[];
  video_play_actions?: MetaAction[];
  video_p25_watched_actions?: MetaAction[];
  video_p50_watched_actions?: MetaAction[];
  video_p75_watched_actions?: MetaAction[];
  video_p100_watched_actions?: MetaAction[];
  video_thruplay_watched_actions?: MetaAction[];
};

export type DailyInsight = {
  statDate: string;
  metaAdId: string;

  impressions: number;
  reach: number;
  frequency: number | null;
  spend: number;

  clicks: number;
  linkClicks: number;
  outboundClicks: number;
  landingPageViews: number;
  postEngagements: number;

  purchases: number;
  revenue: number;
  addToCart: number;
  addToCartValue: number;
  initiateCheckout: number;
  initiateCheckoutValue: number;
  leads: number;
  registrations: number;

  videoPlays: number;
  videoP25: number;
  videoP50: number;
  videoP75: number;
  videoP100: number;
  videoThruplays: number;
};

/**
 * Action types per concept, most specific first.
 *
 * `omni_*` aggregates across pixel, app and offline, and double-counts against
 * the individual types — so exactly one match is taken per concept rather than
 * summing every entry that looks relevant. That summing bug is the classic way
 * a dashboard ends up reporting twice the real purchase count.
 */
const ACTION_TYPES = {
  purchase: [
    "omni_purchase",
    "purchase",
    "offsite_conversion.fb_pixel_purchase",
  ],
  addToCart: [
    "omni_add_to_cart",
    "add_to_cart",
    "offsite_conversion.fb_pixel_add_to_cart",
  ],
  initiateCheckout: [
    "omni_initiated_checkout",
    "initiate_checkout",
    "offsite_conversion.fb_pixel_initiate_checkout",
  ],
  lead: ["lead", "offsite_conversion.fb_pixel_lead"],
  registration: [
    "complete_registration",
    "offsite_conversion.fb_pixel_complete_registration",
  ],
  landingPageView: ["landing_page_view"],
  postEngagement: ["post_engagement"],
} as const;

function toNumber(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** The first matching action type's value, or 0. Never sums across aliases. */
export function actionValue(
  actions: MetaAction[] | undefined,
  types: readonly string[],
): number {
  if (!actions?.length) return 0;
  for (const type of types) {
    const hit = actions.find((action) => action.action_type === type);
    if (hit) return toNumber(hit.value);
  }
  return 0;
}

/** Total across every entry — for fields Meta breaks down by click type. */
function sumActions(actions: MetaAction[] | undefined): number {
  if (!actions?.length) return 0;
  return actions.reduce((total, action) => total + toNumber(action.value), 0);
}

export function parseInsightRow(row: MetaInsightRow): DailyInsight | null {
  // Without an ad id and a date there is nothing to key the fact row on.
  if (!row.ad_id || !row.date_start) return null;

  return {
    statDate: row.date_start,
    metaAdId: row.ad_id,

    impressions: toNumber(row.impressions),
    reach: toNumber(row.reach),
    frequency: row.frequency === undefined ? null : toNumber(row.frequency),
    spend: toNumber(row.spend),

    clicks: toNumber(row.clicks),
    linkClicks: toNumber(row.inline_link_clicks),
    outboundClicks: sumActions(row.outbound_clicks),
    landingPageViews: actionValue(row.actions, ACTION_TYPES.landingPageView),
    postEngagements: actionValue(row.actions, ACTION_TYPES.postEngagement),

    purchases: actionValue(row.actions, ACTION_TYPES.purchase),
    revenue: actionValue(row.action_values, ACTION_TYPES.purchase),
    addToCart: actionValue(row.actions, ACTION_TYPES.addToCart),
    addToCartValue: actionValue(row.action_values, ACTION_TYPES.addToCart),
    initiateCheckout: actionValue(row.actions, ACTION_TYPES.initiateCheckout),
    initiateCheckoutValue: actionValue(
      row.action_values,
      ACTION_TYPES.initiateCheckout,
    ),
    leads: actionValue(row.actions, ACTION_TYPES.lead),
    registrations: actionValue(row.actions, ACTION_TYPES.registration),

    videoPlays: sumActions(row.video_play_actions),
    videoP25: sumActions(row.video_p25_watched_actions),
    videoP50: sumActions(row.video_p50_watched_actions),
    videoP75: sumActions(row.video_p75_watched_actions),
    videoP100: sumActions(row.video_p100_watched_actions),
    videoThruplays: sumActions(row.video_thruplay_watched_actions),
  };
}

/**
 * How far back to re-fetch on every sync.
 *
 * Meta revises the last ~28 days as attribution settles, so yesterday's numbers
 * are not final. Re-fetching the whole window and upserting is the difference
 * between a fact table that converges on the truth and one that is permanently
 * a few percent wrong in a way nobody notices.
 */
export const RESTATEMENT_WINDOW_DAYS = 28;

/** True once a date has aged out of the restatement window. */
export function isFinal(statDate: string, today = new Date()): boolean {
  const stat = new Date(`${statDate}T00:00:00Z`);
  const ageDays = Math.floor(
    (today.getTime() - stat.getTime()) / (24 * 60 * 60 * 1000),
  );
  return ageDays > RESTATEMENT_WINDOW_DAYS;
}
