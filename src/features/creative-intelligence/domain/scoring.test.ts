import { describe, expect, it } from "vitest";
import {
  EVIDENCE_THRESHOLDS,
  accountBaseline,
  evidenceTierFor,
  percentileRanks,
  primaryMetricFor,
  scoreCreative,
  shrinkRatio,
  wilsonLowerBound,
  type MetricTotals,
} from "@/features/creative-intelligence/domain/scoring";

function totals(overrides: Partial<MetricTotals> = {}): MetricTotals {
  return {
    impressions: 0,
    clicks: 0,
    linkClicks: 0,
    spend: 0,
    purchases: 0,
    revenue: 0,
    addToCart: 0,
    initiateCheckout: 0,
    landingPageViews: 0,
    ...overrides,
  };
}

const baseline = {
  ctr: 0.0764,
  roas: 2,
  medianCpm: 15,
  hasConversionTracking: true,
};

describe("wilsonLowerBound", () => {
  it("discounts a small sample well below its observed rate", () => {
    // The account's own numbers: 500 impressions, 38 clicks reads as 7.6%.
    const observed = 38 / 500;
    const bound = wilsonLowerBound(38, 500);

    expect(observed).toBeCloseTo(0.076, 3);
    expect(bound).toBeCloseTo(0.0558, 3);
    expect(bound).toBeLessThan(observed);
  });

  it("converges on the observed rate as the sample grows", () => {
    const small = wilsonLowerBound(38, 500);
    const large = wilsonLowerBound(3800, 50_000);

    expect(large).toBeGreaterThan(small);
    expect(0.076 - large).toBeLessThan(0.076 - small);
    expect(large).toBeCloseTo(0.076, 2);
  });

  it("ranks proven volume above a lucky handful", () => {
    // The failure this exists to prevent: 1/5 is a 20% CTR and means nothing.
    const lucky = wilsonLowerBound(1, 5);
    const proven = wilsonLowerBound(700, 10_000);

    expect(proven).toBeGreaterThan(lucky);
  });

  it("returns zero for no data rather than dividing by zero", () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
    expect(wilsonLowerBound(0, 1000)).toBe(0);
    expect(wilsonLowerBound(5, 0)).toBe(0);
  });

  it("never exceeds the observed rate", () => {
    for (const [clicks, impressions] of [
      [1, 10],
      [50, 100],
      [999, 1000],
    ]) {
      expect(wilsonLowerBound(clicks, impressions)).toBeLessThanOrEqual(
        clicks / impressions,
      );
    }
  });
});

describe("shrinkRatio", () => {
  it("pulls an implausible ROAS on tiny spend toward the account mean", () => {
    // $3 spend, one $80 order — raw ROAS 26.7x.
    const raw = 80 / 3;
    const shrunk = shrinkRatio(80, 3, 2)!;

    expect(raw).toBeGreaterThan(26);
    expect(shrunk).toBeLessThan(15);
    expect(shrunk).toBeGreaterThan(2);
  });

  it("barely moves a ratio backed by real spend", () => {
    const raw = 6000 / 2000;
    const shrunk = shrinkRatio(6000, 2000, 2)!;

    expect(shrunk).toBeCloseTo(2.5, 1);
    expect(Math.abs(raw - shrunk)).toBeLessThan(0.6);
  });

  it("returns the prior when there is no observation to weigh", () => {
    expect(shrinkRatio(0, 100, 2)).toBeCloseTo(1, 5);
  });

  it("returns null rather than dividing by zero", () => {
    expect(shrinkRatio(50, 0, 2)).toBeNull();
  });
});

describe("evidenceTierFor", () => {
  it("calls a thin creative insufficient", () => {
    expect(evidenceTierFor(totals({ impressions: 850, clicks: 29 }))).toBe(
      "insufficient",
    );
  });

  it("promotes to directional on either impressions or clicks", () => {
    expect(evidenceTierFor(totals({ impressions: 1000, clicks: 5 }))).toBe(
      "directional",
    );
    expect(evidenceTierFor(totals({ impressions: 100, clicks: 30 }))).toBe(
      "directional",
    );
  });

  it("requires both impressions and clicks for confident", () => {
    expect(evidenceTierFor(totals({ impressions: 10_000, clicks: 199 }))).toBe(
      "directional",
    );
    expect(evidenceTierFor(totals({ impressions: 10_000, clicks: 200 }))).toBe(
      "confident",
    );
  });

  it("lets conversions alone establish confidence", () => {
    // 25 purchases is worth more than 200 clicks, and does not need the volume.
    expect(
      evidenceTierFor(totals({ impressions: 500, clicks: 40, purchases: 25 })),
    ).toBe("confident");
  });

  it("rates this account's real monthly volume as directional at best", () => {
    // 4,241 impressions and 324 clicks across the whole account, split five
    // ways. Documented as a test so nobody is surprised by "still collecting".
    const perCreative = totals({ impressions: 848, clicks: 65 });

    expect(evidenceTierFor(perCreative)).toBe("directional");
    expect(perCreative.impressions).toBeLessThan(
      EVIDENCE_THRESHOLDS.confident.impressions,
    );
  });
});

describe("primaryMetricFor", () => {
  it("falls back to CTR when nothing has converted", () => {
    expect(
      primaryMetricFor(totals({ impressions: 50_000, clicks: 4000 })),
    ).toBe("ctr");
  });

  it("uses CPA once conversions are countable", () => {
    expect(primaryMetricFor(totals({ purchases: 10 }))).toBe("cpa");
  });

  it("uses ROAS once there are enough conversions to trust revenue", () => {
    expect(primaryMetricFor(totals({ purchases: 25 }))).toBe("roas");
  });
});

describe("scoreCreative", () => {
  it("reports every rate the data supports", () => {
    const score = scoreCreative(
      totals({
        impressions: 20_000,
        clicks: 1500,
        linkClicks: 1200,
        spend: 300,
        purchases: 30,
        revenue: 900,
        landingPageViews: 1000,
      }),
      baseline,
    );

    expect(score.ctr).toBeCloseTo(0.075, 4);
    expect(score.linkCtr).toBeCloseTo(0.06, 4);
    expect(score.cpc).toBeCloseTo(0.2, 4);
    expect(score.cpm).toBeCloseTo(15, 4);
    expect(score.cpa).toBeCloseTo(10, 4);
    expect(score.roas).toBeCloseTo(3, 4);
    expect(score.conversionRate).toBeCloseTo(0.03, 4);
    expect(score.primaryMetric).toBe("roas");
    expect(score.evidenceTier).toBe("confident");
  });

  it("scores on CTR alone when there is no conversion data", () => {
    const score = scoreCreative(
      totals({ impressions: 20_000, clicks: 1500, spend: 300 }),
      { ...baseline, roas: 0, hasConversionTracking: false },
    );

    expect(score.primaryMetric).toBe("ctr");
    expect(score.roas).toBe(0);
    expect(score.compositeScore).not.toBeNull();
    // The efficiency term is absent rather than zero, so the remaining
    // components renormalise and the score stays comparable.
    expect(score.compositeScore!).toBeGreaterThan(0);
  });

  it("does not let an unconverted creative outrank a converting one", () => {
    const converting = scoreCreative(
      totals({
        impressions: 20_000,
        clicks: 1000,
        spend: 300,
        purchases: 40,
        revenue: 1600,
      }),
      baseline,
    );
    const clickbait = scoreCreative(
      totals({ impressions: 20_000, clicks: 3000, spend: 300, purchases: 0 }),
      baseline,
    );

    // The trap this design exists to avoid: CTR alone would rank clickbait
    // first. It still scores well on engagement, but efficiency decides.
    expect(converting.primaryMetric).toBe("roas");
    expect(clickbait.primaryMetric).toBe("ctr");
    expect(converting.compositeScore!).toBeGreaterThan(
      clickbait.compositeScore!,
    );
  });

  it("does not reward a creative for having no conversion data", () => {
    // The bug this locks in: dropping the efficiency component renormalised the
    // remaining weights, so engagement went from 30/95 to 30/50 of the total
    // and a creative that converted nothing scored *higher* for it. On an
    // account that measures conversions, zero purchases is a measured failure.
    const noConversions = totals({
      impressions: 20_000,
      clicks: 3000,
      spend: 300,
      purchases: 0,
    });

    const measured = scoreCreative(noConversions, baseline);
    const unmeasured = scoreCreative(noConversions, {
      ...baseline,
      hasConversionTracking: false,
    });

    expect(measured.compositeScore!).toBeLessThan(unmeasured.compositeScore!);
  });

  it("ranks a proven creative above a lucky one with the same raw CTR", () => {
    const lucky = scoreCreative(
      totals({ impressions: 100, clicks: 8, spend: 2 }),
      baseline,
    );
    const proven = scoreCreative(
      totals({ impressions: 20_000, clicks: 1600, spend: 300 }),
      baseline,
    );

    expect(lucky.ctr).toBeCloseTo(proven.ctr!, 2);
    expect(proven.compositeScore!).toBeGreaterThan(lucky.compositeScore!);
  });

  it("discounts a creative that stopped running weeks ago", () => {
    const input = totals({ impressions: 20_000, clicks: 1500, spend: 300 });
    const fresh = scoreCreative(input, baseline, { daysSinceLastServed: 0 });
    const stale = scoreCreative(input, baseline, { daysSinceLastServed: 28 });

    expect(fresh.compositeScore!).toBeGreaterThan(stale.compositeScore!);
  });

  it("returns nulls rather than zeros for a creative with no delivery", () => {
    const score = scoreCreative(totals(), baseline);

    expect(score.ctr).toBeNull();
    expect(score.cpc).toBeNull();
    expect(score.roas).toBeNull();
    expect(score.evidenceTier).toBe("insufficient");
  });
});

describe("percentileRanks", () => {
  it("ranks scored creatives from 0 to 1", () => {
    const ranks = percentileRanks([
      { id: "a", compositeScore: 10, evidenceTier: "directional" },
      { id: "b", compositeScore: 50, evidenceTier: "directional" },
      { id: "c", compositeScore: 90, evidenceTier: "confident" },
    ]);

    expect(ranks.get("a")).toBe(0);
    expect(ranks.get("b")).toBe(0.5);
    expect(ranks.get("c")).toBe(1);
  });

  it("excludes insufficient creatives rather than flattering the rest", () => {
    const ranks = percentileRanks([
      { id: "thin", compositeScore: 95, evidenceTier: "insufficient" },
      { id: "real", compositeScore: 40, evidenceTier: "directional" },
    ]);

    expect(ranks.has("thin")).toBe(false);
    expect(ranks.get("real")).toBe(1);
  });

  it("handles an empty and a single-creative account", () => {
    expect(percentileRanks([]).size).toBe(0);
    expect(
      percentileRanks([
        { id: "only", compositeScore: 42, evidenceTier: "directional" },
      ]).get("only"),
    ).toBe(1);
  });
});

describe("accountBaseline", () => {
  it("pools totals rather than averaging per-creative rates", () => {
    // The averaging-averages trap: the mean of 10% and 1% is not the pooled
    // rate when one creative has 100x the impressions.
    const base = accountBaseline([
      totals({ impressions: 100, clicks: 10, spend: 5 }),
      totals({ impressions: 10_000, clicks: 100, spend: 200 }),
    ]);

    expect(base.ctr).toBeCloseTo(110 / 10_100, 5);
    expect(base.ctr).toBeLessThan(0.055);
  });

  it("takes the median CPM, so one runaway creative cannot move it", () => {
    const base = accountBaseline([
      totals({ impressions: 1000, spend: 10 }),
      totals({ impressions: 1000, spend: 20 }),
      totals({ impressions: 1000, spend: 1000 }),
    ]);

    expect(base.medianCpm).toBeCloseTo(20, 4);
  });

  it("reports zero rather than NaN for an account with no delivery", () => {
    const base = accountBaseline([totals()]);

    expect(base.ctr).toBe(0);
    expect(base.roas).toBe(0);
    expect(base.medianCpm).toBe(0);
  });
});
