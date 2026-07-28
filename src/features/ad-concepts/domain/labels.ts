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
