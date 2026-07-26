import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { Competitor } from "@/features/competitor-analysis/infrastructure/competitor-repository";

export function CompetitorList({ competitors }: { competitors: Competitor[] }) {
  if (competitors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No competitors tracked yet. Add one to start pulling their ads.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {competitors.map((competitor) => (
        <Link
          key={competitor.id}
          href={`/dashboard/competitors/${competitor.id}`}
        >
          <Card>
            <CardContent className="flex items-center justify-between">
              <span className="font-medium">{competitor.name}</span>
              <span className="text-sm text-muted-foreground">
                Page ID: {competitor.meta_page_id}
              </span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
