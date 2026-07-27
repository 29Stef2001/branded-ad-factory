import { z } from "zod";

export const brandProfileSchema = z.object({
  brandName: z.string().min(1, "Brand name is required"),
  industry: z.string().min(1, "Industry is required"),
  tone: z.string().min(1, "Tone is required"),
  targetAudience: z.string().min(1, "Target audience is required"),
  uniqueSellingPoints: z.string().min(1, "Unique selling points are required"),
  // Optional, unlike the fields above: its absence only means generated images
  // fall back to an invented emblem instead of the real logo, not degraded copy.
  logoImageUrl: z.string().trim().url("Enter a valid URL").optional(),
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

export type Concept = z.infer<typeof conceptSchema>;
export type ConceptsOutput = z.infer<typeof conceptsOutputSchema>;
