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
