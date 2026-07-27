import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AddBrandAssetForm } from "@/features/ad-concepts/ui/add-brand-asset-form";
import { BrandAssetRow } from "@/features/ad-concepts/ui/brand-asset-row";
import type { BrandAssetType } from "@/features/ad-concepts/domain/schemas";
import type { BrandAssetRow as BrandAssetRowData } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

const ASSET_TYPE_LABELS: Record<BrandAssetType, string> = {
  logo: "Logo",
  icon: "Icon",
  packaging: "Packaging",
  business_card: "Business Card",
  thank_you_card: "Thank-you Card",
  shopping_bag: "Shopping Bag",
  storefront: "Storefront",
  other: "Other",
};

const ASSET_TYPES = Object.keys(ASSET_TYPE_LABELS) as BrandAssetType[];

export function BrandAssetsManager({
  assets,
}: {
  assets: BrandAssetRowData[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand Assets</CardTitle>
        <CardDescription>
          Real reference images for your product packaging, storefront, and more
          — automatically picked for generation based on each concept&apos;s
          scene.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {ASSET_TYPES.map((assetType) => {
          const assetsOfType = assets.filter((a) => a.asset_type === assetType);
          return (
            <div key={assetType} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">
                {ASSET_TYPE_LABELS[assetType]}
              </h3>
              {assetsOfType.length > 0 && (
                <div className="flex flex-col gap-2">
                  {assetsOfType.map((asset) => (
                    <BrandAssetRow key={asset.id} asset={asset} />
                  ))}
                </div>
              )}
              <AddBrandAssetForm assetType={assetType} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
