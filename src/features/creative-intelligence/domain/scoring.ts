/**
 * Performance scoring. Pure arithmetic — no AI, no IO.
 *
 * The whole point of this module is to be honest about small samples. Raw rates
 * rank a creative with 1 click from 5 impressions (20% CTR) above one with 700
 * clicks from 10,000 (7%), which is how a learning system teaches itself
 * nonsense. Every rate here is either a lower confidence bound or shrunk toward
 * the account mean, so thin data sinks on its own rather than needing an
 * arbitrary minimum-impressions rule that someone has to tune.
 */

export type MetricTotals = {
  impressions: number;
  clicks: number;
  linkClicks: number;
  spend: number;
  purchases: number;
  revenue: number;
  addToCart: number;
  initiateCheckout: number;
  landingPageViews: number;
};

export type AccountBaseline = {
  /** Account-wide CTR, used as the prior for shrinkage. */
  ctr: number;
  /** Account-wide ROAS. Zero when nothing has converted yet. */
  roas: number;
  /** Median CPM across the account, for the cost component. */
  medianCpm: number;
  /**
   * Whether this account measures conversions at all.
   *
   * The distinction that decides whether a zero-purchase creative is missing
   * data or bad news. With a pixel reporting, $300 of spend and no purchases is
   * a real, poor result and must be scored as one. Without one, nobody knows,
   * and pretending otherwise would rank every creative by how little we know
   * about it.
   */
  hasConversionTracking: boolean;
};

export type EvidenceTier = "insufficient" | "directional" | "confident";

/** Which metric the composite score actually leaned on. */
export type PrimaryMetric = "roas" | "cpa" | "ctr";

export type CreativeScore = {
  ctr: number | null;
  ctrLowerBound: number | null;
  linkCtr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpa: number | null;
  roas: number | null;
  roasShrunk: number | null;
  conversionRate: number | null;
  compositeScore: number | null;
  primaryMetric: PrimaryMetric;
  evidenceTier: EvidenceTier;
};

/**
 * Thresholds for what the data may be used to claim.
 *
 * These are the gate the rest of Creative Intelligence leans on: analysis and
 * recommendations only ever see `confident` rows, so a thin account produces
 * "still collecting" rather than confident fiction.
 */
export const EVIDENCE_THRESHOLDS = {
  directional: { impressions: 1_000, clicks: 30 },
  confident: { impressions: 10_000, clicks: 200, conversions: 25 },
} as const;

/** Conversions needed before revenue, then cost-per-action, can lead the score. */
export const PRIMARY_METRIC_THRESHOLDS = {
  roas: 25,
  cpa: 10,
} as const;

/** 95% two-sided. */
const Z = 1.96;

/**
 * Wilson score lower bound for a binomial proportion.
 *
 * Answers "what rate does this data actually support", rather than "what rate
 * did we happen to observe". A creative with 500 impressions and 38 clicks
 * observes 7.60% and supports 5.58%; at 50,000 impressions the same rate barely
 * moves. That gap is the uncertainty, made explicit.
 */
export function wilsonLowerBound(
  successes: number,
  trials: number,
  z: number = Z,
): number {
  if (trials <= 0) return 0;
  if (successes <= 0) return 0;

  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const centre = p + z2 / (2 * trials);
  const margin =
    z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials));

  return Math.max(0, (centre - margin) / denominator);
}

/**
 * Empirical-Bayes shrinkage of a ratio toward a prior.
 *
 * ROAS on small spend is noisier than CTR — a single order swings it wildly. A
 * creative with $3 spend and one $80 order does not get to claim 26x. `weight`
 * is the prior's strength in units of the observation's own denominator: at 1.0
 * the prior and the observation carry equal weight when spend equals the
 * account's average.
 */
export function shrinkRatio(
  numerator: number,
  denominator: number,
  prior: number,
  weight = 1,
): number | null {
  if (denominator <= 0) return null;
  const priorMass = weight * denominator;
  return (numerator + prior * priorMass) / (denominator + priorMass);
}

export function evidenceTierFor(totals: MetricTotals): EvidenceTier {
  const { impressions, clicks, purchases } = totals;

  if (
    purchases >= EVIDENCE_THRESHOLDS.confident.conversions ||
    (impressions >= EVIDENCE_THRESHOLDS.confident.impressions &&
      clicks >= EVIDENCE_THRESHOLDS.confident.clicks)
  ) {
    return "confident";
  }

  if (
    impressions >= EVIDENCE_THRESHOLDS.directional.impressions ||
    clicks >= EVIDENCE_THRESHOLDS.directional.clicks
  ) {
    return "directional";
  }

  return "insufficient";
}

/**
 * The most meaningful metric this data supports.
 *
 * Falling back to CTR is a real downgrade, not a detail: optimising clicks
 * alone reliably selects for clickbait. Which metric was used is returned so
 * the UI can say so rather than presenting a CTR ranking as a revenue ranking.
 */
export function primaryMetricFor(totals: MetricTotals): PrimaryMetric {
  if (totals.purchases >= PRIMARY_METRIC_THRESHOLDS.roas) return "roas";
  if (totals.purchases >= PRIMARY_METRIC_THRESHOLDS.cpa) return "cpa";
  return "ctr";
}

/** Relative weights of the composite. Renormalised over whichever apply. */
const COMPOSITE_WEIGHTS = {
  efficiency: 45,
  engagement: 30,
  cost: 10,
  volume: 10,
  recency: 5,
} as const;

/** Maps a value onto 0..1 against a reference, saturating rather than clipping. */
function ratioToUnit(value: number, reference: number): number {
  if (reference <= 0) return 0;
  return value / (value + reference);
}

export function scoreCreative(
  totals: MetricTotals,
  baseline: AccountBaseline,
  options: { daysSinceLastServed?: number } = {},
): CreativeScore {
  const {
    impressions,
    clicks,
    linkClicks,
    spend,
    purchases,
    revenue,
    landingPageViews,
  } = totals;

  const ctr = impressions > 0 ? clicks / impressions : null;
  const linkCtr = impressions > 0 ? linkClicks / impressions : null;
  const ctrLowerBound =
    impressions > 0 ? wilsonLowerBound(clicks, impressions) : null;
  const cpc = clicks > 0 ? spend / clicks : null;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : null;
  const cpa = purchases > 0 ? spend / purchases : null;
  const roas = spend > 0 ? revenue / spend : null;
  const roasShrunk = shrinkRatio(revenue, spend, baseline.roas);
  const conversionRate =
    landingPageViews > 0 ? purchases / landingPageViews : null;

  const evidenceTier = evidenceTierFor(totals);
  const primaryMetric = primaryMetricFor(totals);

  const components: { weight: number; value: number }[] = [];

  // Efficiency is included whenever the account measures conversions at all —
  // including for creatives that converted nothing. Dropping the component
  // there was a real bug: renormalising over the remaining weights made a
  // creative with no conversions score *higher*, so pure clickbait outranked a
  // proven earner. Missing measurement and measured failure are not the same
  // thing, and only the first justifies dropping the term.
  if (baseline.hasConversionTracking && spend > 0) {
    if (roasShrunk !== null && baseline.roas > 0) {
      components.push({
        weight: COMPOSITE_WEIGHTS.efficiency,
        value: ratioToUnit(roasShrunk, baseline.roas),
      });
    } else if (cpa !== null && cpa > 0) {
      // Lower is better, so the reference sits in the numerator.
      components.push({
        weight: COMPOSITE_WEIGHTS.efficiency,
        value: ratioToUnit(spend / Math.max(purchases, 1), cpa),
      });
    }
  }

  if (ctrLowerBound !== null) {
    components.push({
      weight: COMPOSITE_WEIGHTS.engagement,
      value: ratioToUnit(ctrLowerBound, Math.max(baseline.ctr, 0.0001)),
    });
  }

  if (cpm !== null && baseline.medianCpm > 0) {
    // Cheaper delivery is better.
    components.push({
      weight: COMPOSITE_WEIGHTS.cost,
      value: ratioToUnit(baseline.medianCpm, Math.max(cpm, 0.01)),
    });
  }

  if (impressions > 0) {
    // Log scale: proven reach counts, but a creative with 10x the impressions
    // is not 10x more trustworthy.
    components.push({
      weight: COMPOSITE_WEIGHTS.volume,
      value: Math.min(1, Math.log10(impressions + 1) / 6),
    });
  }

  const daysSince = options.daysSinceLastServed;
  if (daysSince !== undefined) {
    // 14-day half-life: a creative that stopped running a month ago is weaker
    // evidence about what works now.
    components.push({
      weight: COMPOSITE_WEIGHTS.recency,
      value: Math.pow(0.5, daysSince / 14),
    });
  }

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const compositeScore =
    totalWeight > 0
      ? Math.round(
          (components.reduce((sum, c) => sum + c.weight * c.value, 0) /
            totalWeight) *
            100 *
            1000,
        ) / 1000
      : null;

  return {
    ctr,
    ctrLowerBound,
    linkCtr,
    cpc,
    cpm,
    cpa,
    roas,
    roasShrunk,
    conversionRate,
    compositeScore,
    primaryMetric,
    evidenceTier,
  };
}

/**
 * Percentile rank of each score within its own set.
 *
 * Ranks only among creatives that cleared `insufficient`: including unscoreable
 * ones would flatter everything above them.
 */
export function percentileRanks(
  scores: {
    id: string;
    compositeScore: number | null;
    evidenceTier: EvidenceTier;
  }[],
): Map<string, number> {
  const ranked = scores
    .filter(
      (
        s,
      ): s is {
        id: string;
        compositeScore: number;
        evidenceTier: EvidenceTier;
      } => s.compositeScore !== null && s.evidenceTier !== "insufficient",
    )
    .sort((a, b) => a.compositeScore - b.compositeScore);

  const result = new Map<string, number>();
  if (ranked.length === 0) return result;
  if (ranked.length === 1) {
    result.set(ranked[0].id, 1);
    return result;
  }

  ranked.forEach((entry, index) => {
    result.set(entry.id, index / (ranked.length - 1));
  });
  return result;
}

/** Account-wide reference points, from the same totals scoring will use. */
export function accountBaseline(all: MetricTotals[]): AccountBaseline {
  const sum = all.reduce(
    (acc, t) => ({
      impressions: acc.impressions + t.impressions,
      clicks: acc.clicks + t.clicks,
      spend: acc.spend + t.spend,
      revenue: acc.revenue + t.revenue,
    }),
    { impressions: 0, clicks: 0, spend: 0, revenue: 0 },
  );

  const cpms = all
    .filter((t) => t.impressions > 0)
    .map((t) => (t.spend / t.impressions) * 1000)
    .sort((a, b) => a - b);

  const medianCpm =
    cpms.length === 0
      ? 0
      : cpms.length % 2 === 1
        ? cpms[(cpms.length - 1) / 2]
        : (cpms[cpms.length / 2 - 1] + cpms[cpms.length / 2]) / 2;

  return {
    ctr: sum.impressions > 0 ? sum.clicks / sum.impressions : 0,
    roas: sum.spend > 0 ? sum.revenue / sum.spend : 0,
    medianCpm,
    // Any purchase anywhere in the account means the pixel is reporting, so a
    // creative with none is a measured failure rather than an unmeasured one.
    hasConversionTracking: all.some((t) => t.purchases > 0),
  };
}
