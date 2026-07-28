import type { Metadata } from "next";
import { Suspense } from "react";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DarkPanel } from "@/components/layout/dark-panel";
import { EmptyState } from "@/components/layout/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { ConceptPicker } from "@/features/ad-concepts/ui/concept-picker";
import { PromptEditor } from "@/features/ad-concepts/ui/prompt-editor";
import { GenerationHistory } from "@/features/ad-concepts/ui/generation-history";
import {
  ReferenceAssetsPanel,
  type ResolvedReference,
} from "@/features/ad-concepts/ui/reference-assets-panel";
import {
  brandAssetTypeEnum,
  type BrandAssetType,
} from "@/features/ad-concepts/domain/schemas";
import {
  GENERATION_STATUS_LABELS,
  GENERATION_STATUS_TONES,
  STRATEGY_LABELS,
  labelFor,
} from "@/features/ad-concepts/domain/labels";
import { selectReferenceAssets } from "@/features/ad-concepts/domain/asset-selection";
import {
  getBrandProfile,
  getConceptPromptDetail,
  getSignedImageUrls,
  listBrandAssetsWithUrls,
  listConceptSummaries,
  listGenerationsForConcept,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export const metadata: Metadata = {
  title: "Prompt Builder — Branded Ad Factory",
};

// Generation runs from this page too, and takes up to ~90s with references.
export const maxDuration = 300;

export default async function PromptBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ concept?: string }>;
}) {
  const { concept: conceptId } = await searchParams;
  const concepts = await listConceptSummaries();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Creative Studio"
        title="Prompt Builder"
        subtitle={`${concepts.length} concepts`}
        description="Inspect and edit the prompt image generation actually uses, and see which brand assets would be attached alongside it."
      />

      <Suspense fallback={null}>
        <ConceptPicker concepts={concepts} />
      </Suspense>

      {!conceptId ? (
        <EmptyState
          icon={FileText}
          title="Select a concept"
          description={
            concepts.length === 0
              ? "No concepts exist yet. Generate some on the Concepts page first."
              : "Pick a concept above to inspect and edit its generation prompt."
          }
        />
      ) : (
        <ConceptDetail conceptId={conceptId} />
      )}
    </div>
  );
}

async function ConceptDetail({ conceptId }: { conceptId: string }) {
  const [detail, brandAssets, attempts, brandProfile] = await Promise.all([
    getConceptPromptDetail(conceptId),
    listBrandAssetsWithUrls(),
    listGenerationsForConcept(conceptId),
    getBrandProfile(),
  ]);

  if (!detail) {
    return (
      <EmptyState
        title="Concept not found"
        description="It may have been deleted. Pick another from the list above."
      />
    );
  }

  const imageUrls = detail.creative_image_path
    ? await getSignedImageUrls([detail.creative_image_path])
    : new Map<string, string>();
  const currentImageUrl = detail.creative_image_path
    ? (imageUrls.get(detail.creative_image_path) ?? null)
    : null;

  // Same split the generation action performs, so what is shown is what would
  // actually be sent rather than an approximation of it.
  const requirements: BrandAssetType[] = [];
  const unknownRequirements: string[] = [];
  for (const value of detail.brand_asset_requirements ?? []) {
    if (brandAssetTypeEnum.safeParse(value).success) {
      requirements.push(value as BrandAssetType);
    } else {
      unknownRequirements.push(value);
    }
  }

  const primaryLogo =
    brandAssets.find(
      (asset) =>
        asset.asset_type === "logo" && asset.is_active && asset.is_primary,
    ) ??
    brandAssets.find(
      (asset) => asset.asset_type === "logo" && asset.is_active,
    ) ??
    null;

  const hasLogo = Boolean(primaryLogo ?? brandProfile?.logo_image_url);

  const selection = selectReferenceAssets(
    requirements,
    brandAssets,
    false,
    hasLogo,
  );

  const references: ResolvedReference[] = selection.selected.map((entry) => ({
    role: entry.role,
    asset: entry.role === "logo" ? primaryLogo : (entry.asset ?? null),
  }));

  // Requirements the concept asked for that produced no reference at all.
  const satisfied = new Set(references.map((reference) => reference.role));
  for (const requirement of requirements) {
    if (requirement !== "logo" && !satisfied.has(requirement)) {
      references.push({ role: requirement, asset: null, missing: true });
    }
  }

  const activePrompt =
    detail.generation_prompt_override ??
    detail.final_generation_prompt ??
    detail.visual_direction;

  const structured = detail.structured_concept ?? {};

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-4">
        <DarkPanel
          title={detail.headline}
          description={detail.campaign_angle ?? undefined}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {detail.strategy_type && (
                <StatusBadge
                  label={labelFor(STRATEGY_LABELS, detail.strategy_type)}
                  tone="neutral"
                />
              )}
              {detail.generation_status && (
                <StatusBadge
                  label={labelFor(
                    GENERATION_STATUS_LABELS,
                    detail.generation_status,
                  )}
                  tone={
                    GENERATION_STATUS_TONES[detail.generation_status] ?? "muted"
                  }
                />
              )}
            </div>
          }
        >
          <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Promotional message</dt>
            <dd>
              {detail.promotional_message?.message ?? (
                <span className="text-muted-foreground">
                  None linked — the concept did not match an approved message.
                </span>
              )}
            </dd>
            <dt className="text-muted-foreground">Asset requirements</dt>
            <dd>
              {(detail.brand_asset_requirements ?? []).join(", ") || (
                <span className="text-muted-foreground">None</span>
              )}
            </dd>
          </dl>
        </DarkPanel>

        <PromptEditor
          conceptId={detail.id}
          prompt={activePrompt}
          isEdited={detail.generation_prompt_override !== null}
        />

        {Object.keys(structured).length > 0 && (
          <DarkPanel
            title="Structured concept"
            description="The fields the prompt was built from."
            contentClassName="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]"
          >
            {Object.entries(structured).map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">
                  {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                </dt>
                <dd className="break-words">
                  {Array.isArray(value)
                    ? value.join(", ")
                    : String(value ?? "")}
                </dd>
              </div>
            ))}
          </DarkPanel>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <ReferenceAssetsPanel
          references={references}
          overflowNotes={selection.overflowNotes}
          unknownRequirements={unknownRequirements}
        />

        <DarkPanel title="Latest image">
          {currentImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
            <img
              src={currentImageUrl}
              alt={detail.headline}
              className="w-full rounded-md object-cover ring-1 ring-foreground/10"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing generated for this concept yet.
            </p>
          )}
        </DarkPanel>

        <GenerationHistory attempts={attempts} imageUrl={currentImageUrl} />
      </div>
    </div>
  );
}
