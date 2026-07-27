import OpenAI, { toFile } from "openai";
import { env } from "@/lib/env";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export type ImagePromptInput = {
  brandName: string;
  industry: string;
  tone: string;
  visualDirection: string;
};

export type ReferenceImage = { buffer: Buffer; contentType: string };

export type ConceptImageReferences = {
  product?: ReferenceImage;
  logo?: ReferenceImage;
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

function buildPrompt(
  input: ImagePromptInput,
  { product, logo }: ConceptImageReferences,
): string {
  const referenceNotes: string[] = [];

  if (product) {
    referenceNotes.push(
      `One reference image shows an actual "${input.brandName}" product that must be preserved exactly as-is — its shape, color, material, and details must not change. Place this exact product into the scene, changing only the environment, lighting, and styling around it — never the product itself.`,
    );
  }

  if (logo) {
    referenceNotes.push(
      `One reference image shows the real "${input.brandName}" brand logo — reproduce it faithfully, do not redesign, restyle, or reinterpret it. If a jewelry box or case is visible in the scene, subtly show this exact logo embossed or printed on the interior lining.`,
    );
  }

  const textInstruction = logo
    ? "Do not render any other words, letters, headlines, or text overlays beyond that logo."
    : "Do not render any words, letters, headlines, or text overlays in the image.";

  return `Create a high-quality advertising visual for "${input.brandName}" (${input.industry} industry, ${input.tone} tone).

${referenceNotes.join("\n\n")}

Visual direction: ${input.visualDirection}

${textInstruction}`.trim();
}

export async function generateConceptImage(
  input: ImagePromptInput,
  references: ConceptImageReferences = {},
): Promise<Buffer> {
  const { product, logo } = references;
  const prompt = buildPrompt(input, references);

  // GPT image models always return base64-encoded images — response_format
  // isn't a supported param for them (unlike dall-e-2/3) and would error if sent.
  // input_fidelity is likewise omitted: gpt-image-2 always processes reference
  // images at high fidelity automatically, so the knob doesn't apply to it.
  if (!product && !logo) {
    const result = await client.images.generate({
      model: "gpt-image-2",
      prompt,
      size: "1024x1024",
      quality: "medium",
      n: 1,
    });
    return extractImage(result);
  }

  const referenceImages = [product, logo].filter(
    (reference): reference is ReferenceImage => Boolean(reference),
  );
  const files = await Promise.all(
    referenceImages.map((reference, index) =>
      toFile(reference.buffer, `reference-${index}`, {
        type: reference.contentType,
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
