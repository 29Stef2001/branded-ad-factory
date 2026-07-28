import type { BrandContextInput } from "@/features/ad-concepts/domain/brand-context";

/**
 * How complete a brand profile is, and what filling in the gaps would buy.
 *
 * Not a vanity percentage: each field is weighted by how much it changes
 * generated output. A missing founder gender produced a male craftsman for a
 * brand run by a woman, so it is worth more than a missing brand story — which
 * reads nicely but rarely changes a render.
 */

export type CompletenessGroup =
  "identity" | "voice" | "visual" | "founder" | "commercial" | "rules";

type Requirement = {
  key: string;
  label: string;
  group: CompletenessGroup;
  /** Higher = more impact on what gets generated. */
  weight: number;
  /** What the brand loses by leaving this blank. */
  impact: string;
  filled: (profile: BrandContextInput) => boolean;
};

const hasText = (value: string | null | undefined) =>
  typeof value === "string" && value.trim().length > 0;
const hasItems = (value: string[] | null | undefined) =>
  Array.isArray(value) && value.length > 0;

const REQUIREMENTS: Requirement[] = [
  // Identity — without these nothing can be generated at all.
  {
    key: "brand_name",
    label: "Brand name",
    group: "identity",
    weight: 5,
    impact: "Required before anything can be generated.",
    filled: (p) => hasText(p.brand_name),
  },
  {
    key: "brand_category",
    label: "Brand category",
    group: "identity",
    weight: 4,
    impact: "Concepts fall back on generic retail language.",
    filled: (p) => hasText(p.brand_category),
  },
  {
    key: "target_audience",
    label: "Target audience",
    group: "identity",
    weight: 5,
    impact: "Copy is written for nobody in particular.",
    filled: (p) => hasText(p.target_audience),
  },
  {
    key: "languages",
    label: "Languages",
    group: "identity",
    weight: 3,
    impact: "Generated text may come back in the wrong language.",
    filled: (p) => hasItems(p.languages),
  },

  // Voice
  {
    key: "tone",
    label: "Tone of voice",
    group: "voice",
    weight: 4,
    impact: "Every concept sounds like a different brand.",
    filled: (p) => hasItems(p.tone_attributes) || hasText(p.tone_notes),
  },
  {
    key: "writing_style",
    label: "Writing style",
    group: "voice",
    weight: 2,
    impact: "Copy length and rhythm drift between concepts.",
    filled: (p) => hasText(p.writing_style),
  },

  // Visual
  {
    key: "photography_style",
    label: "Photography style",
    group: "visual",
    weight: 3,
    impact: "Images swing between studio polish and candid snapshots.",
    filled: (p) => hasText(p.photography_style),
  },
  {
    key: "brand_colors",
    label: "Brand colours",
    group: "visual",
    weight: 2,
    impact: "Generated scenes use arbitrary colour.",
    filled: (p) =>
      Boolean(p.brand_colors && Object.values(p.brand_colors).some(Boolean)),
  },
  {
    key: "visual_style",
    label: "Visual style",
    group: "visual",
    weight: 2,
    impact: "No shared look across creatives.",
    filled: (p) => hasText(p.visual_style),
  },

  // Founder — the field that caused a real failure.
  {
    key: "founder_gender",
    label: "Founder gender",
    group: "founder",
    weight: 4,
    impact:
      "Generation invents whoever it likes — this is what produced a male craftsman for a woman-run brand.",
    filled: (p) =>
      hasText(p.founder_gender) && p.founder_gender !== "unspecified",
  },
  {
    key: "founder_name",
    label: "Founder name",
    group: "founder",
    weight: 2,
    impact: "Copy cannot name her.",
    filled: (p) => hasText(p.founder_name),
  },
  {
    key: "founder_background",
    label: "Founder background",
    group: "founder",
    weight: 2,
    impact: "The story behind the brand stays generic.",
    filled: (p) => hasText(p.founder_background),
  },

  // Commercial
  {
    key: "usps",
    label: "Unique selling points",
    group: "commercial",
    weight: 4,
    impact: "Concepts have no concrete claim to build on.",
    filled: (p) => hasItems(p.usps),
  },
  {
    key: "materials",
    label: "Materials",
    group: "commercial",
    weight: 2,
    impact: "Products are described in vague terms.",
    filled: (p) => hasItems(p.materials),
  },
  {
    key: "price_positioning",
    label: "Price positioning",
    group: "commercial",
    weight: 2,
    impact: "Tone may not match what the product costs.",
    filled: (p) => hasText(p.price_positioning),
  },
  {
    key: "brand_values",
    label: "Brand values",
    group: "commercial",
    weight: 1,
    impact: "Less to draw on for emotional angles.",
    filled: (p) => hasItems(p.brand_values),
  },

  // Rules
  {
    key: "words_to_never_use",
    label: "Words to never use",
    group: "rules",
    weight: 2,
    impact: "Nothing stops off-brand wording appearing in copy.",
    filled: (p) => hasItems(p.words_to_never_use),
  },
  {
    key: "brand_story",
    label: "Brand story",
    group: "rules",
    weight: 1,
    impact: "Narrative angles have less to work with.",
    filled: (p) => hasText(p.brand_story),
  },
];

export type CompletenessGap = {
  key: string;
  label: string;
  group: CompletenessGroup;
  weight: number;
  impact: string;
};

export type BrandCompleteness = {
  /** 0-100, weighted. */
  score: number;
  filledCount: number;
  totalCount: number;
  /** Missing fields, heaviest first — the order worth filling them in. */
  gaps: CompletenessGap[];
};

export function assessBrandCompleteness(
  profile: BrandContextInput | null,
): BrandCompleteness {
  if (!profile) {
    return {
      score: 0,
      filledCount: 0,
      totalCount: REQUIREMENTS.length,
      gaps: REQUIREMENTS.map(({ key, label, group, weight, impact }) => ({
        key,
        label,
        group,
        weight,
        impact,
      })),
    };
  }

  const totalWeight = REQUIREMENTS.reduce((sum, r) => sum + r.weight, 0);
  let earned = 0;
  const gaps: CompletenessGap[] = [];

  for (const requirement of REQUIREMENTS) {
    if (requirement.filled(profile)) {
      earned += requirement.weight;
    } else {
      gaps.push({
        key: requirement.key,
        label: requirement.label,
        group: requirement.group,
        weight: requirement.weight,
        impact: requirement.impact,
      });
    }
  }

  gaps.sort((a, b) => b.weight - a.weight);

  return {
    score: Math.round((earned / totalWeight) * 100),
    filledCount: REQUIREMENTS.length - gaps.length,
    totalCount: REQUIREMENTS.length,
    gaps,
  };
}
