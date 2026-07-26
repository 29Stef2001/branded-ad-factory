import { z } from "zod";

export const addCompetitorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  metaPageId: z
    .string()
    .min(1, "Meta Page ID is required")
    .regex(/^\d+$/, "Meta Page ID must be numeric"),
});

export const adAnalysisSchema = z.object({
  messagingAngle: z
    .string()
    .describe("The core marketing angle or positioning the ad takes"),
  hook: z
    .string()
    .describe("The opening line or visual hook used to grab attention"),
  tone: z
    .string()
    .describe("The overall tone of voice, e.g. playful, urgent, aspirational"),
  targetAudience: z
    .string()
    .describe("The audience this ad appears to be written for"),
  callToAction: z.string().describe("The specific call to action used"),
  summary: z
    .string()
    .describe("A 1-2 sentence summary of the ad's overall strategy"),
});

export type AdAnalysis = z.infer<typeof adAnalysisSchema>;
