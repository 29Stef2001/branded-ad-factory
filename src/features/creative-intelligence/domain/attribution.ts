/**
 * Linking a Meta ad back to the concept that produced it. Pure — no IO.
 *
 * This is where the whole system most easily produces silent garbage. Without
 * `ads_management` we cannot create the ads, so the user builds them by hand in
 * Ads Manager and nothing carries a concept id across that hand-off.
 *
 * The concept code closes that gap deterministically: the app shows a code on
 * every concept, the user pastes it into the ad name, and ingestion reads it
 * straight back. Perceptual hashing and manual linking exist only for ads that
 * were named before this existed, or by someone who forgot.
 *
 * Nothing here decides on its own. Every match is a proposal; only a confirmed
 * link feeds scoring, because a wrong link teaches a false lesson with full
 * confidence, which is worse than no lesson at all.
 */

export type MatchMethod =
  "concept_code" | "perceptual_hash" | "manual" | "api_created";

export type AttributionCandidate = {
  conceptId: string;
  method: MatchMethod;
  confidence: number;
  /** Why this matched, for the confirmation UI. */
  reason: string;
};

/**
 * Crockford base32 minus I, L, O and U — unambiguous read off a screen and
 * retyped, and it cannot accidentally spell anything.
 */
const CONCEPT_CODE_PATTERN = /\bCS-([0-9ABCDEFGHJKMNPQRSTVWXYZ]{6})\b/i;

/** The code embedded in an ad name, or null. Case-insensitive, normalised. */
export function parseConceptCode(adName: string): string | null {
  const match = adName.match(CONCEPT_CODE_PATTERN);
  return match ? `CS-${match[1].toUpperCase()}` : null;
}

/** True when the string is a well-formed concept code. */
export function isValidConceptCode(value: string): boolean {
  return /^CS-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/.test(value);
}

/**
 * Hamming distance between two hex-encoded perceptual hashes.
 *
 * Returns null rather than a number when the hashes are not comparable, so a
 * malformed hash cannot masquerade as a perfect match at distance 0.
 */
export function hammingDistance(a: string, b: string): number | null {
  if (a.length !== b.length || a.length === 0) return null;
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return null;

  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    // Nibble population count.
    distance +=
      ((xor >> 3) & 1) + ((xor >> 2) & 1) + ((xor >> 1) & 1) + (xor & 1);
  }
  return distance;
}

/**
 * Distance bands for a 64-bit dHash.
 *
 * Meta re-encodes and resizes what it serves, so an exact checksum never
 * matches — which is why Meta's own `image_hash` cannot be compared directly to
 * ours. These bands are deliberately conservative: anything past `review` is
 * treated as no match rather than a weak one.
 */
export const HASH_DISTANCE = {
  /** Confident enough to propose automatically. */
  auto: 6,
  /** Plausible; needs a human to look at the two thumbnails. */
  review: 12,
} as const;

export type ConceptForMatching = {
  id: string;
  conceptCode: string | null;
  perceptualHash: string | null;
};

export type AdForMatching = {
  name: string;
  perceptualHash: string | null;
};

/**
 * Candidates for one ad, best first.
 *
 * A concept-code hit ends the search: it is exact, and continuing would let a
 * fuzzy image match compete with a deterministic one.
 */
export function findAttributionCandidates(
  ad: AdForMatching,
  concepts: ConceptForMatching[],
): AttributionCandidate[] {
  const code = parseConceptCode(ad.name);
  if (code) {
    const exact = concepts.filter((c) => c.conceptCode === code);
    // Two concepts cannot share a code — the unique index prevents it — so more
    // than one match means the data is wrong, and guessing is not the answer.
    if (exact.length === 1) {
      return [
        {
          conceptId: exact[0].id,
          method: "concept_code",
          confidence: 1,
          reason: `Ad name contains ${code}`,
        },
      ];
    }
    if (exact.length === 0) {
      // A code that matches nothing is worth surfacing rather than silently
      // falling through: it usually means a typo in the ad name.
      return [];
    }
    return [];
  }

  if (!ad.perceptualHash) return [];

  const scored: AttributionCandidate[] = [];
  for (const concept of concepts) {
    if (!concept.perceptualHash) continue;
    const distance = hammingDistance(ad.perceptualHash, concept.perceptualHash);
    if (distance === null || distance > HASH_DISTANCE.review) continue;

    scored.push({
      conceptId: concept.id,
      method: "perceptual_hash",
      // 0 distance is not certainty — Meta's re-encoding means identical
      // hashes still only mean "looks the same", so this caps below 1.
      confidence:
        Math.round((1 - distance / (HASH_DISTANCE.review + 1)) * 900) / 1000,
      reason:
        distance <= HASH_DISTANCE.auto
          ? `Image matches closely (distance ${distance})`
          : `Image looks similar (distance ${distance}) — please confirm`,
    });
  }

  return scored.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Whether a candidate may be linked without asking.
 *
 * Only the deterministic path qualifies. A close image match still gets a
 * proposed link, but `confirmed = false`, so it stays out of scoring until
 * someone has actually looked at it.
 */
export function canAutoConfirm(candidate: AttributionCandidate): boolean {
  return (
    candidate.method === "concept_code" || candidate.method === "api_created"
  );
}
