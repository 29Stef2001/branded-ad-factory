import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { sectionFor } from "@/components/shell/nav-config";
import { DarkPanel } from "@/components/layout/dark-panel";
import { EmptyState } from "@/components/layout/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { getCurrentUser } from "@/features/auth/infrastructure/auth-repository";
import { listScoredCreatives } from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";
import { dnaLabel } from "@/features/creative-intelligence/domain/creative-dna";
import { listCompetitorFeaturesForWhitespace } from "@/features/market-intelligence/infrastructure/market-intelligence-repository";
import { getWhitespaceView } from "@/features/market-intelligence/application/synthesize-whitespace";
import { RefreshWhitespaceButton } from "@/features/market-intelligence/ui/refresh-whitespace-button";
import type { EvidenceTier } from "@/features/creative-intelligence/domain/scoring";
import { EvidenceBadge } from "@/features/creative-intelligence/ui/evidence-badge";

export const metadata: Metadata = {
  title: "Creative Factory — Branded Ad Factory",
};

const TOP_WINNERS = 5;

/**
 * Phase 1's single composed view: what wins for us, what competitors do, and
 * where the gap between them is worth testing.
 *
 * Everything on this page is Intelligence-layer composition — no new business
 * logic lives here, it only reads what creative-intelligence and
 * competitor-analysis have already computed and stored, plus
 * market-intelligence's diff of the two. Generation, QA and launch are later
 * phases; "Recommended Tests" below is deliberately labelled as observations,
 * not proposals — hypothesis generation does not exist yet.
 */
export default async function CreativeFactoryPage() {
  const user = await getCurrentUser();
  const userId = user?.id ?? "";

  const [winners, competitorFeatures, whitespace] = await Promise.all([
    listScoredCreatives(30),
    listCompetitorFeaturesForWhitespace(userId),
    getWhitespaceView(userId),
  ]);

  const topWinners = winners
    .filter((row) => row.evidence_tier !== "insufficient")
    .slice(0, TOP_WINNERS);

  const competitorTally = (
    key: "hook_type" | "angle" | "offer_type",
  ): [string, number][] => {
    const tally = new Map<string, number>();
    for (const row of competitorFeatures) {
      const value = row[key];
      if (!value) continue;
      tally.set(value, (tally.get(value) ?? 0) + 1);
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  };

  const { result, observations } = whitespace;
  const hasComparison = result.oursSampleSize >= 5 && result.theirsSampleSize >= 5;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={sectionFor("intelligence/creative-factory")}
        title="Creative Factory"
        description="Our winners, what competitors are doing, and where the gap between them is worth testing. Intelligence only — nothing here generates, QAs or launches a creative yet."
        actions={<RefreshWhitespaceButton />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <DarkPanel
          title="Our winners"
          description="Top scored creatives from the last 30 days."
          contentClassName="flex flex-col gap-2"
        >
          {topWinners.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              No creative has enough evidence to rank yet.
            </span>
          ) : (
            topWinners.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate">
                  {row.concept_headline ?? row.ad_name ?? "Unnamed ad"}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <EvidenceBadge tier={row.evidence_tier as EvidenceTier} />
                  <span className="text-muted-foreground tabular-nums">
                    {row.composite_score ?? "—"}
                  </span>
                </div>
              </div>
            ))
          )}
        </DarkPanel>

        <DarkPanel
          title="Competitor patterns"
          description={`From ${result.theirsSampleSize} analysed competitor ads.`}
          contentClassName="flex flex-col gap-3"
        >
          {competitorFeatures.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              No competitor ads analysed yet — read DNA for a competitor&apos;s
              ads from their page.
            </span>
          ) : (
            <>
              <PatternTally title="Hooks" entries={competitorTally("hook_type")} />
              <PatternTally title="Angles" entries={competitorTally("angle")} />
            </>
          )}
        </DarkPanel>
      </div>

      <DarkPanel
        title="Market trends & whitespace"
        description="How our closed-vocabulary creative DNA compares against competitors', on the same terms."
        contentClassName="flex flex-col gap-4"
      >
        {!hasComparison ? (
          <EmptyState
            icon={Sparkles}
            title="Not enough data on both sides yet"
            description="This needs at least 5 of our own analysed creatives and 5 analysed competitor ads before a comparison means anything."
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <PatternGroup
                title="Shared"
                tone="muted"
                patterns={result.sharedPatterns}
              />
              <PatternGroup
                title="Competitor-leaning"
                tone="warning"
                patterns={result.competitorLeaning}
              />
              <PatternGroup
                title="Whitespace"
                tone="success"
                patterns={result.whitespace}
              />
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold tracking-tight">
                Recommended tests
              </h3>
              <p className="text-xs text-muted-foreground">
                Observations, not proposals — turning these into testable
                hypotheses is a later phase.
              </p>
              {observations.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No observations generated yet. Refresh market analysis to
                  read one from the patterns above.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                  {observations.map((observation) => (
                    <li key={observation} className="text-muted-foreground">
                      — {observation}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </DarkPanel>
    </div>
  );
}

function PatternTally({
  title,
  entries,
}: {
  title: string;
  entries: [string, number][];
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </p>
      {entries.length === 0 ? (
        <span className="text-sm text-muted-foreground">Nothing yet</span>
      ) : (
        <div className="mt-1 flex flex-col gap-1">
          {entries.map(([value, count]) => (
            <div
              key={value}
              className="flex items-center justify-between text-sm"
            >
              <span>{dnaLabel(value)}</span>
              <span className="text-muted-foreground tabular-nums">
                {count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PatternGroup({
  title,
  tone,
  patterns,
}: {
  title: string;
  tone: "muted" | "warning" | "success";
  patterns: { category: string; value: string; oursPct: number; theirsPct: number }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <StatusBadge label={title} tone={tone} />
      {patterns.length === 0 ? (
        <span className="text-sm text-muted-foreground">None found</span>
      ) : (
        patterns.slice(0, 5).map((pattern) => (
          <div
            key={`${pattern.category}-${pattern.value}`}
            className="text-sm"
          >
            <span>{dnaLabel(pattern.value)}</span>
            <span className="text-muted-foreground">
              {" "}
              — us {pattern.oursPct.toFixed(0)}%, them{" "}
              {pattern.theirsPct.toFixed(0)}%
            </span>
          </div>
        ))
      )}
    </div>
  );
}
