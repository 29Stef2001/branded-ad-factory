/**
 * Meta's own rules about which settings go together. Pure — no IO.
 *
 * These are not preferences. Meta rejects an ad set whose optimization goal
 * does not match its campaign's objective — error 1885760, "Optimization for
 * Ad Delivery Selections Must Be the Same" — and it only says so at creation
 * time. Deriving the goal from the objective means the form cannot offer a
 * combination that is going to fail.
 */

export type Objective =
  | "OUTCOME_SALES"
  | "OUTCOME_LEADS"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_AWARENESS"
  | "OUTCOME_APP_PROMOTION";

export const OBJECTIVE_LABELS: Record<Objective, string> = {
  OUTCOME_SALES: "Sales",
  OUTCOME_LEADS: "Leads",
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_AWARENESS: "Awareness",
  OUTCOME_APP_PROMOTION: "App promotion",
};

/**
 * The optimization goal each objective expects.
 *
 * One per objective rather than a list of valid options: offering a choice
 * here would be offering ways to get it wrong, and the default is what almost
 * every campaign of that objective actually uses.
 */
const GOAL_FOR_OBJECTIVE: Record<Objective, string> = {
  OUTCOME_SALES: "OFFSITE_CONVERSIONS",
  OUTCOME_LEADS: "LEAD_GENERATION",
  OUTCOME_TRAFFIC: "LINK_CLICKS",
  OUTCOME_ENGAGEMENT: "POST_ENGAGEMENT",
  OUTCOME_AWARENESS: "REACH",
  OUTCOME_APP_PROMOTION: "APP_INSTALLS",
};

export function optimizationGoalFor(objective: Objective): string {
  return GOAL_FOR_OBJECTIVE[objective];
}

/**
 * Impressions for every objective.
 *
 * A constant rather than a lookup because that is the honest shape: Meta
 * accepts IMPRESSIONS for all of these, and a per-objective table implying
 * otherwise would be a map whose branches all return the same thing.
 */
export const BILLING_EVENT = "IMPRESSIONS";

/**
 * Whether this objective needs a pixel bound to the ad set.
 *
 * Conversion optimisation without a promoted_object is rejected outright, so
 * the form has to require a pixel for these rather than let it through.
 */
export function requiresPixel(objective: Objective): boolean {
  return objective === "OUTCOME_SALES" || objective === "OUTCOME_LEADS";
}

export const CONVERSION_EVENTS = [
  "PURCHASE",
  "ADD_TO_CART",
  "INITIATE_CHECKOUT",
  "LEAD",
  "COMPLETE_REGISTRATION",
  "ADD_PAYMENT_INFO",
  "CONTENT_VIEW",
] as const;

export const CALL_TO_ACTIONS = [
  "SHOP_NOW",
  "LEARN_MORE",
  "SIGN_UP",
  "BUY_NOW",
  "GET_OFFER",
  "ORDER_NOW",
  "SUBSCRIBE",
  "CONTACT_US",
] as const;

/**
 * Money as Meta wants it: minor units of the account currency.
 *
 * £20.00 is 2000, not 20. Sending 20 buys twenty pence of delivery a day and
 * looks like the ad simply is not running.
 */
export function toMinorUnits(amount: string | number): number | null {
  const value = typeof amount === "number" ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export function fromMinorUnits(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  return (minor / 100).toFixed(2);
}

/** ISO-3166-1 alpha-2, from a comma-separated field. */
export function parseCountries(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[,\s]+/)
        .map((code) => code.trim().toUpperCase())
        .filter((code) => /^[A-Z]{2}$/.test(code)),
    ),
  ];
}

export type LaunchValidation = { field: string; message: string };

export type BatchDraft = {
  adAccountId: string;
  pageId: string;
  campaignName: string;
  objective: Objective;
  dailyBudget: string;
  countries: string;
  ageMin: number;
  ageMax: number;
  startTime: string | null;
  pixelId: string | null;
  customEventType: string;
  ads: {
    primaryText: string;
    headline: string;
    description: string;
    callToAction: string;
    linkUrl: string;
    imageUrl: string;
  }[];
};

/**
 * Everything wrong with a draft, before a single call is made.
 *
 * Returns all of it at once rather than the first failure: a launch form with
 * eight ads should not be a game of fixing one field, submitting, and being
 * told about the next.
 */
export function validateDraft(draft: BatchDraft): LaunchValidation[] {
  const problems: LaunchValidation[] = [];

  if (!draft.adAccountId) {
    problems.push({ field: "adAccountId", message: "Pick an ad account." });
  }
  if (!draft.pageId) {
    // Every creative names a Page; there is no ad without one.
    problems.push({ field: "pageId", message: "Pick a Facebook Page." });
  }
  if (!draft.campaignName.trim()) {
    problems.push({ field: "campaignName", message: "Name the campaign." });
  }

  if (toMinorUnits(draft.dailyBudget) === null) {
    problems.push({
      field: "dailyBudget",
      message: "Daily budget must be a positive amount.",
    });
  }

  if (parseCountries(draft.countries).length === 0) {
    problems.push({
      field: "countries",
      message: "Add at least one country code, e.g. GB or US.",
    });
  }

  if (draft.ageMin < 13 || draft.ageMax > 65 || draft.ageMin > draft.ageMax) {
    problems.push({
      field: "age",
      message: "Age range must sit between 13 and 65, lowest first.",
    });
  }

  if (requiresPixel(draft.objective) && !draft.pixelId) {
    problems.push({
      field: "pixelId",
      message: `${OBJECTIVE_LABELS[draft.objective]} campaigns optimise for a conversion, so they need a pixel.`,
    });
  }

  if (draft.startTime) {
    // Meta refuses a start in the past, and reports it as an unhelpful
    // parameter error rather than saying so.
    if (new Date(draft.startTime).getTime() < Date.now()) {
      problems.push({
        field: "startTime",
        message: "Start time cannot be in the past.",
      });
    }
  }

  if (draft.ads.length === 0) {
    problems.push({ field: "ads", message: "Add at least one ad." });
  }

  draft.ads.forEach((ad, index) => {
    const at = (message: string) => ({ field: `ads.${index}`, message });

    if (!ad.primaryText.trim()) problems.push(at("Primary text is required."));
    if (!ad.headline.trim()) problems.push(at("Headline is required."));
    if (!ad.imageUrl.trim()) problems.push(at("An image is required."));

    for (const [label, value] of [
      ["Destination URL", ad.linkUrl],
      ["Image URL", ad.imageUrl],
    ] as const) {
      if (value.trim() && !/^https?:\/\//i.test(value.trim())) {
        problems.push(at(`${label} must start with http:// or https://`));
      }
    }
    if (!ad.linkUrl.trim()) problems.push(at("Destination URL is required."));
  });

  return problems;
}
