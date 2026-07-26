import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdCard } from "@/features/competitor-analysis/ui/ad-card";
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
          Meta Page ID: {competitor.meta_page_id}
        </p>
      </div>

      {ads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No ads found for this Page. They may not currently be running ads in
          the Meta Ad Library.
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
