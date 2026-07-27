import { z } from "zod";

// Loose on purpose: a swatch can be a hex code ("#B87333") or a descriptive
// value ("copper metallic") — structured per-role, but not format-strict.
export const brandColorsSchema = z.object({
  primary: z.string().trim().min(1).optional(),
  secondary: z.string().trim().min(1).optional(),
  accent: z.string().trim().min(1).optional(),
  background: z.string().trim().min(1).optional(),
});

export const embossStyleEnum = z.enum([
  "none",
  "embossed",
  "debossed",
  "engraved",
  "custom",
]);

export const foilStyleEnum = z.enum([
  "none",
  "copper",
  "gold",
  "silver",
  "custom",
]);

export const brandProfileSchema = z.object({
  brandName: z.string().min(1, "Brand name is required"),
  industry: z.string().min(1, "Industry is required"),
  tone: z.string().min(1, "Tone is required"),
  targetAudience: z.string().min(1, "Target audience is required"),
  uniqueSellingPoints: z.string().min(1, "Unique selling points are required"),
  // Optional, unlike the fields above: its absence only means generated images
  // fall back to an invented emblem instead of the real logo, not degraded copy.
  logoImageUrl: z.string().trim().url("Enter a valid URL").optional(),
  brandColors: brandColorsSchema.optional(),
  typographyNotes: z.string().trim().min(1).optional(),
  embossStyle: embossStyleEnum.optional(),
  embossCustomNotes: z.string().trim().min(1).optional(),
  foilStyle: foilStyleEnum.optional(),
  foilCustomNotes: z.string().trim().min(1).optional(),
});

/**
 * Mirrors the check constraint on creative_generations.status exactly. Kept as
 * a type rather than loose strings so an invented value fails at compile time
 * instead of arriving as a 23514 from Postgres at runtime.
 */
export const generationStatusEnum = z.enum([
  "queued",
  "generating",
  "generated",
  "qa_in_progress",
  "qa_failed",
  "retrying",
  "needs_review",
  "approved",
  "rejected",
  "ready_for_publishing",
  "published",
  "failed",
]);

export type GenerationStatus = z.infer<typeof generationStatusEnum>;

// Mirrors the check constraint on brand_assets.asset_type.
export const brandAssetTypeEnum = z.enum([
  "logo",
  "icon",
  "packaging",
  "business_card",
  "thank_you_card",
  "shopping_bag",
  "storefront",
  // The two the model must never invent: the brand's actual owner, and an
  // actual product from the store.
  "owner",
  "product",
  "other",
]);

export const brandAssetSchema = z.object({
  assetType: brandAssetTypeEnum,
  label: z.string().trim().min(1).optional(),
  // Optional because an asset may instead be an uploaded file, which the
  // action resolves to a storage path. Exactly one of the two ends up set —
  // the table enforces that with a check constraint.
  imageUrl: z.string().trim().url("Enter a valid URL").optional(),
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
  region: z.string().trim().min(1).optional(),
  season: z.string().trim().min(1).optional(),
});

export const approvedMessageSchema = z.object({
  message: z.string().trim().min(1, "Message text is required"),
  isActive: z.boolean().default(true),
  category: z.string().trim().min(1).optional(),
  usageNotes: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).optional(),
  campaign: z.string().trim().min(1).optional(),
});

export const generateConceptsSchema = z.object({
  brief: z.string().min(10, "Describe the campaign in a bit more detail"),
  inspirationAdId: z.string().optional(),
});

export const conceptSchema = z.object({
  headline: z.string().describe("A short, punchy ad headline"),
  hook: z.string().describe("The opening line or visual hook"),
  bodyCopy: z.string().describe("The main ad body copy"),
  visualDirection: z
    .string()
    .describe("A written description of the visual style/imagery direction"),
  callToAction: z.string().describe("The call to action"),
});

export const conceptsOutputSchema = z.object({
  concepts: z.array(conceptSchema).length(3),
});

export const refineConceptSchema = z.object({
  instruction: z.string().min(3, "Describe what you'd like to change"),
});

export const generateCreativeImageSchema = z.object({
  productImageUrl: z.string().trim().url("Enter a valid URL").optional(),
});

export const strategyTypeEnum = z.enum([
  "control",
  "close_variation",
  "moderate_variation",
  "exploration",
]);

// v2 keeps every field from the original conceptSchema (still rendered by
// ConceptCard and edited by Concept Refiner, which is deliberately untouched)
// and adds the section-14 structured direction on top — additive, not a
// breaking replacement of the original 5 fields.
export const conceptV2Schema = conceptSchema.extend({
  title: z.string().describe("A short internal name for this concept"),
  strategyType: strategyTypeEnum.describe(
    "How far this concept departs from a safe, proven baseline",
  ),
  campaignAngle: z
    .string()
    .describe("The core marketing angle this concept takes"),
  primaryPromotionalMessage: z
    .string()
    .describe(
      "Must be the EXACT text of one of the brand's enabled approved promotional messages — never invented",
    ),
  visualHook: z
    .string()
    .describe("The single strongest visual moment in the scene"),
  emotionalDriver: z
    .string()
    .describe("The emotion this creative is designed to trigger"),
  scene: z.string().describe("The physical setting/environment"),
  subject: z.string().describe("Who or what the camera is focused on"),
  productPlacement: z
    .string()
    .describe("Where and how the product appears in the scene"),
  brandAssetRequirements: z
    .array(brandAssetTypeEnum)
    .describe(
      "Which brand asset types this scene implies (e.g. packaging, storefront)",
    ),
  messagePlacement: z
    .string()
    .describe(
      "The physical object the promotional message appears on (e.g. handwritten cardboard sign, storefront banner, packaging insert)",
    ),
  cameraStyle: z
    .string()
    .describe("e.g. documentary phone-shot, studio macro, UGC handheld"),
  lighting: z.string().describe("Lighting description"),
  composition: z.string().describe("Framing/composition description"),
  textStyle: z
    .string()
    .describe(
      "Style of the promotional message's lettering, e.g. handwritten red marker",
    ),
  elementsToPreserve: z
    .array(z.string())
    .describe(
      "Concrete elements that must not change (product details, logo, etc.)",
    ),
  elementsToVary: z
    .array(z.string())
    .describe(
      "Concrete elements that are free to vary (environment, styling, etc.)",
    ),
  finalGenerationPrompt: z
    .string()
    .describe(
      "A complete, self-contained scene description ready to hand to an image generation model",
    ),
});

export const conceptsOutputSchemaV2 = z.object({
  concepts: z.array(conceptV2Schema).length(3),
});

export const qaResultSchema = z.object({
  scores: z.object({
    productAccuracy: z.number().min(0).max(10),
    logoAccuracy: z.number().min(0).max(10),
    textAccuracy: z.number().min(0).max(10),
    textLegibility: z.number().min(0).max(10),
    brandConsistency: z.number().min(0).max(10),
    materialRealism: z.number().min(0).max(10),
    visualRealism: z.number().min(0).max(10),
    conceptMatch: z.number().min(0).max(10),
    mobileReadability: z.number().min(0).max(10),
    policyRisk: z.number().min(0).max(10),
  }),
  logoPresentWhenRequired: z.boolean(),
  logoMatchesReference: z.boolean(),
  productMatchesReference: z.boolean(),
  productMaterialChanged: z.boolean(),
  logoRedesigned: z.boolean(),
  approvedMessagePresent: z.boolean(),
  messageWordingExactMatch: z.boolean(),
  unapprovedMessageDetected: z.boolean(),
  textMisspelled: z.boolean(),
  seriousVisualArtifacts: z.boolean(),
  notes: z
    .string()
    .describe("A short human-readable summary of any issues found"),
});

export type Concept = z.infer<typeof conceptSchema>;
export type ConceptsOutput = z.infer<typeof conceptsOutputSchema>;
export type ConceptV2 = z.infer<typeof conceptV2Schema>;
export type ConceptsOutputV2 = z.infer<typeof conceptsOutputSchemaV2>;
export type QaResult = z.infer<typeof qaResultSchema>;
export type BrandAssetType = z.infer<typeof brandAssetTypeEnum>;
export type StrategyType = z.infer<typeof strategyTypeEnum>;
