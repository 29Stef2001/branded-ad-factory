import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  DNA_PROMPT_VERSION,
  creativeDnaSchema,
  type CreativeDna,
} from "@/features/creative-intelligence/domain/creative-dna";
import { capList } from "@/lib/ai/cap-list";
import { env } from "@/lib/env";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

/**
 * Reads what a creative is doing, from the creative itself.
 *
 * The performance numbers are given alongside the image on purpose. Asked to
 * describe an ad in a vacuum a model reaches for whatever is most visually
 * striking; asked why an ad with this spend and this ROAS might be working, it
 * looks at the parts that plausibly drove it. The numbers are context for the
 * question, not something to restate.
 *
 * Everything it may answer with is a closed list enforced by the schema, so a
 * hook type it invents is rejected rather than stored as a segment of one.
 */

export type DnaInput = {
  imageBase64: string;
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  adName: string;
  /** Copy Meta holds for this ad, when it is available. */
  bodyText: string | null;
  headline: string | null;
  metrics: {
    impressions: number;
    clicks: number;
    spend: number;
    purchases: number;
    revenue: number;
    ctr: number | null;
    roas: number | null;
    evidenceTier: string;
  };
};

export type DnaResult = {
  dna: CreativeDna;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  promptVersion: string;
};

const MODEL = "claude-opus-5";

export async function analyseCreativeDna(input: DnaInput): Promise<DnaResult> {
  const { metrics } = input;
  const pct = (value: number | null) =>
    value === null ? "unknown" : `${(value * 100).toFixed(2)}%`;

  const message = await client.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    output_config: {
      format: zodOutputFormat(creativeDnaSchema),
      effort: "high",
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Describe this Meta ad creative so it can be compared with hundreds of others.

Ad name: ${input.adName}
${input.headline ? `Headline: ${input.headline}\n` : ""}${input.bodyText ? `Body copy: ${input.bodyText}\n` : ""}
How it performed over the last 30 days:
- Impressions: ${metrics.impressions.toLocaleString("en-GB")}
- Clicks: ${metrics.clicks.toLocaleString("en-GB")} (CTR ${pct(metrics.ctr)})
- Spend: ${metrics.spend.toFixed(2)}
- Purchases: ${metrics.purchases}
- Revenue: ${metrics.revenue.toFixed(2)}${metrics.roas !== null ? ` (ROAS ${metrics.roas.toFixed(2)}x)` : ""}
- Evidence: ${metrics.evidenceTier}

Every categorical field must come from its allowed list. Where the creative genuinely does not fit any of them, or you cannot tell from what you are shown, answer null — a wrong category is worse than an admitted gap, because it silently joins a group it does not belong to.

For hookText, quote the actual opening line of the ad rather than paraphrasing it.

whyItWorks is the one field in your own words. List only what is REPEATABLE — things the next creative could deliberately do again. "Product visible in the first frame" qualifies. "Ran during a heatwave", "the model is attractive", or anything about timing, luck or this specific product does not. If the evidence is only directional, say what you would test rather than what you conclude. At most five items, and fewer is better than padding.`,
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: input.mediaType,
              data: input.imageBase64,
            },
          },
        ],
      },
    ],
  });

  const parsed = message.parsed_output;
  if (!parsed) {
    throw new Error("The model returned no structured analysis.");
  }

  return {
    // See capList: the caps are storage preferences, so they trim.
    dna: {
      ...parsed,
      whyItWorks: capList(parsed.whyItWorks, 5),
      dominantColors: capList(parsed.dominantColors, 4),
    },
    usage: {
      inputTokens: message.usage?.input_tokens ?? 0,
      outputTokens: message.usage?.output_tokens ?? 0,
    },
    model: MODEL,
    promptVersion: DNA_PROMPT_VERSION,
  };
}

/** Meta serves thumbnails as JPEG or PNG; anything else is not worth guessing. */
export function toMediaType(contentType: string | null): DnaInput["mediaType"] {
  const value = (contentType ?? "").toLowerCase();
  if (value.includes("png")) return "image/png";
  if (value.includes("gif")) return "image/gif";
  if (value.includes("webp")) return "image/webp";
  return "image/jpeg";
}
