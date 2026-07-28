import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  conceptSchema,
  conceptsOutputSchemaV2,
  type Concept,
  type ConceptsOutputV2,
} from "@/features/ad-concepts/domain/schemas";
import {
  renderBrandHeadline,
  renderBrandIdentity,
  renderBrandStyle,
  renderFounder,
  renderLanguageRule,
  renderRules,
  type BrandContext,
} from "@/features/ad-concepts/domain/brand-context";
import { env } from "@/lib/env";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export type InspirationInput = {
  competitorName: string;
  adCopy: string;
  messagingAngle: string;
} | null;

/**
 * Which asset types the brand actually has on file, and their labels.
 *
 * Passed in so the model stops guessing: it was routinely requiring packaging
 * and thank-you cards that were never uploaded, while ignoring assets that
 * existed. Requirements it names now correspond to something real.
 */
export type AvailableAssetsInput = {
  types: string[];
  tags: string[];
  hasOwner: boolean;
  hasProduct: boolean;
};

function formatAvailableAssets(available: AvailableAssetsInput): string {
  const lines: string[] = [];

  lines.push(
    available.types.length > 0
      ? `Brand assets on file (real reference photos that will be attached to image generation): ${available.types.join(", ")}. Only ever list brandAssetRequirements from this set — anything else is ignored because no such photo exists.`
      : "This brand has no reference photos on file yet, so leave brandAssetRequirements empty.",
  );

  if (available.tags.length > 0) {
    lines.push(
      `Those photos are tagged: ${available.tags.join(", ")}. Use these to judge what the brand actually looks like — they describe real imagery on file, not aspirations.`,
    );
  }

  if (available.hasOwner) {
    lines.push(
      'This brand has a real owner whose photo is on file, and she appears in its creatives. Whenever a concept features a person, that person is her — a woman, the shop\'s owner. Describe `subject` as her, never as an invented character, and never as a man. Always include "owner" in brandAssetRequirements for concepts featuring a person.',
    );
  }

  if (available.hasProduct) {
    lines.push(
      'This brand has real product photography on file. Any jewellery in the scene must be an actual piece from the store, so include "product" in brandAssetRequirements whenever a product is visible — never describe an invented or generic item.',
    );
  }

  return `\n\n${lines.join("\n\n")}`;
}

export async function generateConcepts(
  brand: BrandContext,
  brief: string,
  enabledMessages: string[],
  available: AvailableAssetsInput,
  inspiration: InspirationInput,
): Promise<ConceptsOutputV2> {
  const inspirationBlock = inspiration
    ? `\n\nFor inspiration, here is a competitor ad from "${inspiration.competitorName}":\n"""\n${inspiration.adCopy}\n"""\nTheir messaging angle: ${inspiration.messagingAngle}\n\nDeliberately take a DIFFERENT messaging angle than this competitor — do not imitate it.`
    : "";

  if (enabledMessages.length === 0) {
    throw new Error(
      "No approved promotional messages are enabled — enable at least one before generating concepts.",
    );
  }
  const messagesBlock = enabledMessages.map((m) => `- ${m}`).join("\n");

  const message = await client.messages.parse({
    model: "claude-opus-5",
    // The V2 schema asks for ~20 fields per concept across 3 concepts, several
    // of them long prose — finalGenerationPrompt alone is a complete scene
    // description. 4096 truncated the JSON mid-string, which surfaced as
    // "Failed to parse structured output: Unterminated string", so generation
    // failed outright rather than degrading. Sized with real headroom because
    // the failure mode is total, not partial.
    max_tokens: 16384,
    output_config: {
      format: zodOutputFormat(conceptsOutputSchemaV2),
      effort: "high",
    },
    messages: [
      {
        role: "user",
        content: `You are a senior direct-response creative strategist producing realistic, high-converting ad concepts — the kind that win on Facebook and Instagram through authenticity, urgency, and documentary-style realism, not polished studio advertising.

${renderLanguageRule(brand, "copy")}

${renderBrandIdentity(brand)}

${renderBrandStyle(brand)}

${renderFounder(brand)}

${renderRules(brand, "copy")}${formatAvailableAssets(available)}

Campaign brief: ${brief}${inspirationBlock}

Approved promotional messages — every concept's primaryPromotionalMessage MUST be the EXACT text of exactly one of these (never invent your own promotional copy):
${messagesBlock}

Generate exactly 3 distinct concepts. Assign a mix of strategy types across them (not all identical) — "control" for a safe, proven approach, "close_variation"/"moderate_variation" for measured departures, "exploration" for a bolder swing. Vary which approved message each concept uses where it makes sense, rather than defaulting to the same one for all three.

For each concept, think like you're directing a real photo/video shoot: consider emotional triggers, urgency, authenticity, documentary or UGC-style photography, realistic retail environments, believable owners/staff/customers, physical signage for the promotional message (not a digital overlay), product visibility, mobile readability, and brand consistency. The finalGenerationPrompt field should be a complete, self-contained scene description a photographer or image generation model could act on directly.`,
      },
    ],
  });

  if (!message.parsed_output) {
    throw new Error("Claude did not return parsed concepts.");
  }

  return message.parsed_output;
}

export async function refineConcept(
  original: Concept,
  instruction: string,
  brand: BrandContext,
): Promise<Concept> {
  const message = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: {
      format: zodOutputFormat(conceptSchema),
      effort: "medium",
    },
    messages: [
      {
        role: "user",
        content: `You are a senior ad copywriter. Refine the following ad concept for ${renderBrandHeadline(brand)} based on the given instruction. Keep what already works; only change what the instruction asks for.

Current concept:
Headline: ${original.headline}
Hook: ${original.hook}
Body copy: ${original.bodyCopy}
Visual direction: ${original.visualDirection}
Call to action: ${original.callToAction}

Instruction: ${instruction}`,
      },
    ],
  });

  if (!message.parsed_output) {
    throw new Error("Claude did not return a parsed refined concept.");
  }

  return message.parsed_output;
}
