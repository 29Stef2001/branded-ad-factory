import { ImagePlus } from "lucide-react";
import { DarkPanel } from "@/components/layout/dark-panel";
import { EmptyState } from "@/components/layout/empty-state";
import { AddBrandAssetForm } from "@/features/ad-concepts/ui/add-brand-asset-form";
import { BrandAssetRow } from "@/features/ad-concepts/ui/brand-asset-row";
import type { BrandAssetType } from "@/features/ad-concepts/domain/schemas";
import type { BrandAssetWithUrl } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export const ASSET_TYPE_LABELS: Record<BrandAssetType, string> = {
  owner: "Owner / Founder",
  product: "Product",
  logo: "Logo",
  icon: "Icon",
  packaging: "Packaging",
  business_card: "Business Card",
  thank_you_card: "Thank-you Card",
  shopping_bag: "Shopping Bag",
  storefront: "Storefront",
  other: "Other",
};

/** Shown under each type's heading so it is obvious what belongs there. */
export const ASSET_TYPE_HINTS: Partial<Record<BrandAssetType, string>> = {
  owner:
    "The real person who appears in your creatives. Without this, every generated image invents a different face.",
  product:
    "Real product photography from your store. Generation composites these instead of inventing jewellery.",
};

const ASSET_TYPES = Object.keys(ASSET_TYPE_LABELS) as BrandAssetType[];

export function BrandAssetsManager({
  assets,
}: {
  assets: BrandAssetWithUrl[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {assets.length === 0 && (
        <EmptyState
          icon={ImagePlus}
          title="No brand assets yet"
          description="Upload a logo, packaging shot or storefront photo below. Generation picks from these automatically, based on what each concept's scene calls for."
        />
      )}

      {/* One panel per type rather than a single long list: assets are chosen
          per type at generation time, so grouping matches how they are used. */}
      <div className="grid gap-4 xl:grid-cols-2">
        {ASSET_TYPES.map((assetType) => {
          const assetsOfType = assets.filter((a) => a.asset_type === assetType);
          const label = ASSET_TYPE_LABELS[assetType];

          return (
            <DarkPanel
              key={assetType}
              title={label}
              description={
                ASSET_TYPE_HINTS[assetType] ??
                (assetsOfType.length === 0
                  ? "None yet"
                  : `${assetsOfType.length} ${assetsOfType.length === 1 ? "asset" : "assets"}`)
              }
              contentClassName="flex flex-col gap-3"
            >
              {assetsOfType.map((asset) => (
                <BrandAssetRow key={asset.id} asset={asset} />
              ))}
              <AddBrandAssetForm assetType={assetType} typeLabel={label} />
            </DarkPanel>
          );
        })}
      </div>
    </div>
  );
}
