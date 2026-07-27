import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { BrandAssetsManager } from "@/features/ad-concepts/ui/brand-assets-manager";
import {
  getBrandProfile,
  listBrandAssetsWithUrls,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export const metadata: Metadata = {
  title: "Brand Assets — Branded Ad Factory",
};

export default async function BrandAssetsPage() {
  const brandProfile = await getBrandProfile();

  // Assets hang off the brand profile, so without one there is nothing to
  // attach them to — say that plainly instead of rendering empty type panels.
  if (!brandProfile) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Creative Studio" title="Brand Assets" />
        <EmptyState
          title="Set up your brand profile first"
          description="Brand assets belong to a brand profile, and you don't have one yet."
          action={
            <Link
              href="/dashboard/concepts"
              className={buttonVariants({ size: "sm" })}
            >
              Go to brand profile
            </Link>
          }
        />
      </div>
    );
  }

  const assets = await listBrandAssetsWithUrls();
  const activeCount = assets.filter((asset) => asset.is_active).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Creative Studio"
        title="Brand Assets"
        subtitle={`${assets.length} total · ${activeCount} active`}
        description="Real reference images for this brand — logo, packaging, storefront and more. Image generation picks from the active ones automatically, based on what each concept's scene requires."
      />
      <BrandAssetsManager assets={assets} />
    </div>
  );
}
