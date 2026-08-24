import { z } from "zod";

/**
 * Input/output schemas for every tool the Hermes MCP gateway exposes. Pure —
 * no IO. Kept separate from the tool handlers so the contract (what Hermes
 * can send, what it gets back) is readable in one place, and so
 * `registerTool`'s `inputSchema` always matches what the handler actually
 * expects — Zod validates both ends, per the "typed, validated, structured"
 * requirement for this boundary.
 */

export const metaGetWinnersInput = z.object({
  windowDays: z.number().int().refine((v) => [7, 14, 30, 90, 0].includes(v), {
    message: "windowDays must be one of 7, 14, 30, 90, or 0 (lifetime)",
  }).default(30),
  limit: z.number().int().min(1).max(100).default(20),
});

export const metaGetCreativeDnaInput = z.object({
  adAccountIds: z.array(z.string()).min(1),
});

export const competitorResearchInput = z.object({
  competitorId: z.string().uuid(),
});

export const competitorGetCreativeDnaInput = z.object({});

export const competitorGetWhitespaceInput = z.object({});

export const factoryGetStatusInput = z.object({});

export const approvalGetStatusInput = z.object({
  batchId: z.string().uuid(),
});

export const competitorDiscoverInput = z.object({
  /** Upper bound on how many candidates to generate this run — see spec's minimum-5/normal-10-20 guidance. */
  maxCandidates: z.number().int().min(1).max(30).default(15),
});

/**
 * One ad as Hermes itself observed it — via its own browser automation, not
 * an API we call. Every field but the URL/text ones is optional because
 * Hermes is reporting what a page actually showed it, not filling out a
 * fixed API response shape; the `.refine` below only requires that *some*
 * genuinely useful field was reported, so an empty shell can't be submitted.
 */
export const competitorAdSubmission = z
  .object({
    externalId: z
      .string()
      .max(500)
      .optional()
      .describe(
        "A stable identifier for this ad if one exists at its source (e.g. its archive/ad ID or its exact URL) — used to avoid re-submitting the same ad on a later research pass. Omit if none is available; one will be derived from the other fields.",
      ),
    pageName: z.string().max(200).nullable().optional(),
    bodyText: z.string().max(5000).nullable().optional(),
    linkTitle: z.string().max(500).nullable().optional(),
    linkDescription: z.string().max(2000).nullable().optional(),
    snapshotUrl: z
      .string()
      .max(2000)
      .nullable()
      .optional()
      .describe("A URL where a human could view this ad at its source."),
    creativeImageUrl: z.string().max(2000).nullable().optional(),
    creativeVideoUrl: z.string().max(2000).nullable().optional(),
    landingPageUrl: z.string().max(2000).nullable().optional(),
    firstSeenAt: z
      .string()
      .nullable()
      .optional()
      .describe("ISO date/time this ad was first observed, if known."),
    isActive: z.boolean().nullable().optional(),
  })
  .refine(
    (ad) =>
      Boolean(
        ad.bodyText || ad.linkTitle || ad.snapshotUrl || ad.creativeImageUrl,
      ),
    {
      message:
        "At least one of bodyText, linkTitle, snapshotUrl, or creativeImageUrl is required — an ad with none of these carries nothing worth recording.",
    },
  );

export const competitorAdsSubmitInput = z.object({
  competitorId: z.string().uuid(),
  ads: z.array(competitorAdSubmission).min(1).max(100),
});
