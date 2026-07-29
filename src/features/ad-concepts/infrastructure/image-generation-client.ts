import OpenAI, { toFile } from "openai";
import {
  buildImagePrompt,
  type ImagePromptInput,
} from "@/features/ad-concepts/domain/image-prompt";
import { env } from "@/lib/env";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export type { ImagePromptInput };

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

export async function generateConceptImage(
  input: ImagePromptInput,
  references: NamedReference[] = [],
): Promise<Buffer> {
  // Assembly lives in domain/image-prompt so it can be tested and so the
  // Prompt Builder can show the user the same text this sends.
  const prompt = buildImagePrompt(input, references);

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
