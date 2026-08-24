import { describe, expect, it } from "vitest";
import {
  ANGLES,
  DNA_LABELS,
  HOOK_TYPES,
  creativeDnaSchema,
  dnaLabel,
  isWorthAnalysing,
} from "@/features/creative-intelligence/domain/creative-dna";

function dna(overrides: Record<string, unknown> = {}) {
  return {
    hookType: "pain",
    hookText: "Still wasting 20 minutes doing this?",
    angle: "convenience",
    awarenessLevel: "problem_aware",
    offerType: "discount",
    offerStrength: "strong",
    emotionalDriver: "relief",
    format: "portrait",
    composition: "person_with_product",
    visualPattern: "before_after",
    hasPerson: true,
    showsProduct: true,
    textOnImage: true,
    proofType: "star_rating",
    dominantColors: ["#1b1b1b", "#c98a4b"],
    brightness: "mid",
    whyItWorks: [
      "product visible immediately",
      "specific problem-focused hook",
    ],
    ...overrides,
  };
}

describe("creativeDnaSchema", () => {
  it("accepts a complete analysis", () => {
    expect(creativeDnaSchema.parse(dna())).toMatchObject({
      hookType: "pain",
      angle: "convenience",
    });
  });

  it("rejects a value outside the vocabulary", () => {
    // The whole point is that these group. A model inventing "urgency_pain"
    // creates a segment of one, which is the same as having no vocabulary.
    expect(() =>
      creativeDnaSchema.parse(dna({ hookType: "urgency_pain" })),
    ).toThrow();
    expect(() => creativeDnaSchema.parse(dna({ angle: "vibes" }))).toThrow();
  });

  it("requires a decision rather than an omission", () => {
    // Null says "cannot tell"; missing says nothing at all, and the two are
    // indistinguishable once stored.
    const { hookType: _omitted, ...withoutHook } = dna();
    expect(() => creativeDnaSchema.parse(withoutHook)).toThrow();
  });

  it("allows null where the model genuinely cannot tell", () => {
    expect(
      creativeDnaSchema.parse(dna({ hookType: null })).hookType,
    ).toBeNull();
  });

  it("caps the free-text lists so one analysis cannot run away", () => {
    expect(() =>
      creativeDnaSchema.parse(dna({ whyItWorks: Array(6).fill("reason") })),
    ).toThrow();
    expect(() =>
      creativeDnaSchema.parse(dna({ dominantColors: Array(5).fill("#000") })),
    ).toThrow();
  });
});

describe("dnaLabel", () => {
  it("never prints a raw enum", () => {
    expect(dnaLabel("problem_solution")).toBe("Problem / solution");
    expect(dnaLabel("fear_of_missing_out")).toBe("Fear of missing out");
  });

  it("falls back readably for a value it does not know", () => {
    expect(dnaLabel("something_new")).toBe("something new");
  });

  it("shows a dash for nothing", () => {
    expect(dnaLabel(null)).toBe("—");
    expect(dnaLabel(undefined)).toBe("—");
  });

  it("has a label for every value in the vocabulary", () => {
    // A missing label is how a dashboard starts showing snake_case.
    for (const value of [...HOOK_TYPES, ...ANGLES]) {
      expect(DNA_LABELS[value], `no label for ${value}`).toBeDefined();
    }
  });
});

describe("isWorthAnalysing", () => {
  it("analyses creatives with enough delivery to mean something", () => {
    expect(isWorthAnalysing("confident")).toBe(true);
    expect(isWorthAnalysing("directional")).toBe(true);
  });

  it("skips the ones that would only describe noise", () => {
    // 5,896 ads carry a thumbnail. Analysing the ones with a handful of
    // impressions produces a confident-sounding vocabulary describing nothing,
    // which is worse than none because it looks like an answer.
    expect(isWorthAnalysing("insufficient")).toBe(false);
  });
});
