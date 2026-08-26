import { describe, expect, it } from "vitest";
import {
  computeWhitespace,
  isMarketWide,
  partitionByAdvertiserBreadth,
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

describe("advertiser-weighted evidence", () => {
  /**
   * The case this exists for. One advertiser running many persona pages
   * produced most of the competitor ads on this account, so counting ads
   * alone reported its house style as a market pattern.
   */
  function ad(value: string, advertiser: string): FeatureRow {
    return row({ hook_type: value, advertiser });
  }

  it("reports how many distinct advertisers use a value, not how many ads", () => {
    const ours = repeat({ hook_type: "outcome" }, 10);
    const theirs = [
      // Twelve ads, but one advertiser behind all of them.
      ...Array.from({ length: 12 }, () => ad("scarcity", "big.example")),
      ...Array.from({ length: 3 }, () => ad("pain", "small-a.example")),
      ...Array.from({ length: 3 }, () => ad("pain", "small-b.example")),
    ];

    const result = computeWhitespace(ours, theirs);
    const all = [
      ...result.sharedPatterns,
      ...result.competitorLeaning,
      ...result.whitespace,
    ];

    const scarcity = all.find((p) => p.value === "scarcity");
    expect(scarcity?.theirsByAdvertiser).toMatchObject({ usedBy: 1, outOf: 3 });

    const pain = all.find((p) => p.value === "pain");
    expect(pain?.theirsByAdvertiser).toMatchObject({ usedBy: 2, outOf: 3 });
  });

  it("gives every advertiser one vote, so a crowded one cannot dominate the mean", () => {
    const ours = repeat({ hook_type: "outcome" }, 10);
    const theirs = [
      ...Array.from({ length: 18 }, () => ad("scarcity", "big.example")),
      ...Array.from({ length: 2 }, () => ad("pain", "small.example")),
    ];

    const result = computeWhitespace(ours, theirs);
    const all = [
      ...result.sharedPatterns,
      ...result.competitorLeaning,
      ...result.whitespace,
    ];
    const scarcity = all.find((p) => p.value === "scarcity");

    // 18 of 20 ads is 90% by ad count, but one of two advertisers is 50%.
    expect(scarcity?.theirsPct).toBeCloseTo(90, 0);
    expect(scarcity?.theirsByAdvertiser?.meanPct).toBeCloseTo(50, 0);
  });

  it("reports nothing rather than guessing when no row names an advertiser", () => {
    const ours = repeat({ hook_type: "outcome" }, 10);
    const theirs = repeat({ hook_type: "scarcity" }, 10);
    const result = computeWhitespace(ours, theirs);
    const all = [
      ...result.sharedPatterns,
      ...result.competitorLeaning,
      ...result.whitespace,
    ];
    expect(all.every((p) => p.theirsByAdvertiser === null)).toBe(true);
  });
});

describe("isMarketWide", () => {
  const base = {
    category: "hookType" as const,
    value: "scarcity",
    oursPct: 0,
    theirsPct: 40,
  };

  it("rejects a pattern only one advertiser uses, however many ads it ran", () => {
    expect(
      isMarketWide({
        ...base,
        theirsByAdvertiser: { meanPct: 40, usedBy: 1, outOf: 3 },
      }),
    ).toBe(false);
  });

  it("accepts a pattern two or more advertisers use", () => {
    expect(
      isMarketWide({
        ...base,
        theirsByAdvertiser: { meanPct: 30, usedBy: 2, outOf: 3 },
      }),
    ).toBe(true);
  });

  it("treats unmeasured breadth as not proven, rather than assuming the best", () => {
    expect(isMarketWide({ ...base, theirsByAdvertiser: null })).toBe(false);
  });

  it("splits a mixed list into what the market does and what one advertiser does", () => {
    const marketPattern = {
      ...base,
      value: "pain",
      theirsByAdvertiser: { meanPct: 30, usedBy: 3, outOf: 3 },
    };
    const houseStyle = {
      ...base,
      theirsByAdvertiser: { meanPct: 40, usedBy: 1, outOf: 3 },
    };

    const { marketWide, singleAdvertiser } = partitionByAdvertiserBreadth([
      marketPattern,
      houseStyle,
    ]);
    expect(marketWide).toEqual([marketPattern]);
    expect(singleAdvertiser).toEqual([houseStyle]);
  });
});
