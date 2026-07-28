/**
 * The one place brand context is turned into prompt text.
 *
 * Concept generation, image generation and QA each used to assemble their own
 * description of the brand, so the same facts were phrased three different ways
 * and a new brand field had to be threaded into three prompts by hand. Anything
 * a model is told about the brand now comes from here.
 *
 * Defined structurally rather than importing the repository row, per this
 * repo's layering convention: domain/ has no dependency on infrastructure/.
 */

export type BrandColorSet = {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
};

export type BrandContextInput = {
  brand_name: string;
  industry: string;
  tone: string;
  target_audience: string;
  unique_selling_points: string;
  brand_colors: BrandColorSet | null;
  typography_notes: string | null;
  emboss_style: string | null;
  emboss_custom_notes: string | null;
  foil_style: string | null;
  foil_custom_notes: string | null;
};

export type BrandContext = {
  brandName: string;
  industry: string;
  tone: string;
  /** Who the brand is and who it sells to. */
  identityLines: string[];
  /** How its materials and finishes look. Empty when nothing is configured. */
  styleLines: string[];
};

/**
 * The market the brand sells into, which decides the language of everything
 * generated. Hard-coded for now and deliberately kept in one place: it was
 * previously written out separately in the concept prompt and the image prompt,
 * and it becomes a Brand DNA field rather than a constant.
 */
export const BRAND_MARKET = "United States";
export const BRAND_LANGUAGE = "English";

export function buildBrandContext(profile: BrandContextInput): BrandContext {
  const identityLines = [
    `Brand: ${profile.brand_name}`,
    `Industry: ${profile.industry}`,
    `Tone of voice: ${profile.tone}`,
    `Target audience: ${profile.target_audience}`,
    `Unique selling points: ${profile.unique_selling_points}`,
  ];

  const styleLines: string[] = [];

  if (profile.brand_colors) {
    const colors = Object.entries(profile.brand_colors)
      .filter(([, value]) => value)
      .map(([role, value]) => `${role}: ${value}`)
      .join(", ");
    if (colors) styleLines.push(`Brand colors — ${colors}`);
  }

  if (profile.typography_notes) {
    styleLines.push(`Typography — ${profile.typography_notes}`);
  }

  // "none" is the stored default rather than null, so it has to be filtered out
  // explicitly or every brand claims a finish it does not use.
  if (profile.emboss_style && profile.emboss_style !== "none") {
    styleLines.push(
      `Emboss treatment — ${profile.emboss_style}${
        profile.emboss_custom_notes ? ` (${profile.emboss_custom_notes})` : ""
      }`,
    );
  }

  if (profile.foil_style && profile.foil_style !== "none") {
    styleLines.push(
      `Foil treatment — ${profile.foil_style}${
        profile.foil_custom_notes ? ` (${profile.foil_custom_notes})` : ""
      }`,
    );
  }

  return {
    brandName: profile.brand_name,
    industry: profile.industry,
    tone: profile.tone,
    identityLines,
    styleLines,
  };
}

/** Full identity block — who the brand is, for copywriting and strategy. */
export function renderBrandIdentity(context: BrandContext): string {
  return context.identityLines.join("\n");
}

/** Materials and finishes. Empty string when the brand has configured none. */
export function renderBrandStyle(context: BrandContext): string {
  return context.styleLines.length > 0
    ? `Brand style settings:\n${context.styleLines.join("\n")}`
    : "";
}

/**
 * One-line summary for prompts that need the brand named but not described in
 * full — image generation cares about tone and industry, not the USP list.
 */
export function renderBrandHeadline(context: BrandContext): string {
  return `"${context.brandName}" (${context.industry} industry, ${context.tone} tone)`;
}

/**
 * The language rule, phrased for whichever surface is asking. Text rendered
 * inside an image and text written as copy fail in different ways, so the
 * wording differs — but the underlying market fact does not.
 */
export function renderLanguageRule(surface: "copy" | "image"): string {
  return surface === "copy"
    ? `Write every field in ${BRAND_LANGUAGE}. This brand sells to a ${BRAND_MARKET} audience, so all copy, all scene descriptions, and any text that will appear inside the image must be ${BRAND_LANGUAGE} — regardless of the language of the campaign brief.`
    : `All text visible anywhere in the image must be in ${BRAND_LANGUAGE}. This brand sells to a ${BRAND_MARKET} audience — never render any other language.`;
}
