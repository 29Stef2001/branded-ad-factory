import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { WhitespaceResult } from "@/features/market-intelligence/domain/whitespace-analysis";
import { dnaLabel } from "@/features/creative-intelligence/domain/creative-dna";
import { env } from "@/lib/env";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

/**
 * Turns the aggregated pattern diff into short, readable observations.
 *
 * The numbers are computed already (domain/whitespace-analysis.ts) — this
 * only phrases them. It never receives raw ad copy, so it cannot invent a
 * pattern the aggregation didn't find, and the prompt explicitly forbids
 * claiming anything about competitor performance: there is no spend, CPA or
 * ROAS for their ads, only what patterns appear in their copy.
 */

const narrativeSchema = z.object({
  observations: z.array(z.string()).max(5),
});

export type WhitespaceNarrativeResult = {
  observations: string[];
  usage: { inputTokens: number; outputTokens: number };
  model: string;
};

const MODEL = "claude-opus-5";

function describe(patterns: WhitespaceResult["sharedPatterns"]): string {
  if (patterns.length === 0) return "(none)";
  return patterns
    .map(
      (pattern) =>
        `${pattern.category} = ${dnaLabel(pattern.value)}: us ${pattern.oursPct.toFixed(0)}%, competitors ${pattern.theirsPct.toFixed(0)}%`,
    )
    .join("\n");
}

export async function generateWhitespaceNarrative(
  result: WhitespaceResult,
): Promise<WhitespaceNarrativeResult> {
  const message = await client.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    output_config: {
      format: zodOutputFormat(narrativeSchema),
      effort: "medium",
    },
    messages: [
      {
        role: "user",
        content: `Compare how our winning creatives and our competitors' ads use the same closed vocabulary (hook type, angle, offer type, emotional driver), and phrase 3-5 short, concrete observations a media buyer could act on.

Shared patterns (both sides cluster here):
${describe(result.sharedPatterns)}

Competitor-leaning patterns (they use this noticeably more than we do):
${describe(result.competitorLeaning)}

Whitespace (we use this, competitors barely do):
${describe(result.whitespace)}

Based on ${result.oursSampleSize} of our own analysed creatives and ${result.theirsSampleSize} competitor ads.

Write each observation as a plain statement of the pattern, e.g. "Competitors lean heavily on price-led offers; our strongest creatives are outcome-led — a testable whitespace." Do not invent numbers beyond the percentages given. Do not claim anything about how well competitor ads perform — there is no spend, CPA or ROAS data for them, only what patterns appear in their copy. Label these as observations, not recommendations: you are describing a pattern, not proposing a test.`,
      },
    ],
  });

  const parsed = message.parsed_output;
  if (!parsed) {
    throw new Error("The model returned no structured analysis.");
  }

  return {
    observations: parsed.observations,
    usage: {
      inputTokens: message.usage?.input_tokens ?? 0,
      outputTokens: message.usage?.output_tokens ?? 0,
    },
    model: MODEL,
  };
}
