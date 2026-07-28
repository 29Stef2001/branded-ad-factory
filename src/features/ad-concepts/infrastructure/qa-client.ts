import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  qaResultSchema,
  type QaResult,
} from "@/features/ad-concepts/domain/schemas";
import { env } from "@/lib/env";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

/** Media types the Anthropic image block accepts. */
type SupportedMedia = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

function toMediaType(contentType: string): SupportedMedia {
  const base = contentType.split(";")[0].trim().toLowerCase();
  return base === "image/jpeg" ||
    base === "image/webp" ||
    base === "image/gif" ||
    base === "image/png"
    ? base
    : "image/png";
}

export type QaReference = {
  role: string;
  label?: string | null;
  buffer: Buffer;
  contentType: string;
};

export type QaInput = {
  brandName: string;
  /** The prompt the image was generated from. */
  scenePrompt: string;
  /** Exact approved copy that should appear, if the concept picked one. */
  approvedMessage: string | null;
  /** Every approved message, so unapproved wording can be recognised as such. */
  allApprovedMessages: string[];
  generatedImage: { buffer: Buffer; contentType: string };
  references: QaReference[];
};

/**
 * Judges a generated image against what it was supposed to be.
 *
 * Claude is used rather than OpenAI because this is a vision-in, structured-
 * text-out task, which is exactly what it is good at, and because judging with
 * the same model that generated the image invites it to agree with itself.
 *
 * The reference images are sent alongside the render: "does the product match"
 * is unanswerable from the output alone, and asking without the reference would
 * produce a confident guess rather than a comparison.
 */
export async function runImageQa(input: QaInput): Promise<QaResult> {
  const referenceBlocks = input.references.flatMap((reference) => [
    {
      type: "text" as const,
      text: `Reference — ${reference.role}${reference.label ? ` ("${reference.label}")` : ""}:`,
    },
    {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: toMediaType(reference.contentType),
        data: reference.buffer.toString("base64"),
      },
    },
  ]);

  const approvedList = input.allApprovedMessages.length
    ? input.allApprovedMessages.map((message) => `- ${message}`).join("\n")
    : "(none configured)";

  const message = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 4096,
    output_config: {
      format: zodOutputFormat(qaResultSchema),
      effort: "high",
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are a strict creative quality reviewer for "${input.brandName}". Judge the GENERATED IMAGE below against the reference images and the brief. Be conservative: this decides whether an ad is fit to spend money on.

The image was generated from this scene prompt:
"""
${input.scenePrompt}
"""

${
  input.approvedMessage
    ? `The image is required to show this exact promotional message as physical signage: "${input.approvedMessage}". Wording must match character for character.`
    : "No promotional message was required for this render, so no promotional wording should appear at all."
}

The brand's complete list of approved promotional messages is:
${approvedList}
Any promotional claim in the image that is not on that list is unapproved, even if it sounds reasonable.

Judge specifically:
- Does the product shown match the product reference exactly — shape, material, finish, patina? Report productMaterialChanged if copper has become gold, matte has become glossy, and so on.
- Is the logo reproduced exactly, not redrawn or restyled?
- If an owner reference is supplied, is the person shown the same person — same gender, roughly the same age and build? Set ownerReferenceProvided accordingly, and set ownerMatchesReference to true when no owner reference was given.
- Is every visible word English? This brand sells to a United States audience; Dutch or any other language is a failure.
- Are there spelling mistakes in any visible text?
- Are there AI artifacts a viewer would notice — malformed hands, extra fingers, warped edges, nonsense lettering?
- Does the composition actually follow the scene prompt?
- Would this pass as real photography in a Facebook or Instagram feed?

Score each dimension 0-10, where policyRisk is scored so that 10 means no policy risk at all.

List every concrete problem in detectedIssues, one short sentence each. If there are problems, write suggestedPromptFix: a full rewritten scene prompt that keeps the concept intact but would avoid those specific problems. If there are none, leave suggestedPromptFix as an empty string.`,
          },
          ...referenceBlocks,
          { type: "text", text: "GENERATED IMAGE to review:" },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: toMediaType(input.generatedImage.contentType),
              data: input.generatedImage.buffer.toString("base64"),
            },
          },
        ],
      },
    ],
  });

  if (!message.parsed_output) {
    throw new Error("Claude did not return a parsed QA result.");
  }

  return message.parsed_output;
}
