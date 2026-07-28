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
  // Provenance and metadata are accepted so the repository row satisfies this
  // type directly, but deliberately never rendered: everything a model is told
  // about the brand comes from a typed field, so an arbitrary metadata key
  // cannot silently change generated output.
  metadata?: Record<string, unknown>;

  brand_name: string;
  brand_category: string | null;
  markets: string[];
  languages: string[];
  brand_story: string | null;
  brand_mission: string | null;

  target_audience: string;
  tone_attributes: string[];
  tone_notes: string | null;
  writing_style: string | null;

  visual_style: string | null;
  photography_style: string | null;
  brand_colors: BrandColorSet | null;
  typography_notes: string | null;
  logo_rules: string | null;
  emboss_style: string | null;
  emboss_custom_notes: string | null;
  foil_style: string | null;
  foil_custom_notes: string | null;

  founder_name: string | null;
  founder_gender: string | null;
  founder_age: number | null;
  founder_background: string | null;

  product_positioning: string | null;
  price_positioning: string | null;
  materials: string[];
  usps: string[];
  brand_values: string[];

  words_to_always_use: string[];
  words_to_never_use: string[];

  image_generation_rules: string | null;
  copy_generation_rules: string | null;
  qa_expectations: string | null;
  qa_min_score: number | null;
};

export type BrandContext = {
  brandName: string;
  category: string;
  tone: string;
  /** Who the brand is and who it sells to. */
  identityLines: string[];
  /** How its materials and finishes look. Empty when nothing is configured. */
  styleLines: string[];
  /** The real person who appears in creatives, when the brand has one. */
  founderLines: string[];
  /** Words that must and must not appear in copy. */
  vocabularyLines: string[];
  /** Free-text house rules, per surface. */
  imageRules: string | null;
  copyRules: string | null;
  qaExpectations: string | null;
  qaMinScore: number | null;
  languages: string[];
  markets: string[];
};

// Used only when a profile has no markets/languages set, which the column
// defaults make unlikely but not impossible.
const DEFAULT_MARKETS = ["US"];
const DEFAULT_LANGUAGES = ["en"];

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  nl: "Dutch",
  de: "German",
  fr: "French",
  es: "Spanish",
};

const MARKET_NAMES: Record<string, string> = {
  US: "United States",
  UK: "United Kingdom",
  NL: "the Netherlands",
  DE: "Germany",
  EU: "the European Union",
};

function nameList(codes: string[], names: Record<string, string>): string {
  return codes.map((code) => names[code] ?? code).join(", ");
}

export function buildBrandContext(profile: BrandContextInput): BrandContext {
  const tone =
    profile.tone_attributes.length > 0
      ? profile.tone_attributes.join(", ")
      : (profile.tone_notes ?? "");

  const identityLines = [
    `Brand: ${profile.brand_name}`,
    profile.brand_category ? `Category: ${profile.brand_category}` : null,
    `Target audience: ${profile.target_audience}`,
    tone ? `Tone of voice: ${tone}` : null,
    profile.tone_notes && profile.tone_attributes.length > 0
      ? `Tone notes: ${profile.tone_notes}`
      : null,
    profile.writing_style
      ? `Writing style: ${profile.writing_style.replace(/_/g, " ")}`
      : null,
    profile.brand_mission ? `Mission: ${profile.brand_mission}` : null,
    profile.brand_story ? `Brand story: ${profile.brand_story}` : null,
    profile.usps.length > 0
      ? `Unique selling points: ${profile.usps.join("; ")}`
      : null,
    profile.brand_values.length > 0
      ? `Brand values: ${profile.brand_values.join(", ")}`
      : null,
    profile.product_positioning
      ? `Product positioning: ${profile.product_positioning}`
      : null,
    profile.price_positioning
      ? `Price positioning: ${profile.price_positioning.replace(/_/g, " ")}`
      : null,
    profile.materials.length > 0
      ? `Materials: ${profile.materials.join(", ")}`
      : null,
  ].filter((line): line is string => line !== null);

  const styleLines: string[] = [];

  if (profile.visual_style)
    styleLines.push(`Visual style — ${profile.visual_style}`);
  if (profile.photography_style) {
    styleLines.push(
      `Photography style — ${profile.photography_style.replace(/_/g, " ")}`,
    );
  }

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
  if (profile.logo_rules) styleLines.push(`Logo rules — ${profile.logo_rules}`);

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

  // Described in words as well as shown as a reference image: the concept
  // generator writes the scene before any image exists, so it needs to know who
  // appears in it without being able to look at her.
  const founderLines = [
    profile.founder_name ? `Name: ${profile.founder_name}` : null,
    profile.founder_gender && profile.founder_gender !== "unspecified"
      ? `Gender: ${profile.founder_gender.replace(/_/g, "-")}`
      : null,
    profile.founder_age ? `Age: ${profile.founder_age}` : null,
    profile.founder_background
      ? `Background: ${profile.founder_background}`
      : null,
  ].filter((line): line is string => line !== null);

  const vocabularyLines = [
    profile.words_to_always_use.length > 0
      ? `Always use these words where they fit naturally: ${profile.words_to_always_use.join(", ")}.`
      : null,
    profile.words_to_never_use.length > 0
      ? `Never use these words: ${profile.words_to_never_use.join(", ")}.`
      : null,
  ].filter((line): line is string => line !== null);

  return {
    brandName: profile.brand_name,
    category: profile.brand_category ?? "",
    tone,
    identityLines,
    styleLines,
    founderLines,
    vocabularyLines,
    imageRules: profile.image_generation_rules,
    copyRules: profile.copy_generation_rules,
    qaExpectations: profile.qa_expectations,
    qaMinScore: profile.qa_min_score,
    languages: profile.languages.length ? profile.languages : DEFAULT_LANGUAGES,
    markets: profile.markets.length ? profile.markets : DEFAULT_MARKETS,
  };
}

/** The founder block, empty when the brand has recorded nothing about her. */
export function renderFounder(context: BrandContext): string {
  return context.founderLines.length > 0
    ? `The brand's founder, who appears in its creatives:\n${context.founderLines.join("\n")}`
    : "";
}

/** Vocabulary rules plus whichever house rules apply to this surface. */
export function renderRules(
  context: BrandContext,
  surface: "copy" | "image" | "qa",
): string {
  const lines = [...context.vocabularyLines];

  if (surface === "copy" && context.copyRules) lines.push(context.copyRules);
  if (surface === "image" && context.imageRules) lines.push(context.imageRules);
  if (surface === "qa" && context.qaExpectations)
    lines.push(context.qaExpectations);

  return lines.length > 0 ? `Brand rules:\n${lines.join("\n")}` : "";
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
  const parts = [context.category, context.tone].filter(Boolean).join(", ");
  return parts ? `"${context.brandName}" (${parts})` : `"${context.brandName}"`;
}

/**
 * The language rule, phrased for whichever surface is asking. Text rendered
 * inside an image and text written as copy fail in different ways, so the
 * wording differs — but the underlying market fact does not.
 */
export function renderLanguageRule(
  context: BrandContext,
  surface: "copy" | "image",
): string {
  const languages = nameList(context.languages, LANGUAGE_NAMES);
  const markets = nameList(context.markets, MARKET_NAMES);

  return surface === "copy"
    ? `Write every field in ${languages}. This brand sells to ${markets}, so all copy, all scene descriptions, and any text that will appear inside the image must be ${languages} — regardless of the language of the campaign brief.`
    : `All text visible anywhere in the image must be in ${languages}. This brand sells to ${markets} — never render any other language.`;
}
