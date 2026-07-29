import { ImageOff } from "lucide-react";
import { DarkPanel } from "@/components/layout/dark-panel";
import { StatusBadge } from "@/components/data/status-badge";
import {
  ASSET_ROLE_LABELS,
  labelFor,
} from "@/features/ad-concepts/domain/labels";
import type { BrandAssetWithUrl } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export type ResolvedReference = {
  role: string;
  asset: BrandAssetWithUrl | null;
  /** Set when the concept asked for this type but no usable asset exists. */
  missing?: boolean;
};

/**
 * What generation would actually attach, resolved with the same
 * selectReferenceAssets() the action uses — not a re-implementation, so this
 * cannot drift from what really gets sent.
 */
export function ReferenceAssetsPanel({
  references,
  overflowNotes,
  unknownRequirements,
}: {
  references: ResolvedReference[];
  overflowNotes: string[];
  /** Requirement strings the model invented that match no known asset type. */
  unknownRequirements: string[];
}) {
  return (
    <DarkPanel
      title="Reference images"
      description={
        references.length === 0
          ? "None would be attached"
          : `${references.filter((r) => !r.missing).length} would be attached`
      }
      contentClassName="flex flex-col gap-2"
    >
      {references.length === 0 && (
        <p className="text-sm text-muted-foreground">
          This concept requires no brand assets, so generation runs from the
          prompt text alone.
        </p>
      )}

      {references.map((reference) => (
        <div
          key={`${reference.role}-${reference.asset?.id ?? "none"}`}
          className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-2.5"
        >
          {reference.asset?.displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL or external asset
            <img
              src={reference.asset.displayUrl}
              alt={reference.asset.label ?? reference.role}
              className="size-12 shrink-0 rounded object-cover ring-1 ring-foreground/10"
            />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground ring-1 ring-foreground/10">
              <ImageOff aria-hidden className="size-4" />
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {labelFor(ASSET_ROLE_LABELS, reference.role) || reference.role}
              </span>
              {reference.asset?.is_primary && (
                <StatusBadge label="Primary" tone="accent" />
              )}
              {reference.missing && (
                <StatusBadge label="No asset available" tone="warning" />
              )}
            </div>
            <span className="truncate text-xs text-muted-foreground">
              {reference.missing
                ? "Requested by the concept, but nothing of this type is uploaded."
                : (reference.asset?.label ??
                  (reference.role === "logo"
                    ? "From the brand profile logo URL"
                    : "Untitled"))}
            </span>
          </div>
        </div>
      ))}

      {overflowNotes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Beyond the three-image limit, described in the prompt instead:{" "}
          {overflowNotes.join("; ")}.
        </p>
      )}

      {unknownRequirements.length > 0 && (
        <p className="text-xs text-warning">
          Ignored, not a known asset type: {unknownRequirements.join(", ")}.
        </p>
      )}
    </DarkPanel>
  );
}
