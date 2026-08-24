import { z } from "zod";

/**
 * What one discovered competitor candidate looks like. Pure — no IO.
 *
 * This is knowledge-based discovery, not a live web search: Claude proposes
 * candidates from its own knowledge of the brand's category and the context
 * given (brand_profiles), not from crawling the web. That means it is
 * unlikely to know a candidate's exact numeric Meta Page ID — websiteUrl is
 * the field it can reasonably supply, and is what a future
 * PublicWebResearchProvider or Foreplay's getBrandsByDomain would enrich
 * from. Nothing here is ever inserted into `competitors` directly; every
 * candidate lands in `suggested_competitors`, pending review.
 */

export const COMPETITOR_TYPES = [
  "DIRECT",
  "INDIRECT",
  "ADJACENT",
  "ASPIRATIONAL",
] as const;

export const discoveredCompetitorSchema = z.object({
  name: z.string(),
  websiteUrl: z
    .string()
    .nullable()
    .describe(
      "Best-guess company domain, e.g. https://example.com — null if genuinely unknown rather than guessed.",
    ),
  competitorType: z.enum(COMPETITOR_TYPES),
  relevanceScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      "How confident this is a genuine, relevant competitor for this brand — a coarse sorting signal, not a calibrated probability.",
    ),
  relevanceReasoning: z
    .string()
    .describe(
      "Which overlaps drove this: product, audience, category, price positioning, use-case, or positioning. Specific, not generic.",
    ),
});

export const discoveryResultSchema = z.object({
  candidates: z.array(discoveredCompetitorSchema),
});

export type DiscoveredCompetitor = z.infer<typeof discoveredCompetitorSchema>;

/** Bumped when the prompt changes, which invalidates every cached result. */
export const DISCOVERY_PROMPT_VERSION = "discovery-1";
