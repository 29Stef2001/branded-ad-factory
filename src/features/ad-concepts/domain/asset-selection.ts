import type { BrandAssetType } from "@/features/ad-concepts/domain/schemas";

// Structurally matches infrastructure's BrandAssetRow, but defined locally —
// domain/ has no dependency on infrastructure/, per this repo's layering
// convention (src/features/README.md). TypeScript's structural typing means
// the real repository rows satisfy this without either side importing the other.
export type BrandAssetCandidate = {
  id: string;
  asset_type: BrandAssetType;
  label: string | null;
  image_url: string;
  is_primary: boolean;
  is_active: boolean;
};

// Product+logo+one contextual asset is a deliberate product choice, not an API
// ceiling — OpenAI's images.edit() actually supports up to 16 reference images.
// Capping at 3 keeps the generation prompt focused instead of overloading the
// model with every asset the brand has ever uploaded.
export const MAX_REFERENCE_IMAGES = 3;

export type ReferenceRole = "product" | "logo" | BrandAssetType;

export type SelectedReference = {
  role: ReferenceRole;
  // null for "product"/"logo" — those are resolved from product_image_url /
  // getPrimaryLogoUrl() by the caller, not from the brand_assets list this
  // function ranks contextual candidates from.
  asset: BrandAssetCandidate | null;
};

export type AssetSelectionResult = {
  selected: SelectedReference[];
  // Requirements that didn't fit within MAX_REFERENCE_IMAGES get folded into
  // a short text note (using the asset's label) instead of an attached image.
  overflowNotes: string[];
};

function pickBestAsset(
  type: BrandAssetType,
  availableAssets: BrandAssetCandidate[],
): BrandAssetCandidate | null {
  const matches = availableAssets.filter(
    (asset) => asset.asset_type === type && asset.is_active,
  );
  if (matches.length === 0) return null;
  return matches.find((asset) => asset.is_primary) ?? matches[0];
}

export function selectReferenceAssets(
  requirements: BrandAssetType[],
  availableAssets: BrandAssetCandidate[],
  hasProduct: boolean,
  hasLogo: boolean,
): AssetSelectionResult {
  const selected: SelectedReference[] = [];

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
