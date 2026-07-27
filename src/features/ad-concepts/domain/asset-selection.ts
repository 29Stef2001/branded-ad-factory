import type { BrandAssetType } from "@/features/ad-concepts/domain/schemas";

// Structurally matches infrastructure's BrandAssetRow, but defined locally —
// domain/ has no dependency on infrastructure/, per this repo's layering
// convention (src/features/README.md). TypeScript's structural typing means
// the real repository rows satisfy this without either side importing the other.
export type BrandAssetCandidate = {
  id: string;
  asset_type: BrandAssetType;
  label: string | null;
  // Exactly one of these is set — an asset is either a link or an upload.
  image_url: string | null;
  storage_path: string | null;
  is_primary: boolean;
  is_active: boolean;
  tags: string[];
  region: string | null;
  season: string | null;
  sort_order: number;
};

// A deliberate product choice, not an API ceiling — OpenAI's images.edit()
// supports up to 16 reference images. Raised from 3 to 5 when owner and product
// became their own types: product, owner and logo are the three the model must
// never invent, and at 3 they filled every slot, leaving packaging and
// storefront permanently crowded out. Five fits those three plus two
// contextual assets, without handing the model every asset the brand owns.
export const MAX_REFERENCE_IMAGES = 5;

export type ReferenceRole = "product" | "logo" | BrandAssetType;

/**
 * Campaign context the scorer prefers assets to match. Every field is optional:
 * nothing supplies these yet, and an absent field must not penalise anything.
 */
export type SelectionContext = {
  region?: string | null;
  season?: string | null;
  /** Extra tags to reward, e.g. from a campaign brief. */
  tags?: string[];
};

/**
 * Weights are ordered by how much authority the signal carries, not tuned
 * numerically. An exact type match dwarfs everything else so a correctly typed
 * asset always beats a tag-only guess; the rest only ever reorder assets that
 * already qualify.
 */
const WEIGHT = {
  /** Asset is literally the requested type. */
  exactType: 1000,
  /** Asset merely carries the requested type as a tag — the fallback path. */
  typeAsTag: 300,

  // Below this line the ordering principle is: a specific match beats a
  // standing default. `is_primary` says "use this one when nothing better
  // applies", so it must sit *under* region, season and tag matches — otherwise
  // a christmas-tagged product could never win a christmas campaign, and
  // seasonal tagging would be decorative.
  regionMatch: 90,
  seasonMatch: 90,
  /** Per overlapping context tag. */
  contextTagEach: 40,
  contextTagCap: 120,
  primary: 50,
} as const;

export type AssetScore = {
  assetId: string;
  label: string | null;
  assetType: BrandAssetType;
  score: number;
  /** Human-readable breakdown, for logging rather than logic. */
  reasons: string[];
};

export type AssetSelectionResult<
  T extends BrandAssetCandidate = BrandAssetCandidate,
> = {
  selected: SelectedReference<T>[];
  // Requirements that didn't fit within MAX_REFERENCE_IMAGES get folded into
  // a short text note (using the asset's label) instead of an attached image.
  overflowNotes: string[];
  /**
   * Every candidate considered, per requested role, with its score. Returned
   * rather than logged here: domain/ stays IO-free, so the application layer
   * decides what to do with it.
   */
  scores: Record<string, AssetScore[]>;
};

// Generic over the candidate shape so callers get their own richer type back
// — the Prompt Builder passes assets carrying resolved display URLs and needs
// those URLs on the way out, not the narrowed structural minimum.
export type SelectedReference<
  T extends BrandAssetCandidate = BrandAssetCandidate,
> = {
  role: ReferenceRole;
  // null for "product"/"logo" when the caller resolves them from a pasted URL
  // or the brand profile rather than from the asset library.
  asset: T | null;
};

function normalise(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function scoreAsset<T extends BrandAssetCandidate>(
  asset: T,
  requestedType: BrandAssetType,
  context: SelectionContext,
): AssetScore | null {
  // Inactive assets are excluded outright rather than scored low: disabling an
  // asset is an instruction, not a preference.
  if (!asset.is_active) return null;

  const tags = asset.tags.map(normalise);
  const reasons: string[] = [];
  let score = 0;

  if (asset.asset_type === requestedType) {
    score += WEIGHT.exactType;
    reasons.push(`exact type +${WEIGHT.exactType}`);
  } else if (tags.includes(normalise(requestedType))) {
    score += WEIGHT.typeAsTag;
    reasons.push(`type as tag +${WEIGHT.typeAsTag}`);
  } else {
    // Neither the type nor a tag connects this asset to what was asked for.
    return null;
  }

  if (asset.is_primary) {
    score += WEIGHT.primary;
    reasons.push(`primary +${WEIGHT.primary}`);
  }

  // Region and season only ever reward a match. An asset tagged for a different
  // region is not penalised, because most assets are region-agnostic and
  // punishing them would push a perfectly good generic photo below a worse one.
  if (context.region && normalise(asset.region) === normalise(context.region)) {
    score += WEIGHT.regionMatch;
    reasons.push(`region +${WEIGHT.regionMatch}`);
  }
  if (context.season && normalise(asset.season) === normalise(context.season)) {
    score += WEIGHT.seasonMatch;
    reasons.push(`season +${WEIGHT.seasonMatch}`);
  }

  const contextTags = (context.tags ?? []).map(normalise).filter(Boolean);
  const overlap = contextTags.filter((tag) => tags.includes(tag));
  if (overlap.length > 0) {
    const bonus = Math.min(
      overlap.length * WEIGHT.contextTagEach,
      WEIGHT.contextTagCap,
    );
    score += bonus;
    reasons.push(`tags [${overlap.join(", ")}] +${bonus}`);
  }

  return {
    assetId: asset.id,
    label: asset.label,
    assetType: asset.asset_type,
    score,
    reasons,
  };
}

function rankCandidates<T extends BrandAssetCandidate>(
  requestedType: BrandAssetType,
  availableAssets: T[],
  context: SelectionContext,
): { ranked: T[]; scores: AssetScore[] } {
  const scored = availableAssets
    .map((asset) => ({
      asset,
      scored: scoreAsset(asset, requestedType, context),
    }))
    .filter(
      (entry): entry is { asset: T; scored: AssetScore } =>
        entry.scored !== null,
    );

  scored.sort((a, b) => {
    if (b.scored.score !== a.scored.score)
      return b.scored.score - a.scored.score;
    // sort_order is the author's own ordering, so it settles ties before
    // anything arbitrary does. id last, purely so the result is deterministic.
    if (a.asset.sort_order !== b.asset.sort_order) {
      return a.asset.sort_order - b.asset.sort_order;
    }
    return a.asset.id.localeCompare(b.asset.id);
  });

  return {
    ranked: scored.map((entry) => entry.asset),
    scores: scored.map((entry) => entry.scored),
  };
}

export function selectReferenceAssets<T extends BrandAssetCandidate>(
  requirements: BrandAssetType[],
  availableAssets: T[],
  hasProduct: boolean,
  hasLogo: boolean,
  context: SelectionContext = {},
): AssetSelectionResult<T> {
  const selected: SelectedReference<T>[] = [];
  const scores: Record<string, AssetScore[]> = {};
  // Tracks assets already attached, so the same photo cannot fill two roles.
  const usedAssetIds = new Set<string>();

  const take = (role: ReferenceRole, type: BrandAssetType): T | null => {
    const { ranked, scores: rankedScores } = rankCandidates(
      type,
      availableAssets,
      context,
    );
    scores[role] = rankedScores;
    const pick = ranked.find((asset) => !usedAssetIds.has(asset.id)) ?? null;
    if (pick) usedAssetIds.add(pick.id);
    return pick;
  };

  // Product resolution has two sources, in priority order: a URL pasted for
  // this specific concept beats the library, because it is a deliberate choice
  // about this creative. `asset: null` means "the caller resolves this one".
  if (hasProduct) {
    selected.push({ role: "product", asset: null });
  } else {
    const libraryProduct = take("product", "product");
    if (libraryProduct)
      selected.push({ role: "product", asset: libraryProduct });
  }

  // The owner is included whenever one exists, not only when a concept
  // remembers to ask — a creative featuring a different face every time is the
  // failure this prevents.
  const owner = take("owner", "owner");
  if (owner) selected.push({ role: "owner", asset: owner });

  if (hasLogo) selected.push({ role: "logo", asset: null });

  // Deduplicated: `requirements` comes from the model's structured output, and
  // a repeated type would otherwise spend two reference slots on the same
  // image. Roles already resolved above are excluded so they cannot be
  // attached twice.
  const alreadyHandled = new Set<string>(["logo", "product", "owner"]);
  const contextualTypes = [
    ...new Set(requirements.filter((type) => !alreadyHandled.has(type))),
  ];
  const overflowNotes: string[] = [];

  for (const type of contextualTypes) {
    if (selected.length >= MAX_REFERENCE_IMAGES) {
      // Rank anyway, so the overflow note can name the asset that would have
      // been used and the log shows what was crowded out.
      const { ranked, scores: rankedScores } = rankCandidates(
        type,
        availableAssets,
        context,
      );
      scores[type] = rankedScores;
      const candidate = ranked.find((asset) => !usedAssetIds.has(asset.id));
      if (candidate?.label) overflowNotes.push(`${type}: ${candidate.label}`);
      continue;
    }

    const candidate = take(type, type);
    if (candidate) selected.push({ role: type, asset: candidate });
  }

  return { selected, overflowNotes, scores };
}
