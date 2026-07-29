import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Link2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { sectionFor } from "@/components/shell/nav-config";
import { DarkPanel } from "@/components/layout/dark-panel";
import { EmptyState } from "@/components/layout/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/status-badge";
import {
  EvidenceBadge,
  METRIC_EXPLANATIONS,
  PrimaryMetricBadge,
  TIER_EXPLANATIONS,
} from "@/features/creative-intelligence/ui/evidence-badge";
import { SyncButton } from "@/features/creative-intelligence/ui/sync-button";
import {
  listCreativeLinks,
  listRecentJobRuns,
  listScoredCreatives,
} from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";
import type {
  EvidenceTier,
  PrimaryMetric,
} from "@/features/creative-intelligence/domain/scoring";

export const metadata: Metadata = {
  title: "Creative Performance — Branded Ad Factory",
};

// Ingest, attribute and score can take a while on a large account.
export const maxDuration = 300;

const nf = new Intl.NumberFormat("en-US");
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function pct(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(2)}%`;
}

export default async function CreativePerformancePage() {
  const [creatives, links, jobs] = await Promise.all([
    listScoredCreatives(30),
    listCreativeLinks(),
    listRecentJobRuns(1),
  ]);

  const pendingReview = links.filter((link) => !link.confirmed).length;
  const lastRun = jobs[0];

  const tierCounts = creatives.reduce<Record<string, number>>((acc, row) => {
    acc[row.evidence_tier] = (acc[row.evidence_tier] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={sectionFor("intelligence")}
        title="Creative Performance"
        subtitle={
          creatives.length > 0 ? `${creatives.length} creatives` : undefined
        }
        description="What every ad actually did, over the last 30 days. Scores are ranked on a lower confidence bound rather than the raw rate, so a creative with a handful of impressions cannot top the list on luck."
        actions={<SyncButton />}
      />

      {lastRun && (
        <p className="text-xs text-muted-foreground">
          Last sync: {new Date(lastRun.started_at).toLocaleString("en-US")} ·{" "}
          {lastRun.status}
          {lastRun.error ? ` — ${lastRun.error}` : ""}
        </p>
      )}

      {pendingReview > 0 && (
        <DarkPanel
          title={`${pendingReview} link${pendingReview === 1 ? "" : "s"} awaiting review`}
          description="These ads were matched by image rather than by concept code, so they stay out of scoring until you confirm them."
          actions={
            <Link
              href="/dashboard/intelligence/attribution"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              <Link2 aria-hidden className="size-3.5" />
              Review links
            </Link>
          }
        />
      )}

      {creatives.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No performance data yet"
          description="Run a sync to pull the last 28 days from your connected Meta account. Ads named with a concept code link to their concept automatically."
          action={<SyncButton />}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(
              ["confident", "directional", "insufficient"] as EvidenceTier[]
            ).map((tier) =>
              tierCounts[tier] ? (
                <div key={tier} className="flex items-center gap-1.5">
                  <EvidenceBadge tier={tier} />
                  <span className="text-xs text-muted-foreground">
                    {tierCounts[tier]}
                  </span>
                </div>
              ) : null,
            )}
          </div>

          <DarkPanel
            title="Ranked creatives"
            description="Best first. The evidence tier says how much the ordering is worth."
            contentClassName="overflow-x-auto"
          >
            <table className="w-full min-w-3xl text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                  <th className="pb-2 font-semibold">Creative</th>
                  <th className="pb-2 font-semibold">Score</th>
                  <th className="pb-2 font-semibold">Evidence</th>
                  <th className="pb-2 text-right font-semibold">Impressions</th>
                  <th className="pb-2 text-right font-semibold">CTR</th>
                  <th className="pb-2 text-right font-semibold">Supported</th>
                  <th className="pb-2 text-right font-semibold">Spend</th>
                  <th className="pb-2 text-right font-semibold">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {creatives.map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="py-2 pr-3">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {row.concept_headline ?? row.ad_name ?? "Unnamed ad"}
                        </span>
                        {row.concept_id === null && (
                          <span className="text-xs text-muted-foreground">
                            Not linked to a concept
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.composite_score ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <EvidenceBadge tier={row.evidence_tier as EvidenceTier} />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {nf.format(Number(row.impressions))}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {pct(row.ctr === null ? null : Number(row.ctr))}
                    </td>
                    {/* The number ranking actually uses. Showing it beside the
                        observed CTR is the clearest way to make the discount
                        for a small sample visible rather than mysterious. */}
                    <td className="py-2 pr-3 text-right text-muted-foreground tabular-nums">
                      {pct(
                        row.ctr_lower_bound === null
                          ? null
                          : Number(row.ctr_lower_bound),
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {money.format(Number(row.spend))}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {row.roas === null
                        ? "—"
                        : `${Number(row.roas).toFixed(2)}×`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DarkPanel>

          <DarkPanel
            title="How to read this"
            contentClassName="flex flex-col gap-2 text-sm text-muted-foreground"
          >
            {creatives[0]?.primary_metric && (
              <p className="flex flex-wrap items-center gap-2">
                <PrimaryMetricBadge
                  metric={creatives[0].primary_metric as PrimaryMetric}
                />
                <span>
                  {
                    METRIC_EXPLANATIONS[
                      creatives[0].primary_metric as PrimaryMetric
                    ]
                  }
                </span>
              </p>
            )}
            {(
              ["confident", "directional", "insufficient"] as EvidenceTier[]
            ).map((tier) => (
              <p key={tier} className="flex flex-wrap items-center gap-2">
                <EvidenceBadge tier={tier} />
                <span>{TIER_EXPLANATIONS[tier]}</span>
              </p>
            ))}
            <p className="flex flex-wrap items-center gap-2">
              <StatusBadge label="Supported" tone="muted" />
              <span>
                The rate the data can actually support, not the one it happened
                to observe. Ranking uses this column.
              </span>
            </p>
          </DarkPanel>
        </>
      )}
    </div>
  );
}
