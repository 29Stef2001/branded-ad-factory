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
};

export type FeatureCategory = "hookType" | "angle" | "offerType" | "emotionalDriver";

export type WhitespacePattern = {
  category: FeatureCategory;
  value: string;
  /** Share of our analysed creatives using this value, 0-100. */
  oursPct: number;
  /** Share of analysed competitor ads using this value, 0-100. */
  theirsPct: number;
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
 * Diffs two sides' distributions across the shared vocabulary.
 *
 * Both sides need a minimum sample per category before its distribution means
 * anything — three of our creatives happening to share a hook type is not a
 * pattern, it is three data points.
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
        const pattern: WhitespacePattern = { category: key, value, oursPct, theirsPct };

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
