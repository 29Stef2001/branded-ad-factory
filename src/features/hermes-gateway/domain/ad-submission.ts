import { createHash } from "crypto";

/**
 * Pure logic for `competitor_ads_submit` — no IO, so it can be unit tested
 * without pulling in env.ts/the Supabase client the way the tool handler
 * itself does.
 */

export type SubmittedAd = {
  externalId?: string;
  pageName?: string | null;
  bodyText?: string | null;
  linkTitle?: string | null;
  linkDescription?: string | null;
  snapshotUrl?: string | null;
  creativeImageUrl?: string | null;
  creativeVideoUrl?: string | null;
  landingPageUrl?: string | null;
  firstSeenAt?: string | null;
  isActive?: boolean | null;
};

/**
 * A stable id for an ad Hermes reported without one of its own — content
 * addressed, same philosophy as `content_hash` on `creative_features`: two
 * submissions of the same ad (Hermes re-visiting the same page on a later
 * research pass) collapse to the same row instead of duplicating it.
 *
 * Deliberately excludes fields that legitimately change between visits to
 * the same ad (`linkDescription`, `pageName`, `isActive`) — hashing those in
 * would mint a new id, and a new dedup row, every time the page's copy
 * shifts slightly or the ad goes inactive.
 */
export function deriveExternalId(ad: SubmittedAd): string {
  return createHash("sha256")
    .update(
      [ad.snapshotUrl, ad.bodyText, ad.creativeImageUrl, ad.landingPageUrl]
        .map((v) => v ?? "")
        .join("|"),
    )
    .digest("hex");
}
