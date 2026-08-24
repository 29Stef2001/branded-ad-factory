import { z } from "zod";

/**
 * The vocabulary a creative is described in. Pure — no IO.
 *
 * Every field is a closed list. That is the whole design: the point of
 * recording what a creative *is* was never to describe one ad, it was to ask
 * after five hundred of them which hooks win structurally. Free text cannot be
 * grouped, so a model left to phrase things freely produces five hundred
 * one-off descriptions and no answer.
 *
 * The lists are deliberately short. A vocabulary with forty hook types splits
 * the data so thin that every segment is noise, which is the same failure as
 * having no vocabulary at all.
 */

export const HOOK_TYPES = [
  "pain",
  "curiosity",
  "outcome",
  "scarcity",
  "social_proof",
  "founder_story",
  "question",
  "comparison",
  "announcement",
] as const;

export const ANGLES = [
  "problem_solution",
  "convenience",
  "money_saving",
  "quality_craft",
  "social_proof",
  "identity",
  "urgency",
  "education",
] as const;

/**
 * How much the reader already knows, in Schwartz's terms.
 *
 * Worth capturing because it decides which hooks can work at all: a
 * problem-aware reader responds to a pain hook, an unaware one has to be told
 * the problem exists first.
 */
export const AWARENESS_LEVELS = [
  "unaware",
  "problem_aware",
  "solution_aware",
  "product_aware",
  "most_aware",
] as const;

export const OFFER_TYPES = [
  "discount",
  "free_shipping",
  "bundle",
  "gift",
  "guarantee",
  "limited_stock",
  "none",
] as const;

export const OFFER_STRENGTHS = ["none", "soft", "strong"] as const;

export const EMOTIONAL_DRIVERS = [
  "relief",
  "aspiration",
  "belonging",
  "nostalgia",
  "fear_of_missing_out",
  "trust",
  "delight",
] as const;

export const FORMATS = ["square", "portrait", "story", "landscape"] as const;

export const COMPOSITIONS = [
  "product_only",
  "product_in_use",
  "person_with_product",
  "close_up",
  "flat_lay",
  "wide_scene",
  "text_dominant",
  "split_screen",
] as const;

export const VISUAL_PATTERNS = [
  "before_after",
  "product_hero",
  "lifestyle",
  "ugc",
  "testimonial_card",
  "comparison_grid",
  "infographic",
  "packaging",
] as const;

export const PROOF_TYPES = [
  "star_rating",
  "customer_count",
  "testimonial_quote",
  "press_mention",
  "certification",
  "none",
] as const;

export const BRIGHTNESS = ["dark", "mid", "bright"] as const;

/**
 * What one analysis returns.
 *
 * `nullable` throughout rather than optional: a model that cannot tell should
 * say so, and a missing field is indistinguishable from a field the model
 * forgot. `why_it_works` is the one free-text field, and it is for a person to
 * read rather than to group by.
 */
export const creativeDnaSchema = z.object({
  hookType: z.enum(HOOK_TYPES).nullable(),
  hookText: z.string().nullable(),
  angle: z.enum(ANGLES).nullable(),
  awarenessLevel: z.enum(AWARENESS_LEVELS).nullable(),
  offerType: z.enum(OFFER_TYPES).nullable(),
  offerStrength: z.enum(OFFER_STRENGTHS).nullable(),
  emotionalDriver: z.enum(EMOTIONAL_DRIVERS).nullable(),

  format: z.enum(FORMATS).nullable(),
  composition: z.enum(COMPOSITIONS).nullable(),
  visualPattern: z.enum(VISUAL_PATTERNS).nullable(),
  hasPerson: z.boolean().nullable(),
  showsProduct: z.boolean().nullable(),
  textOnImage: z.boolean().nullable(),
  proofType: z.enum(PROOF_TYPES).nullable(),
  dominantColors: z.array(z.string()).max(4),
  brightness: z.enum(BRIGHTNESS).nullable(),

  /**
   * What is repeatable about this creative, not what happened to be true of it.
   *
   * The distinction is the whole value: "the product is visible in the first
   * frame" is something the next creative can do, "it ran during a heatwave" is
   * not. Without it the system recommends re-running a creative that caught a
   * good week.
   */
  whyItWorks: z.array(z.string()).max(5),
});

export type CreativeDna = z.infer<typeof creativeDnaSchema>;

/** Bumped when the prompt changes, which invalidates every cached result. */
export const DNA_PROMPT_VERSION = "dna-1";

/** Human-readable names, so the UI never prints a raw enum. */
export const DNA_LABELS: Record<string, string> = {
  pain: "Pain",
  curiosity: "Curiosity",
  outcome: "Outcome",
  scarcity: "Scarcity",
  social_proof: "Social proof",
  founder_story: "Founder story",
  question: "Question",
  comparison: "Comparison",
  announcement: "Announcement",

  problem_solution: "Problem / solution",
  convenience: "Convenience",
  money_saving: "Money saving",
  quality_craft: "Quality and craft",
  identity: "Identity",
  urgency: "Urgency",
  education: "Education",

  unaware: "Unaware",
  problem_aware: "Problem aware",
  solution_aware: "Solution aware",
  product_aware: "Product aware",
  most_aware: "Most aware",

  discount: "Discount",
  free_shipping: "Free shipping",
  bundle: "Bundle",
  gift: "Gift",
  guarantee: "Guarantee",
  limited_stock: "Limited stock",
  none: "None",

  soft: "Soft",
  strong: "Strong",

  relief: "Relief",
  aspiration: "Aspiration",
  belonging: "Belonging",
  nostalgia: "Nostalgia",
  fear_of_missing_out: "Fear of missing out",
  trust: "Trust",
  delight: "Delight",

  square: "Square 1:1",
  portrait: "Portrait 4:5",
  story: "Story 9:16",
  landscape: "Landscape",

  product_only: "Product only",
  product_in_use: "Product in use",
  person_with_product: "Person with product",
  close_up: "Close-up",
  flat_lay: "Flat lay",
  wide_scene: "Wide scene",
  text_dominant: "Text dominant",
  split_screen: "Split screen",

  before_after: "Before / after",
  product_hero: "Product hero",
  lifestyle: "Lifestyle",
  ugc: "UGC",
  testimonial_card: "Testimonial card",
  comparison_grid: "Comparison grid",
  infographic: "Infographic",
  packaging: "Packaging",

  star_rating: "Star rating",
  customer_count: "Customer count",
  testimonial_quote: "Testimonial quote",
  press_mention: "Press mention",
  certification: "Certification",

  dark: "Dark",
  mid: "Mid",
  bright: "Bright",
};

export function dnaLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return DNA_LABELS[value] ?? value.replace(/_/g, " ");
}

/**
 * Whether a creative has earned an analysis.
 *
 * Vision calls cost money and the answer is only worth having if the
 * performance beside it means something. Running this across 5,896 ads with a
 * handful of impressions each would produce a confident-sounding vocabulary
 * describing noise — which is worse than no vocabulary, because it looks like
 * an answer.
 */
export function isWorthAnalysing(evidenceTier: string): boolean {
  return evidenceTier === "confident" || evidenceTier === "directional";
}
