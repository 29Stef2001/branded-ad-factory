import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdCard } from "@/features/competitor-analysis/ui/ad-card";
import { RefreshAdsButton } from "@/features/competitor-analysis/ui/refresh-ads-button";
import {
  getCompetitor,
  listAdsWithAnalysis,
} from "@/features/competitor-analysis/infrastructure/competitor-repository";

export const metadata: Metadata = {
  title: "Competitor ads — Branded Ad Factory",
};

export default async function CompetitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const competitor = await getCompetitor(id);

  if (!competitor) {
    notFound();
  }

  const ads = await listAdsWithAnalysis(id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/competitors"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Competitors
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {competitor.name}
          </h1>
          <p className="text-muted-foreground">
            {competitor.meta_page_id
              ? `Meta Page ID: ${competitor.meta_page_id}`
              : (competitor.website_url ?? "No identifier on file")}
          </p>
        </div>
        <RefreshAdsButton competitorId={competitor.id} />
      </div>

      {ads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No ads recorded for this competitor yet. The Meta Ad Library API only
          covers ads that reached the EU or are about social issues, elections
          or politics, so most ordinary advertisers return nothing there — ads
          found by research are submitted separately.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {ads.map((ad) => (
            <AdCard key={ad.id} ad={ad} />
          ))}
        </div>
      )}
    </div>
  );
}
