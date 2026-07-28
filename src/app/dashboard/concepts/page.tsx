import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DarkPanel } from "@/components/layout/dark-panel";
import { assessBrandCompleteness } from "@/features/ad-concepts/domain/brand-completeness";
import { buttonVariants } from "@/components/ui/button";
import { GenerateConceptsForm } from "@/features/ad-concepts/ui/generate-concepts-form";
import { ConceptCard } from "@/features/ad-concepts/ui/concept-card";
import { ApprovedMessagesManager } from "@/features/ad-concepts/ui/approved-messages-manager";
import {
  getBrandProfile,
  getSignedImageUrls,
  listAnalyzedAdsForInspiration,
  listApprovedMessages,
  listConcepts,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export const metadata: Metadata = {
  title: "Ad Concepts — Branded Ad Factory",
};

// Image generation can take up to ~2 minutes for complex prompts (OpenAI docs).
// 60 was too low to be safe: a measured run with a logo reference image took
// 74s end-to-end, so a serverless deploy would have killed it mid-generation
// and surfaced a timeout instead of an image. Note this ceiling still can't
// exceed the hosting plan's own limit (60s on Vercel Hobby).
export const maxDuration = 300;

export default async function ConceptsPage() {
  const [brandProfile, inspirationOptions, concepts, approvedMessages] =
    await Promise.all([
      getBrandProfile(),
      listAnalyzedAdsForInspiration(),
      listConcepts(),
      listApprovedMessages(),
    ]);

  const completeness = assessBrandCompleteness(brandProfile);

  const imagePaths = concepts
    .map((concept) => concept.creative_image_path)
    .filter((path): path is string => path !== null);
  const imageUrls = await getSignedImageUrls(imagePaths);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ad Concepts</h1>
        <p className="text-muted-foreground">
          Generate original, on-brand ad concepts — optionally informed by a
          competitor ad you&apos;ve already analyzed.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-6">
          <DarkPanel
            title="Brand profile"
            description={`${completeness.score}% complete — read by every AI module.`}
            actions={
              <Link
                href="/dashboard/brand-profile"
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                Edit profile
              </Link>
            }
          />

          {brandProfile && (
            <Card>
              <CardHeader>
                <CardTitle>Generate concepts</CardTitle>
                <CardDescription>
                  Produces 3 concepts at a time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GenerateConceptsForm inspirationOptions={inspirationOptions} />
              </CardContent>
            </Card>
          )}

          {brandProfile && (
            <>
              <DarkPanel
                title="Brand Assets"
                description="Reference images used automatically during image generation."
                actions={
                  <Link
                    href="/dashboard/creative-studio/brand-assets"
                    className={buttonVariants({
                      size: "sm",
                      variant: "outline",
                    })}
                  >
                    Manage assets
                  </Link>
                }
              />
              <ApprovedMessagesManager messages={approvedMessages} />
            </>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {concepts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No concepts generated yet.
            </p>
          ) : (
            concepts.map((concept) => (
              <ConceptCard
                key={concept.id}
                concept={concept}
                imageUrl={
                  concept.creative_image_path
                    ? imageUrls.get(concept.creative_image_path)
                    : undefined
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
