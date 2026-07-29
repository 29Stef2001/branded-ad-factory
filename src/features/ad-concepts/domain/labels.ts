import type { StatusTone } from "@/components/data/status-badge";

/**
 * Every user-facing name for a stored enum value, defined once.
 *
 * Four pages were each turning snake_case into prose with their own
 * `replace(/_/g, " ")`, which shows "qa in progress" and "moderate variation"
 * and disagrees between screens. Worse, "failed" was used for two unrelated
 * things: a generation that errored, and an image QA rejected. Those now read
 * differently, because conflating them makes the QA counts impossible to trust.
 */

export const GENERATION_STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  generating: "Generating image",
  generated: "Image ready",
  qa_in_progress: "Reviewing",
  qa_failed: "Review failed",
  retrying: "Retrying",
  // QA judged it and said no — the image exists.
  needs_review: "Needs review",
  approved: "Approved",
  rejected: "Rejected",
  ready_for_publishing: "Ready to publish",
  published: "Published",
  // Generation itself errored — there is no image at all.
  failed: "Generation failed",
};

export const GENERATION_STATUS_TONES: Record<string, StatusTone> = {
  queued: "muted",
  generating: "accent",
  generated: "success",
  qa_in_progress: "accent",
  qa_failed: "warning",
  retrying: "warning",
  needs_review: "warning",
  approved: "success",
  rejected: "danger",
  ready_for_publishing: "success",
  published: "success",
  failed: "danger",
};

export const STRATEGY_LABELS: Record<string, string> = {
  control: "Control",
  close_variation: "Close variation",
  moderate_variation: "Moderate variation",
  exploration: "Exploration",
};

/**
 * Display order for the Brand Assets page: the three assets generation must
 * never invent come first, because a missing one of those is the difference
 * between a real creative and a plausible-looking fake. Stated explicitly
 * rather than relying on object key order.
 */
export const ASSET_TYPE_ORDER = [
  "owner",
  "product",
  "logo",
  "icon",
  "packaging",
  "business_card",
  "thank_you_card",
  "shopping_bag",
  "storefront",
  "other",
] as const;

export const ASSET_ROLE_LABELS: Record<string, string> = {
  product: "Product",
  owner: "Owner",
  logo: "Logo",
  icon: "Icon",
  packaging: "Packaging",
  business_card: "Business card",
  thank_you_card: "Thank-you card",
  shopping_bag: "Shopping bag",
  storefront: "Storefront",
  other: "Other",
};

export const WRITING_STYLE_LABELS: Record<string, string> = {
  direct_response: "Direct response",
  conversational: "Conversational",
  editorial: "Editorial",
  minimal: "Minimal",
  storytelling: "Storytelling",
};

export const PHOTOGRAPHY_STYLE_LABELS: Record<string, string> = {
  documentary: "Documentary",
  ugc: "UGC",
  studio: "Studio",
  editorial: "Editorial",
  lifestyle: "Lifestyle",
  flat_lay: "Flat lay",
};

export const PRICE_POSITIONING_LABELS: Record<string, string> = {
  budget: "Budget",
  mid_market: "Mid-market",
  premium: "Premium",
  luxury: "Luxury",
};

export const FOUNDER_GENDER_LABELS: Record<string, string> = {
  female: "Female",
  male: "Male",
  non_binary: "Non-binary",
  unspecified: "Prefer not to say",
};

export const EMBOSS_STYLE_LABELS: Record<string, string> = {
  none: "None",
  embossed: "Embossed",
  debossed: "Debossed",
  engraved: "Engraved",
  custom: "Custom",
};

export const FOIL_STYLE_LABELS: Record<string, string> = {
  none: "None",
  copper: "Copper",
  gold: "Gold",
  silver: "Silver",
  custom: "Custom",
};

/**
 * Falls back to a readable version of the raw value rather than hiding it: an
 * unmapped value should look wrong in review, not disappear in production.
 */
export function labelFor(
  map: Record<string, string>,
  value: string | null | undefined,
): string {
  if (!value) return "";
  return map[value] ?? value.replace(/_/g, " ");
}

/**
 * Dropdown options for a stored vocabulary, built from the enum that mirrors
 * the database constraint plus the shared labels.
 *
 * The Brand Profile form used to hand-type both halves, so it carried a second
 * copy of every option list — a value added to an enum reached the database
 * and the prompts but never the form. Deriving them means the form cannot fall
 * behind the schema.
 */
export function optionsFor(
  values: readonly string[],
  map: Record<string, string>,
): { value: string; label: string }[] {
  return values.map((value) => ({ value, label: labelFor(map, value) }));
}
