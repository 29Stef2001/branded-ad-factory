import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  adAnalysisSchema,
  type AdAnalysis,
} from "@/features/competitor-analysis/domain/schemas";
import { env } from "@/lib/env";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export async function analyzeAdCopy(adCopy: string): Promise<AdAnalysis> {
  const message = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: {
      format: zodOutputFormat(adAnalysisSchema),
      effort: "medium",
    },
    messages: [
      {
        role: "user",
        content: `You are a marketing analyst. Analyze the following competitor ad copy and extract its messaging strategy.\n\nAd copy:\n"""\n${adCopy}\n"""`,
      },
    ],
  });

  if (!message.parsed_output) {
    throw new Error("Claude did not return a parsed analysis.");
  }

  return message.parsed_output;
}
