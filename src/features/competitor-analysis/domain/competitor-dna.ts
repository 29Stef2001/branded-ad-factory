import { z } from "zod";
import {
  HOOK_TYPES,
  ANGLES,
  AWARENESS_LEVELS,
  OFFER_TYPES,
  OFFER_STRENGTHS,
  EMOTIONAL_DRIVERS,
} from "@/features/creative-intelligence/domain/creative-dna";

/**
 * What a competitor ad is doing, read from its copy alone. Pure — no IO.
 *
 * Deliberately shares its vocabulary (hook_type, angle, awareness_level,
 * offer_type, offer_strength, emotional_driver) with creative_features rather
 * than defining its own. That is the entire point: "competitors lean on price,
 * our winners lean on outcome" is only answerable if both sides describe
 * themselves in the same closed terms. A separate vocabulary here would
 * produce the same failure ad_analyses already has — two incomparable piles of
 * free text.
 *
 * No visual fields (format, composition, visual_pattern, brightness...): the
 * Ad Library API gives no image or video, only a link to Meta's own preview
 * page, so there is nothing to read them from. Omitting them says "not
 * available in Phase 1" rather than a field that looks tried and failed.
 */

/** The one field creative_features has no equivalent for — copy is all there is here. */
export const CTA_STYLES = [
  "shop_now",
  "learn_more",
  "sign_up",
  "limited_time",
  "direct_link",
  "shop_the_look",
  "none",
] as const;

export const competitorDnaSchema = z.object({
  hookType: z.enum(HOOK_TYPES).nullable(),
  hookText: z.string().nullable(),
  angle: z.enum(ANGLES).nullable(),
  awarenessLevel: z.enum(AWARENESS_LEVELS).nullable(),
  offerType: z.enum(OFFER_TYPES).nullable(),
  offerStrength: z.enum(OFFER_STRENGTHS).nullable(),
  emotionalDriver: z.enum(EMOTIONAL_DRIVERS).nullable(),
  ctaStyle: z.enum(CTA_STYLES).nullable(),

  /**
   * Literally present in the copy: a quoted phrase, the stated CTA text, a
   * numeric claim. What a person could point to and say "yes, it says that."
   */
  observedFacts: z.array(z.string()),

  /**
   * A reasoned judgement about strategy or audience — hedged, not asserted.
   * Ad Library gives no spend/CPA/ROAS, so nothing here may read as a
   * performance claim; these are about messaging, never about results.
   */
  inferredHypotheses: z.array(z.string()),
});

export type CompetitorDna = z.infer<typeof competitorDnaSchema>;

/** Bumped when the prompt changes, which invalidates every cached result. */
export const COMPETITOR_DNA_PROMPT_VERSION = "competitor-dna-1";

export type CompetitorDnaConfidence = "low" | "medium" | "high";

/**
 * How much text there was to read, not how sure the model felt.
 *
 * Confidence is computed here rather than asked of the model for the same
 * reason evidence_tier in scoring.ts is a fact about the data rather than the
 * model's opinion of itself: a model asked to rate its own confidence tends to
 * answer "high" regardless of input, which would make the field decorative.
 * Word count is a blunt but honest proxy — a two-word ad snippet cannot
 * support a confident hook/angle classification no matter how the model
 * phrases its answer.
 */
export function competitorConfidenceFor(
  bodyText: string | null,
  linkTitle: string | null,
  linkDescription: string | null,
): CompetitorDnaConfidence {
  const wordCount = [bodyText, linkTitle, linkDescription]
    .filter((text): text is string => Boolean(text && text.trim()))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;

  if (wordCount < 15) return "low";
  if (wordCount <= 50) return "medium";
  return "high";
}
