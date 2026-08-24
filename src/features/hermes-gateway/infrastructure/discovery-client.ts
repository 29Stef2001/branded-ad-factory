import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  DISCOVERY_PROMPT_VERSION,
  discoveryResultSchema,
  type DiscoveredCompetitor,
} from "@/features/hermes-gateway/domain/discovery-schema";
import { env } from "@/lib/env";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

/**
 * Proposes competitor candidates from brand context. Knowledge-based, not a
 * live web search — Claude reasons from what it already knows about the
 * category plus the brand context given, the same way `concept-generation-client.ts`
 * reasons from `brand_profiles` for ad concepts. Explicitly instructed to
 * flag uncertainty rather than invent a confident-sounding but fabricated
 * competitor.
 */

export type BrandContext = {
  brandName: string;
  brandCategory: string | null;
  targetAudience: string | null;
  markets: string[] | null;
  usps: string[] | null;
  materials: string[] | null;
  pricePositioning: string | null;
  productPositioning: string | null;
};

export type DiscoveryResult = {
  candidates: DiscoveredCompetitor[];
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  promptVersion: string;
};

const MODEL = "claude-opus-5";

export async function discoverCompetitors(
  brand: BrandContext,
  maxCandidates: number,
): Promise<DiscoveryResult> {
  const message = await client.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    output_config: {
      format: zodOutputFormat(discoveryResultSchema),
      effort: "high",
    },
    messages: [
      {
        role: "user",
        content: `Propose up to ${maxCandidates} real, currently-operating brands that compete with the brand described below for the same advertising dollars and customer attention on Meta (Facebook/Instagram).

Brand: ${brand.brandName}
${brand.brandCategory ? `Category: ${brand.brandCategory}\n` : ""}${brand.targetAudience ? `Target audience: ${brand.targetAudience}\n` : ""}${brand.markets?.length ? `Markets: ${brand.markets.join(", ")}\n` : ""}${brand.usps?.length ? `Unique selling points: ${brand.usps.join("; ")}\n` : ""}${brand.materials?.length ? `Materials/product basis: ${brand.materials.join(", ")}\n` : ""}${brand.pricePositioning ? `Price positioning: ${brand.pricePositioning}\n` : ""}${brand.productPositioning ? `Product positioning: ${brand.productPositioning}\n` : ""}

Classify each candidate:
- DIRECT: sells a comparable product to the same audience at a comparable price point.
- INDIRECT: solves the same customer need with a different kind of product.
- ADJACENT: same category or audience, but a meaningfully different angle (e.g. different price tier, different sub-niche).
- ASPIRATIONAL: a bigger/more premium brand this business is positioning itself against or wants to be compared to.

Only include brands you have genuine knowledge of — real, currently-operating companies, not invented or generic placeholder names. If you are not confident a brand actually exists and competes in this space, leave it out rather than including it with a low relevanceScore — a wrong brand name is worse than a shorter list. For websiteUrl, give the real domain only if you're confident of it; use null rather than guessing.

Give concrete, specific relevanceReasoning per candidate — name the actual overlap (shared materials, shared price tier, shared audience age range, etc.), not a generic "similar industry."`,
      },
    ],
  });

  const parsed = message.parsed_output;
  if (!parsed) {
    throw new Error("The model returned no structured discovery result.");
  }

  return {
    candidates: parsed.candidates,
    usage: {
      inputTokens: message.usage?.input_tokens ?? 0,
      outputTokens: message.usage?.output_tokens ?? 0,
    },
    model: MODEL,
    promptVersion: DISCOVERY_PROMPT_VERSION,
  };
}
