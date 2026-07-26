import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ConceptRow } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export function ConceptCard({ concept }: { concept: ConceptRow }) {
  const inspiredByName = concept.competitor_ads?.competitors?.name;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{concept.headline}</CardTitle>
        <CardDescription>{concept.hook}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
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
      </CardContent>
    </Card>
  );
}
