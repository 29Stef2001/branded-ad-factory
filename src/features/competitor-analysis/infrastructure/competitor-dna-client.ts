import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  COMPETITOR_DNA_PROMPT_VERSION,
  competitorDnaSchema,
  type CompetitorDna,
} from "@/features/competitor-analysis/domain/competitor-dna";
import { capList } from "@/lib/ai/cap-list";
import { env } from "@/lib/env";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

/**
 * Reads what a competitor ad is doing, from its copy alone.
 *
 * Text-only, unlike creative-intelligence's dna-client: the Ad Library API
 * gives no image or video for a competitor's ad, only a link to Meta's own
 * preview page. Everything categorical is still a closed list enforced by the
 * schema — a value it invents is rejected rather than stored as a segment of
 * one, same as creative_features.
 */

export type CompetitorDnaInput = {
  pageName: string | null;
  bodyText: string | null;
  linkTitle: string | null;
  linkDescription: string | null;
};

export type CompetitorDnaResult = {
  dna: CompetitorDna;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  promptVersion: string;
};

const MODEL = "claude-opus-5";

export async function analyseCompetitorAdDna(
  input: CompetitorDnaInput,
): Promise<CompetitorDnaResult> {
  const message = await client.messages.parse({
    model: MODEL,
    max_tokens: 2048,
    output_config: {
      format: zodOutputFormat(competitorDnaSchema),
      effort: "medium",
    },
    messages: [
      {
        role: "user",
        content: `Describe this competitor's Meta ad copy so it can be compared with our own creatives on the same terms.

${input.pageName ? `Page: ${input.pageName}\n` : ""}${input.linkTitle ? `Link title: ${input.linkTitle}\n` : ""}${input.bodyText ? `Body copy: ${input.bodyText}\n` : ""}${input.linkDescription ? `Link description: ${input.linkDescription}\n` : ""}
Every categorical field must come from its allowed list. Where the copy genuinely does not fit any of them, or there is too little text to tell, answer null — a wrong category is worse than an admitted gap, because it silently joins a group it does not belong to.

For hookText, quote the actual opening line of the body copy rather than paraphrasing it.

observedFacts must be things literally present in the text: a quoted phrase, the stated call to action, a specific claim or number. inferredHypotheses is your reasoned judgement about strategy or audience — use hedged language ("likely", "appears to") rather than asserting it as fact. Neither list is about how well this ad performs: you have no spend, CPA or ROAS for it, only the copy, so do not imply a performance judgement in either list. At most five items each, and fewer is better than padding.`,
      },
    ],
  });

  const parsed = message.parsed_output;
  if (!parsed) {
    throw new Error("The model returned no structured analysis.");
  }

  return {
    // Trimmed rather than rejected — see capList. The prompt asks for at
    // most five of each; a model that offers six has not made a mistake
    // worth discarding a whole paid analysis over.
    dna: {
      ...parsed,
      observedFacts: capList(parsed.observedFacts, 5),
      inferredHypotheses: capList(parsed.inferredHypotheses, 5),
    },
    usage: {
      inputTokens: message.usage?.input_tokens ?? 0,
      outputTokens: message.usage?.output_tokens ?? 0,
    },
    model: MODEL,
    promptVersion: COMPETITOR_DNA_PROMPT_VERSION,
  };
}
