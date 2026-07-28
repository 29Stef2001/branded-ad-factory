import OpenAI, { toFile } from "openai";
import {
  renderBrandHeadline,
  renderBrandStyle,
  renderLanguageRule,
  renderRules,
  type BrandContext,
} from "@/features/ad-concepts/domain/brand-context";
import { env } from "@/lib/env";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export type ImagePromptInput = {
  /** Brand facts, rendered by the shared builder rather than restated here. */
  brand: BrandContext;
  /**
   * The concept's self-contained scene description — `final_generation_prompt`
   * when the concept has one, falling back to `visual_direction` for concepts
   * generated before structured output existed.
   */
  scenePrompt: string;
  /** Exact approved copy to render as physical signage, if the concept picked one. */
  promotionalMessage?: string | null;
  /** Where in the scene that message belongs, from the structured concept. */
  messagePlacement?: string | null;
  textStyle?: string | null;
  /** Requirements that didn't fit the reference-image budget, described in words. */
  overflowNotes?: string[];
};

export type ReferenceImage = { buffer: Buffer; contentType: string };

/**
 * A reference image plus the job it does in the scene. Ordered: whatever the
 * caller puts first is described first, and OpenAI receives them in the same
 * order, so "one reference shows X" lines up with the attached files.
 */
export type NamedReference = {
  role: string;
  label?: string | null;
  image: ReferenceImage;
};

// Shopify's own domains always work, for any store; a store serving CDN/asset
// files on its own custom domain (e.g. copper-soul.com/cdn/shop/...) needs
// SHOPIFY_STORE_HOSTNAME.
const ALLOWED_SHOPIFY_HOST_PATTERNS = [
  /^cdn\.shopify\.com$/,
  /(^|\.)myshopify\.com$/,
];

function normalizeHost(hostname: string): string {
  return hostname.replace(/^www\./, "").toLowerCase();
}

// Guards fetchExternalImage() against SSRF: without this, a pasted URL (product
// photo or brand logo) would let the server fetch arbitrary/internal hosts.
export function isAllowedExternalImageHost(url: string): boolean {
  let hostname: string;
  try {
    hostname = normalizeHost(new URL(url).hostname);
  } catch {
    return false;
  }

  if (ALLOWED_SHOPIFY_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
    return true;
  }

  return env.SHOPIFY_STORE_HOSTNAME
    ? hostname === normalizeHost(env.SHOPIFY_STORE_HOSTNAME)
    : false;
}

export async function fetchExternalImage(url: string): Promise<ReferenceImage> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch the image (HTTP ${response.status}).`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error("That URL did not return an image.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType };
}

function extractImage(result: OpenAI.Images.ImagesResponse): Buffer {
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI did not return image data.");
  }
  return Buffer.from(b64, "base64");
}

/**
 * How each reference role should be treated. Product and logo demand exact
 * preservation — those are the two the model is most tempted to "improve" —
 * while contextual assets are guidance for how the brand's real materials look.
 */
function describeReference(
  reference: NamedReference,
  index: number,
  brandName: string,
): string {
  const position = `Reference image ${index + 1}`;
  const named = reference.label ? ` ("${reference.label}")` : "";

  switch (reference.role) {
    case "product":
      return `${position} shows an actual "${brandName}" product that must be preserved exactly as-is — its shape, color, material, patina and details must not change. The jewellery visible in the scene must be this exact piece, not an invented or generic substitute. Change only the environment, lighting and styling around it — never the product itself.`;
    case "owner":
      return `${position} shows the real owner of "${brandName}". When a person appears in the scene, it is her — match her age, build, hair, and face as closely as you can, and do not substitute a different person or gender. She is the brand's actual owner, not a hired model.`;
    case "logo":
      return `${position} shows the real "${brandName}" brand logo — reproduce it faithfully, do not redesign, restyle, or reinterpret it. Where packaging, a box or a sign appears in the scene, show this exact logo on it.`;
    default:
      return `${position}${named} shows this brand's real ${reference.role.replace(/_/g, " ")}. Where that element appears in the scene, match this reference's actual appearance — its materials, colors and proportions — rather than inventing a generic version.`;
  }
}

function buildPrompt(
  input: ImagePromptInput,
  references: NamedReference[],
): string {
  const sections: string[] = [
    `Create a high-quality advertising visual for ${renderBrandHeadline(input.brand)}.`,
  ];

  if (references.length > 0) {
    sections.push(
      references
        .map((reference, index) =>
          describeReference(reference, index, input.brand.brandName),
        )
        .join("\n\n"),
    );
  }

  const style = renderBrandStyle(input.brand);
  if (style) sections.push(style);

  const rules = renderRules(input.brand, "image");
  if (rules) sections.push(rules);

  sections.push(`Scene: ${input.scenePrompt}`);

  if (input.overflowNotes?.length) {
    // These are assets the concept asked for that didn't fit the reference
    // budget. Describing them beats dropping them silently.
    sections.push(
      `Also present in the scene, described rather than attached: ${input.overflowNotes.join("; ")}.`,
    );
  }

  // The promotional message is the one piece of text the image is allowed to
  // carry, and only as something physically in the scene — printed signage
  // survives being rendered by an image model far better than an overlay.
  if (input.promotionalMessage) {
    const placement = input.messagePlacement
      ? ` Place it ${input.messagePlacement}.`
      : "";
    const style = input.textStyle ? ` Style: ${input.textStyle}.` : "";
    sections.push(
      `The scene must include this exact promotional message as real physical signage — printed, painted or lettered on a surface within the scene, never as a digital overlay: "${input.promotionalMessage}".${placement}${style} Reproduce the wording exactly, with no other words, headlines or text anywhere in the image.`,
    );
  } else {
    sections.push(
      "Do not render any words, letters, headlines, or text overlays in the image, beyond a brand logo if one is supplied as a reference.",
    );
  }

  // The store sells to a US audience, so any lettering the model does render —
  // signage, packaging, a price card — has to be English. Stated last so it
  // reads as an overriding rule rather than one detail among many.
  sections.push(renderLanguageRule(input.brand, "image"));

  return sections.join("\n\n").trim();
}

export async function generateConceptImage(
  input: ImagePromptInput,
  references: NamedReference[] = [],
): Promise<Buffer> {
  const prompt = buildPrompt(input, references);

  // GPT image models always return base64-encoded images — response_format
  // isn't a supported param for them (unlike dall-e-2/3) and would error if sent.
  // input_fidelity is likewise omitted: gpt-image-2 always processes reference
  // images at high fidelity automatically, so the knob doesn't apply to it.
  if (references.length === 0) {
    const result = await client.images.generate({
      model: "gpt-image-2",
      prompt,
      size: "1024x1024",
      quality: "medium",
      n: 1,
    });
    return extractImage(result);
  }

  const files = await Promise.all(
    references.map((reference, index) =>
      toFile(reference.image.buffer, `reference-${index}`, {
        type: reference.image.contentType,
      }),
    ),
  );

  const result = await client.images.edit({
    model: "gpt-image-2",
    image: files,
    prompt,
    size: "1024x1024",
    quality: "medium",
  });

  return extractImage(result);
}
