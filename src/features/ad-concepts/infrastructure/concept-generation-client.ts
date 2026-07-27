import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  conceptSchema,
  conceptsOutputSchemaV2,
  type Concept,
  type ConceptsOutputV2,
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

export type BrandStyleInput = {
  brandColors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
  } | null;
  typographyNotes: string | null;
  embossStyle: string | null;
  embossCustomNotes: string | null;
  foilStyle: string | null;
  foilCustomNotes: string | null;
};

export type InspirationInput = {
  competitorName: string;
  adCopy: string;
  messagingAngle: string;
} | null;

function formatBrandStyle(style: BrandStyleInput): string {
  const lines: string[] = [];
  if (style.brandColors) {
    const colors = Object.entries(style.brandColors)
      .filter(([, value]) => value)
      .map(([role, value]) => `${role}: ${value}`)
      .join(", ");
    if (colors) lines.push(`Brand colors — ${colors}`);
  }
  if (style.typographyNotes)
    lines.push(`Typography — ${style.typographyNotes}`);
  if (style.embossStyle && style.embossStyle !== "none") {
    lines.push(
      `Emboss treatment — ${style.embossStyle}${style.embossCustomNotes ? ` (${style.embossCustomNotes})` : ""}`,
    );
  }
  if (style.foilStyle && style.foilStyle !== "none") {
    lines.push(
      `Foil treatment — ${style.foilStyle}${style.foilCustomNotes ? ` (${style.foilCustomNotes})` : ""}`,
    );
  }
  return lines.length > 0
    ? `\n\nBrand style settings:\n${lines.join("\n")}`
    : "";
}

export async function generateConcepts(
  brandProfile: BrandProfileInput,
  brandStyle: BrandStyleInput,
  brief: string,
  enabledMessages: string[],
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
    max_tokens: 4096,
    output_config: {
      format: zodOutputFormat(conceptsOutputSchemaV2),
      effort: "high",
    },
    messages: [
      {
        role: "user",
        content: `You are a senior direct-response creative strategist producing realistic, high-converting ad concepts — the kind that win on Facebook and Instagram through authenticity, urgency, and documentary-style realism, not polished studio advertising.

Brand: ${brandProfile.brandName}
Industry: ${brandProfile.industry}
Tone of voice: ${brandProfile.tone}
Target audience: ${brandProfile.targetAudience}
Unique selling points: ${brandProfile.uniqueSellingPoints}${formatBrandStyle(brandStyle)}

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
  brandProfile: BrandProfileInput,
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
        content: `You are a senior ad copywriter. Refine the following ad concept for "${brandProfile.brandName}" (${brandProfile.industry}, tone: ${brandProfile.tone}) based on the given instruction. Keep what already works; only change what the instruction asks for.

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
