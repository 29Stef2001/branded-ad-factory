import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  conceptsOutputSchema,
  type ConceptsOutput,
} from "@/features/ad-concepts/domain/schemas";
import { env } from "@/lib/env";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export type BrandProfileInput = {
  brandName: string;
  industry: string;
  tone: string;
  targetAudience: string;
  uniqueSellingPoints: string;
};

export type InspirationInput = {
  competitorName: string;
  adCopy: string;
  messagingAngle: string;
} | null;

export async function generateConcepts(
  brandProfile: BrandProfileInput,
  brief: string,
  inspiration: InspirationInput,
): Promise<ConceptsOutput> {
  const inspirationBlock = inspiration
    ? `\n\nFor inspiration, here is a competitor ad from "${inspiration.competitorName}":\n"""\n${inspiration.adCopy}\n"""\nTheir messaging angle: ${inspiration.messagingAngle}\n\nDeliberately take a DIFFERENT messaging angle than this competitor — do not imitate it.`
    : "";

  const message = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 2048,
    output_config: {
      format: zodOutputFormat(conceptsOutputSchema),
      effort: "high",
    },
    messages: [
      {
        role: "user",
        content: `You are a senior ad copywriter. Generate 3 distinct, original ad concepts for the following brand and campaign brief.

Brand: ${brandProfile.brandName}
Industry: ${brandProfile.industry}
Tone of voice: ${brandProfile.tone}
Target audience: ${brandProfile.targetAudience}
Unique selling points: ${brandProfile.uniqueSellingPoints}

Campaign brief: ${brief}${inspirationBlock}`,
      },
    ],
  });

  if (!message.parsed_output) {
    throw new Error("Claude did not return parsed concepts.");
  }

  return message.parsed_output;
}
