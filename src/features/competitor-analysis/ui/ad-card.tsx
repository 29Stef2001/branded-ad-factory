import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnalyzeButton } from "@/features/competitor-analysis/ui/analyze-button";
import type { CompetitorAdWithAnalysis } from "@/features/competitor-analysis/infrastructure/competitor-repository";

export function AdCard({ ad }: { ad: CompetitorAdWithAnalysis }) {
  const analysis = ad.ad_analyses;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ad.ad_creative_link_title ?? "Untitled ad"}</CardTitle>
        {ad.ad_creative_body && (
          <CardDescription>{ad.ad_creative_body}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {ad.ad_snapshot_url && (
          <a
            href={ad.ad_snapshot_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline underline-offset-4"
          >
            View original ad
          </a>
        )}

        {analysis ? (
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium">Messaging angle</dt>
              <dd className="text-muted-foreground">
                {analysis.messaging_angle}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Hook</dt>
              <dd className="text-muted-foreground">{analysis.hook}</dd>
            </div>
            <div>
              <dt className="font-medium">Tone</dt>
              <dd className="text-muted-foreground">{analysis.tone}</dd>
            </div>
            <div>
              <dt className="font-medium">Target audience</dt>
              <dd className="text-muted-foreground">
                {analysis.target_audience}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Call to action</dt>
              <dd className="text-muted-foreground">
                {analysis.call_to_action}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium">Summary</dt>
              <dd className="text-muted-foreground">{analysis.summary}</dd>
            </div>
          </dl>
        ) : (
          <AnalyzeButton adId={ad.id} />
        )}
      </CardContent>
    </Card>
  );
}
