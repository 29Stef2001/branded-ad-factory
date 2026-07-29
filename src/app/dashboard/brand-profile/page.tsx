import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { DarkPanel } from "@/components/layout/dark-panel";
import { buttonVariants } from "@/components/ui/button";
import { BrandProfileForm } from "@/features/ad-concepts/ui/brand-profile-form";
import { BrandCompletenessPanel } from "@/features/ad-concepts/ui/brand-completeness-panel";
import { assessBrandCompleteness } from "@/features/ad-concepts/domain/brand-completeness";
import { getBrandProfile } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { sectionFor } from "@/components/shell/nav-config";

export const metadata: Metadata = {
  title: "Brand Profile — Branded Ad Factory",
};

export default async function BrandProfilePage() {
  const profile = await getBrandProfile();
  const completeness = assessBrandCompleteness(profile);
  const isFirstRun = profile === null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={sectionFor("brand-profile")}
        title="Brand Profile"
        subtitle={isFirstRun ? undefined : `${completeness.score}% complete`}
        description="Everything the AI modules know about this brand. Concept generation, image generation and QA all read from here — nothing about the brand is configured anywhere else."
      />

      {isFirstRun ? (
        // First run gets an explanation instead of a bare form: twenty empty
        // fields with no context is the moment people give up.
        <DarkPanel
          title="Start here"
          description="This is the first thing to set up. Everything else in the app reads from it."
          contentClassName="flex flex-col gap-2 text-sm text-muted-foreground"
        >
          <p>
            Four fields are required — brand name, category, target audience and
            tone. Everything else sharpens the output rather than unlocking it,
            so you can fill those four now and come back to the rest.
          </p>
          <p>
            The founder section matters more than it looks: without it,
            generation invents whoever it likes for scenes featuring a person.
          </p>
        </DarkPanel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <BrandCompletenessPanel completeness={completeness} />
          <DarkPanel
            title="Related"
            description="Brand information lives here; images live in Brand Assets."
            contentClassName="flex flex-col gap-2"
          >
            <Link
              href="/dashboard/creative-studio/brand-assets"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Brand Assets
            </Link>
            <p className="text-xs text-muted-foreground">
              The founder&apos;s photo, your logo and product photography are
              uploaded there, not here — generation attaches them as reference
              images.
            </p>
          </DarkPanel>
        </div>
      )}

      <BrandProfileForm profile={profile} />
    </div>
  );
}
