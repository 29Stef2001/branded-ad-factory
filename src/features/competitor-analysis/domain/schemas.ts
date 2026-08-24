import { z } from "zod";

export const addCompetitorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  metaPageId: z
    .string()
    .min(1, "Meta Page ID is required")
    .regex(/^\d+$/, "Meta Page ID must be numeric"),
});

/**
 * A flagged-but-not-tracked competitor. metaPageId is optional here — someone
 * flagging "this brand keeps showing up" may not have looked up the Page ID
 * yet, and requiring it up front would stop the flag from being raised at
 * all. Approving the suggestion is where it becomes required.
 */
export const suggestCompetitorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  metaPageId: z
    .string()
    .regex(/^\d+$/, "Meta Page ID must be numeric")
    .optional()
    .or(z.literal("")),
  reason: z.string().min(1, "Say why this looks like a competitor"),
});

