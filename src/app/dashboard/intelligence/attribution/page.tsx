import type { Metadata } from "next";
import { Link2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { sectionFor } from "@/components/shell/nav-config";
import { DarkPanel } from "@/components/layout/dark-panel";
import { EmptyState } from "@/components/layout/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { LinkReviewRow } from "@/features/creative-intelligence/ui/link-review-row";
import { SyncButton } from "@/features/creative-intelligence/ui/sync-button";
import {
  listAdEntities,
  listCreativeLinks,
} from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";
import { listConceptSummaries } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { META_STATUS_LABELS } from "@/features/creative-intelligence/domain/attribution";
import { labelFor } from "@/features/ad-concepts/domain/labels";

export const metadata: Metadata = {
  title: "Attribution — Branded Ad Factory",
};

export default async function AttributionPage() {
  const [ads, links, concepts] = await Promise.all([
    listAdEntities(),
    listCreativeLinks(),
    listConceptSummaries(),
  ]);

  const conceptById = new Map(concepts.map((c) => [c.id, c]));
  const adById = new Map(ads.map((ad) => [ad.id, ad]));

  const pending = links.filter((link) => !link.confirmed);
  const confirmed = links.filter((link) => link.confirmed);
  const linkedEntityIds = new Set(links.map((link) => link.meta_entity_id));
  const unmatched = ads.filter((ad) => !linkedEntityIds.has(ad.id));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={sectionFor("intelligence/attribution")}
        title="Attribution"
        subtitle={`${confirmed.length} of ${ads.length} ads linked`}
        description="Which Meta ad came from which concept. Only confirmed links feed scoring — a wrong link teaches the model a false lesson with full confidence, which is worse than no link at all."
        actions={<SyncButton />}
      />

      <DarkPanel
        title="How linking works"
        contentClassName="flex flex-col gap-2 text-sm text-muted-foreground"
      >
        <p>
          Every concept has a code like{" "}
          <code className="text-foreground">CS-ABC234</code>, shown on its card.
          Put that code anywhere in the Meta ad&apos;s name and the link is
          exact and automatic — no review needed.
        </p>
        <p>
          Ads without a code are matched by comparing the image, which is
          approximate: Meta re-encodes what it serves, so an identical picture
          does not produce an identical hash. Those matches are proposed here
          and wait for you.
        </p>
      </DarkPanel>

      {pending.length > 0 && (
        <DarkPanel
          title="Awaiting your confirmation"
          description={`${pending.length} proposed by image. These stay out of scoring until confirmed.`}
          contentClassName="flex flex-col gap-2"
        >
          {pending.map((link) => {
            const ad = adById.get(link.meta_entity_id);
            const concept = conceptById.get(link.concept_id);
            if (!ad || !concept) return null;

            return (
              <LinkReviewRow
                key={link.id}
                linkId={link.id}
                adName={ad.name}
                conceptHeadline={concept.headline}
                matchMethod={link.match_method}
                confidence={Number(link.match_confidence)}
                thumbnailUrl={ad.thumbnail_url}
              />
            );
          })}
        </DarkPanel>
      )}

      {unmatched.length > 0 && (
        <DarkPanel
          title={`${unmatched.length} unmatched ad${unmatched.length === 1 ? "" : "s"}`}
          description="No concept code in the name and no close image match. Rename the ad in Ads Manager to include its concept code, then sync again."
          contentClassName="flex flex-col gap-1.5"
        >
          {unmatched.map((ad) => (
            <div
              key={ad.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span>{ad.name}</span>
              <StatusBadge
                label={labelFor(
                  META_STATUS_LABELS,
                  ad.effective_status ?? "unknown",
                )}
                tone={ad.effective_status === "ACTIVE" ? "success" : "muted"}
              />
            </div>
          ))}
        </DarkPanel>
      )}

      {confirmed.length > 0 && (
        <DarkPanel
          title="Linked"
          description={`${confirmed.length} ad${confirmed.length === 1 ? "" : "s"} feeding scoring.`}
          contentClassName="flex flex-col gap-1.5"
        >
          {confirmed.map((link) => {
            const ad = adById.get(link.meta_entity_id);
            const concept = conceptById.get(link.concept_id);
            if (!ad || !concept) return null;

            return (
              <div
                key={link.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span>{ad.name}</span>
                  <span className="text-xs text-muted-foreground">
                    → {concept.headline}
                  </span>
                </div>
                <StatusBadge
                  label={
                    link.match_method === "concept_code"
                      ? "Concept code"
                      : link.match_method === "manual"
                        ? "Manual"
                        : "Image match"
                  }
                  tone={
                    link.match_method === "concept_code" ? "success" : "neutral"
                  }
                />
              </div>
            );
          })}
        </DarkPanel>
      )}

      {ads.length === 0 && (
        <EmptyState
          icon={Link2}
          title="No Meta ads found yet"
          description="Run a sync to mirror your ad account. Ads appear here as soon as they exist in Meta, whether or not they came from this app."
          action={<SyncButton />}
        />
      )}
    </div>
  );
}
