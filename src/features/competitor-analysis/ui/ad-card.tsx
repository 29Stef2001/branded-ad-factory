import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnalyzeButton } from "@/features/competitor-analysis/ui/analyze-button";
import { ConfidenceBadge } from "@/features/competitor-analysis/ui/confidence-badge";
import { ObservedVsInferredList } from "@/features/market-intelligence/ui/observed-vs-inferred-list";
import { dnaLabel } from "@/features/creative-intelligence/domain/creative-dna";
import type { CompetitorAdWithAnalysis } from "@/features/competitor-analysis/infrastructure/competitor-repository";

export function AdCard({ ad }: { ad: CompetitorAdWithAnalysis }) {
  const dna = ad.competitor_creative_features;
  const legacyAnalysis = ad.ad_analyses;

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

        {dna ? (
          // The closed-vocabulary read, comparable against our own creative
          // DNA. Takes priority over the legacy free-text analysis below —
          // once an ad has this, the old flat summary adds nothing.
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <ConfidenceBadge confidence={dna.confidence} />
            </div>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium">Hook</dt>
                <dd className="text-muted-foreground">
                  {dnaLabel(dna.hook_type)}
                  {dna.hook_text ? ` — "${dna.hook_text}"` : ""}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Angle</dt>
                <dd className="text-muted-foreground">
                  {dnaLabel(dna.angle)}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Awareness level</dt>
                <dd className="text-muted-foreground">
                  {dnaLabel(dna.awareness_level)}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Offer</dt>
                <dd className="text-muted-foreground">
                  {dnaLabel(dna.offer_type)}
                  {dna.offer_strength && dna.offer_strength !== "none"
                    ? ` (${dnaLabel(dna.offer_strength)})`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Emotional driver</dt>
                <dd className="text-muted-foreground">
                  {dnaLabel(dna.emotional_driver)}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Call to action</dt>
                <dd className="text-muted-foreground">
                  {dnaLabel(dna.cta_style)}
                </dd>
              </div>
            </dl>
            <ObservedVsInferredList
              observedFacts={dna.observed_facts}
              inferredHypotheses={dna.inferred_hypotheses}
            />
          </div>
        ) : legacyAnalysis ? (
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium">Messaging angle</dt>
              <dd className="text-muted-foreground">
                {legacyAnalysis.messaging_angle}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Hook</dt>
              <dd className="text-muted-foreground">{legacyAnalysis.hook}</dd>
            </div>
            <div>
              <dt className="font-medium">Tone</dt>
              <dd className="text-muted-foreground">{legacyAnalysis.tone}</dd>
            </div>
            <div>
              <dt className="font-medium">Target audience</dt>
              <dd className="text-muted-foreground">
                {legacyAnalysis.target_audience}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Call to action</dt>
              <dd className="text-muted-foreground">
                {legacyAnalysis.call_to_action}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium">Summary</dt>
              <dd className="text-muted-foreground">
                {legacyAnalysis.summary}
              </dd>
            </div>
          </dl>
        ) : (
          <AnalyzeButton adId={ad.id} />
        )}
      </CardContent>
    </Card>
  );
}
