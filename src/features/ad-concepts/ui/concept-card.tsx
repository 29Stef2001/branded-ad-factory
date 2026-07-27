import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GenerateCreativeImageForm } from "@/features/ad-concepts/ui/generate-creative-image-form";
import { RefineConceptForm } from "@/features/ad-concepts/ui/refine-concept-form";
import type { ConceptRow } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export function ConceptCard({
  concept,
  imageUrl,
}: {
  concept: ConceptRow;
  imageUrl?: string;
}) {
  const inspiredByName = concept.competitor_ads?.competitors?.name;
  const refinedFromHeadline = concept.original?.headline;

  return (
    <Card>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not a static/optimizable asset
        <img
          src={imageUrl}
          alt={concept.headline}
          className="h-48 w-full object-cover"
        />
      )}
      <CardHeader>
        <CardTitle>{concept.headline}</CardTitle>
        <CardDescription>{concept.hook}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>{concept.body_copy}</p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Visual direction:</span>{" "}
          {concept.visual_direction}
        </p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">CTA:</span>{" "}
          {concept.call_to_action}
        </p>
        {inspiredByName && (
          <p className="text-xs text-muted-foreground">
            Inspired by: {inspiredByName}
          </p>
        )}
        {refinedFromHeadline && (
          <p className="text-xs text-muted-foreground">
            Refined from: {refinedFromHeadline}
          </p>
        )}
        <RefineConceptForm conceptId={concept.id} />
        <GenerateCreativeImageForm
          conceptId={concept.id}
          hasImage={Boolean(imageUrl)}
          productImageUrl={concept.product_image_url}
        />
      </CardContent>
    </Card>
  );
}
