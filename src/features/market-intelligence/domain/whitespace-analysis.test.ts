import { describe, expect, it } from "vitest";
import {
  computeWhitespace,
  type FeatureRow,
} from "@/features/market-intelligence/domain/whitespace-analysis";

function row(overrides: Partial<FeatureRow> = {}): FeatureRow {
  return {
    hook_type: null,
    angle: null,
    offer_type: null,
    emotional_driver: null,
    ...overrides,
  };
}

function repeat(overrides: Partial<FeatureRow>, count: number): FeatureRow[] {
  return Array.from({ length: count }, () => row(overrides));
}

describe("computeWhitespace", () => {
  it("returns nothing when either side is below the minimum sample", () => {
    const ours = repeat({ hook_type: "pain" }, 3);
    const theirs = repeat({ hook_type: "pain" }, 10);

    const result = computeWhitespace(ours, theirs);

    expect(result.sharedPatterns).toEqual([]);
    expect(result.competitorLeaning).toEqual([]);
    expect(result.whitespace).toEqual([]);
    expect(result.oursSampleSize).toBe(3);
    expect(result.theirsSampleSize).toBe(10);
  });

  it("calls a value shared when both sides use it at a similar rate", () => {
    // 5/10 = 50% on both sides.
    const ours = [...repeat({ hook_type: "pain" }, 5), ...repeat({ hook_type: "outcome" }, 5)];
    const theirs = [...repeat({ hook_type: "pain" }, 5), ...repeat({ hook_type: "outcome" }, 5)];

    const result = computeWhitespace(ours, theirs);

    expect(result.sharedPatterns).toContainEqual(
      expect.objectContaining({ category: "hookType", value: "pain", oursPct: 50, theirsPct: 50 }),
    );
  });

  it("calls a value competitor-leaning when they use it well above our rate", () => {
    // Us: 1/10 = 10%. Them: 8/10 = 80%. Gap of 70pp clears the 15pp threshold.
    const ours = [...repeat({ offer_type: "discount" }, 1), ...repeat({ offer_type: "none" }, 9)];
    const theirs = [...repeat({ offer_type: "discount" }, 8), ...repeat({ offer_type: "none" }, 2)];

    const result = computeWhitespace(ours, theirs);

    expect(result.competitorLeaning).toContainEqual(
      expect.objectContaining({ category: "offerType", value: "discount" }),
    );
    expect(result.whitespace).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ value: "discount" })]),
    );
  });

  it("calls a value whitespace when we lean on it and competitors barely touch it", () => {
    // Us: 8/10 = 80%. Them: 0/10 = 0%.
    const ours = [...repeat({ angle: "quality_craft" }, 8), ...repeat({ angle: "urgency" }, 2)];
    const theirs = repeat({ angle: "urgency" }, 10);

    const result = computeWhitespace(ours, theirs);

    expect(result.whitespace).toContainEqual(
      expect.objectContaining({ category: "angle", value: "quality_craft", oursPct: 80, theirsPct: 0 }),
    );
  });

  it("ignores null values entirely rather than treating them as a category", () => {
    const ours = [...repeat({ hook_type: "pain" }, 5), ...repeat({ hook_type: null }, 5)];
    const theirs = repeat({ hook_type: "pain" }, 10);

    const result = computeWhitespace(ours, theirs);

    const allPatterns = [
      ...result.sharedPatterns,
      ...result.competitorLeaning,
      ...result.whitespace,
    ];
    expect(allPatterns.every((pattern) => pattern.value !== "null")).toBe(true);
    // 5 of 5 non-null rows use "pain", so it is 100% of our distribution —
    // nulls are excluded from the denominator, not counted as "no hook".
    expect(result.sharedPatterns).toContainEqual(
      expect.objectContaining({ value: "pain", oursPct: 100, theirsPct: 100 }),
    );
  });
});
