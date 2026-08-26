/**
 * Whitespace synthesis: what we do vs. what competitors do, in the same
 * closed vocabulary. Pure — no IO, no AI.
 *
 * Only possible because competitor_creative_features and creative_features
 * share hook_type/angle/offer_type/emotional_driver (see
 * competitor-analysis/domain/competitor-dna.ts). Comparing two piles of free
 * text would produce nothing groupable; comparing two distributions over the
 * same closed lists produces an actual diff.
 */

export type FeatureRow = {
  hook_type: string | null;
  angle: string | null;
  offer_type: string | null;
  emotional_driver: string | null;
  /**
   * Who ran this ad, as a stable key — a landing-page domain, not a page name.
   *
   * Counting ads alone answers the wrong question. Of 141 competitor ads,
   * every one belonged to three advertisers running persona pages: a single
   * house style repeated across fourteen "authors" reads as a 46% market
   * pattern when it is one advertiser with a template. Optional because a row
   * whose advertiser cannot be established still counts toward the per-ad
   * figures; it just cannot vote.
   */
  advertiser?: string | null;
};

export type FeatureCategory = "hookType" | "angle" | "offerType" | "emotionalDriver";

/**
 * The same pattern counted by advertiser rather than by ad.
 *
 * `meanPct` gives every advertiser one vote regardless of how many ads it
 * ran. `usedBy`/`outOf` is the blunter and more useful number: a value at 18%
 * of all ads that only one of three advertisers uses is that advertiser's
 * habit, not the market's.
 */
export type AdvertiserEvidence = {
  meanPct: number;
  /** Advertisers for whom this is a habit, not an outlier — see MIN_ADVERTISER_SHARE_PCT. */
  usedBy: number;
  /** Advertisers who used it even once, however marginally. */
  presentIn: number;
  outOf: number;
};

/**
 * How much of an advertiser's output a value needs before that advertiser
 * counts as using it.
 *
 * A bare "appears at least once" is useless at this scale: with three
 * advertisers running dozens of ads each, nearly every value appears
 * somewhere in all three, and every pattern scores 3/3 — a discriminator
 * that never discriminates. Ten percent separates a habit from a one-off
 * without demanding a value dominate.
 */
const MIN_ADVERTISER_SHARE_PCT = 10;

export type WhitespacePattern = {
  category: FeatureCategory;
  value: string;
  /** Share of our analysed creatives using this value, 0-100. */
  oursPct: number;
  /** Share of analysed competitor ads using this value, 0-100. */
  theirsPct: number;
  /** Null when no competitor row carried an advertiser key. */
  theirsByAdvertiser: AdvertiserEvidence | null;
};

export type WhitespaceResult = {
  /** Both sides cluster on this value at similar rates. */
  sharedPatterns: WhitespacePattern[];
  /** Competitors use this noticeably more than we do. */
  competitorLeaning: WhitespacePattern[];
  /** We use this, competitors barely touch it — a candidate test. */
  whitespace: WhitespacePattern[];
  oursSampleSize: number;
  theirsSampleSize: number;
};

const CATEGORIES: { key: FeatureCategory; column: keyof FeatureRow }[] = [
  { key: "hookType", column: "hook_type" },
  { key: "angle", column: "angle" },
  { key: "offerType", column: "offer_type" },
  { key: "emotionalDriver", column: "emotional_driver" },
];

/** Below this on either side, a category's distribution is noise, not a pattern. */
const MIN_SAMPLE = 5;
/** How close two percentages have to be to call it a shared pattern. */
const SHARED_THRESHOLD_PCT = 10;
/** How far competitors have to lead by to call it their pattern. */
const LEANING_THRESHOLD_PCT = 15;
/** How much we have to lead by, with negligible competitor presence, to call it whitespace. */
const WHITESPACE_MIN_OURS_PCT = 15;
const WHITESPACE_MAX_THEIRS_PCT = 5;

function distribution(
  rows: FeatureRow[],
  column: keyof FeatureRow,
): Map<string, number> {
  const withValue = rows.filter((row) => row[column]);
  const counts = new Map<string, number>();
  for (const row of withValue) {
    const value = row[column] as string;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const pct = new Map<string, number>();
  for (const [value, count] of counts) {
    pct.set(value, withValue.length === 0 ? 0 : (count / withValue.length) * 100);
  }
  return pct;
}

/**
 * A value's share within each advertiser, averaged so every advertiser counts
 * once — plus how many of them use it at all.
 *
 * Returns null when no row carries an advertiser key, so callers can tell
 * "not measured" from "measured, and only one advertiser does this".
 */
function evidenceByAdvertiser(
  rows: FeatureRow[],
  column: keyof FeatureRow,
  value: string,
): AdvertiserEvidence | null {
  const byAdvertiser = new Map<string, FeatureRow[]>();
  for (const row of rows) {
    if (!row.advertiser) continue;
    const list = byAdvertiser.get(row.advertiser) ?? [];
    list.push(row);
    byAdvertiser.set(row.advertiser, list);
  }
  if (byAdvertiser.size === 0) return null;

  const shares: number[] = [];
  for (const advertiserRows of byAdvertiser.values()) {
    const withValue = advertiserRows.filter((row) => row[column]);
    // An advertiser with nothing in this category abstains rather than
    // voting zero — otherwise a competitor we happen to hold two ads for
    // drags every share toward nothing.
    if (withValue.length === 0) continue;
    const matching = withValue.filter((row) => row[column] === value).length;
    shares.push((matching / withValue.length) * 100);
  }
  if (shares.length === 0) return null;

  return {
    meanPct: shares.reduce((sum, share) => sum + share, 0) / shares.length,
    usedBy: shares.filter((share) => share >= MIN_ADVERTISER_SHARE_PCT).length,
    presentIn: shares.filter((share) => share > 0).length,
    outOf: shares.length,
  };
}

/**
 * Diffs two sides' distributions across the shared vocabulary.
 *
 * Both sides need a minimum sample per category before its distribution means
 * anything — three of our creatives happening to share a hook type is not a
 * pattern, it is three data points.
 *
 * Each pattern also carries `theirsByAdvertiser`, because the per-ad share on
 * its own overstates a crowded advertiser. It was measured: three advertisers
 * running persona pages produced all 141 competitor ads, and values at 17-19%
 * of ads turned out to come from one of them.
 */
export function computeWhitespace(
  ours: FeatureRow[],
  theirs: FeatureRow[],
): WhitespaceResult {
  const sharedPatterns: WhitespacePattern[] = [];
  const competitorLeaning: WhitespacePattern[] = [];
  const whitespace: WhitespacePattern[] = [];

  if (ours.length >= MIN_SAMPLE && theirs.length >= MIN_SAMPLE) {
    for (const { key, column } of CATEGORIES) {
      const oursDist = distribution(ours, column);
      const theirsDist = distribution(theirs, column);
      const values = new Set([...oursDist.keys(), ...theirsDist.keys()]);

      for (const value of values) {
        const oursPct = oursDist.get(value) ?? 0;
        const theirsPct = theirsDist.get(value) ?? 0;
        const pattern: WhitespacePattern = {
          category: key,
          value,
          oursPct,
          theirsPct,
          theirsByAdvertiser: evidenceByAdvertiser(theirs, column, value),
        };

        if (
          oursPct > 0 &&
          theirsPct > 0 &&
          Math.abs(oursPct - theirsPct) <= SHARED_THRESHOLD_PCT
        ) {
          sharedPatterns.push(pattern);
        } else if (theirsPct - oursPct >= LEANING_THRESHOLD_PCT) {
          competitorLeaning.push(pattern);
        } else if (
          oursPct >= WHITESPACE_MIN_OURS_PCT &&
          theirsPct <= WHITESPACE_MAX_THEIRS_PCT
        ) {
          whitespace.push(pattern);
        }
      }
    }
  }

  return {
    sharedPatterns,
    competitorLeaning,
    whitespace,
    oursSampleSize: ours.length,
    theirsSampleSize: theirs.length,
  };
}

/**
 * Whether a competitor pattern is the market's or one advertiser's.
 *
 * The question the per-ad percentage cannot answer. A hook at 18% of all
 * competitor ads sounds like a market habit; if every one of those ads came
 * from a single advertiser running fourteen persona pages, it is that
 * advertiser's template. Two independent advertisers is the lowest bar worth
 * calling a pattern — one is an anecdote.
 *
 * Unmeasured (no advertiser keys) returns false: an unproven claim should not
 * inherit the confidence of a proven one.
 */
export function isMarketWide(
  pattern: WhitespacePattern,
  minAdvertisers = 2,
): boolean {
  const evidence = pattern.theirsByAdvertiser;
  if (!evidence) return false;
  return evidence.usedBy >= minAdvertisers;
}

/**
 * Splits competitor patterns into those more than one advertiser runs and
 * those that turn out to be a single advertiser's house style.
 */
export function partitionByAdvertiserBreadth(
  patterns: WhitespacePattern[],
  minAdvertisers = 2,
): { marketWide: WhitespacePattern[]; singleAdvertiser: WhitespacePattern[] } {
  const marketWide: WhitespacePattern[] = [];
  const singleAdvertiser: WhitespacePattern[] = [];
  for (const pattern of patterns) {
    if (isMarketWide(pattern, minAdvertisers)) marketWide.push(pattern);
    else singleAdvertiser.push(pattern);
  }
  return { marketWide, singleAdvertiser };
}
