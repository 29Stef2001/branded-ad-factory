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
};

// Product+logo+one contextual asset is a deliberate product choice, not an API
// ceiling — OpenAI's images.edit() actually supports up to 16 reference images.
// Capping at 3 keeps the generation prompt focused instead of overloading the
// model with every asset the brand has ever uploaded.
export const MAX_REFERENCE_IMAGES = 3;

export type ReferenceRole = "product" | "logo" | BrandAssetType;

// Generic over the candidate shape so callers get their own richer type back
// — the Prompt Builder passes assets carrying resolved display URLs and needs
// those URLs on the way out, not the narrowed structural minimum.
export type SelectedReference<
  T extends BrandAssetCandidate = BrandAssetCandidate,
> = {
  role: ReferenceRole;
  // null for "product"/"logo" — those are resolved from product_image_url /
  // the brand asset library by the caller, not from the contextual candidates
  // this function ranks.
  asset: T | null;
};

export type AssetSelectionResult<
  T extends BrandAssetCandidate = BrandAssetCandidate,
> = {
  selected: SelectedReference<T>[];
  // Requirements that didn't fit within MAX_REFERENCE_IMAGES get folded into
  // a short text note (using the asset's label) instead of an attached image.
  overflowNotes: string[];
};

function pickBestAsset<T extends BrandAssetCandidate>(
  type: BrandAssetType,
  availableAssets: T[],
): T | null {
  const matches = availableAssets.filter(
    (asset) => asset.asset_type === type && asset.is_active,
  );
  if (matches.length === 0) return null;
  return matches.find((asset) => asset.is_primary) ?? matches[0];
}

export function selectReferenceAssets<T extends BrandAssetCandidate>(
  requirements: BrandAssetType[],
  availableAssets: T[],
  hasProduct: boolean,
  hasLogo: boolean,
): AssetSelectionResult<T> {
  const selected: SelectedReference<T>[] = [];

  if (hasProduct) selected.push({ role: "product", asset: null });
  if (hasLogo) selected.push({ role: "logo", asset: null });

  // Deduplicated: `requirements` comes from the model's structured output, and
  // a repeated type (["packaging", "packaging"]) would otherwise spend two of
  // the three reference slots on the same image — crowding out a genuinely
  // different asset for no gain.
  const contextualTypes = [
    ...new Set(requirements.filter((type) => type !== "logo")),
  ];
  const overflowNotes: string[] = [];

  for (const type of contextualTypes) {
    const candidate = pickBestAsset(type, availableAssets);

    if (selected.length >= MAX_REFERENCE_IMAGES) {
      if (candidate?.label) overflowNotes.push(`${type}: ${candidate.label}`);
      continue;
    }

    if (candidate) {
      selected.push({ role: type, asset: candidate });
    }
  }

  return { selected, overflowNotes };
}
