"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmButton } from "@/components/data/confirm-button";
import { DarkPanel } from "@/components/layout/dark-panel";
import {
  GENERATION_STATUS_LABELS,
  GENERATION_STATUS_TONES,
  STRATEGY_LABELS,
  labelFor,
} from "@/features/ad-concepts/domain/labels";
import { deleteConceptAction } from "@/features/ad-concepts/application/delete-concept";
import { initialActionState } from "@/features/ad-concepts/application/types";
import { GenerateCreativeImageForm } from "@/features/ad-concepts/ui/generate-creative-image-form";
import { RefineConceptForm } from "@/features/ad-concepts/ui/refine-concept-form";
import type { ConceptRow } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export function ConceptCard({
  concept,
  imageUrl,
}: {
  concept: ConceptRow;
  imageUrl?: string;
}) {
  // Collapsed by default: fifteen concepts each showing full copy plus two
  // forms made the page nine screens long and impossible to scan.
  const [expanded, setExpanded] = useState(false);

  const [deleteState, deleteAction, isDeleting] = useActionState(
    deleteConceptAction.bind(null, concept.id),
    initialActionState,
  );

  const inspiredByName = concept.competitor_ads?.competitors?.name;
  const refinedFromHeadline = concept.original?.headline;
  const status = concept.generation_status;

  return (
    <DarkPanel
      title={concept.headline}
      description={concept.hook}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {concept.strategy_type && (
            <StatusBadge
              label={labelFor(STRATEGY_LABELS, concept.strategy_type)}
              tone="neutral"
            />
          )}
          {status && (
            <StatusBadge
              label={labelFor(GENERATION_STATUS_LABELS, status)}
              tone={GENERATION_STATUS_TONES[status] ?? "muted"}
            />
          )}
        </div>
      }
      contentClassName="flex flex-col gap-3"
    >
      {deleteState.status === "error" && deleteState.message && (
        <Alert variant="destructive">
          <AlertDescription>{deleteState.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
          <img
            src={imageUrl}
            alt={concept.headline}
            className="size-24 shrink-0 rounded-md object-cover ring-1 ring-foreground/10"
          />
        ) : (
          <div className="flex size-24 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-center text-[10px] text-muted-foreground">
            No image yet
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          {concept.promotional_message?.message && (
            <p className="text-xs">
              <span className="text-muted-foreground">Message: </span>
              {concept.promotional_message.message}
            </p>
          )}
          <p className="line-clamp-3 text-muted-foreground">
            {concept.body_copy}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Hide details" : "Details & actions"}
        </Button>
        <Link
          href={`/dashboard/creative-studio/prompt-builder?concept=${concept.id}`}
          className={buttonVariants({ size: "sm", variant: "ghost" })}
        >
          Open in Prompt Builder
        </Link>
        <div className="ml-auto">
          <ConfirmButton
            action={deleteAction}
            label="Delete"
            question="Delete this concept and its images?"
            confirmLabel="Yes, delete"
            pendingLabel="Deleting…"
            isPending={isDeleting}
          />
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border pt-3 text-sm">
          <p>{concept.body_copy}</p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">
              Visual direction:
            </span>{" "}
            {concept.visual_direction}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Call to action:</span>{" "}
            {concept.call_to_action}
          </p>
          {inspiredByName && (
            <p className="text-xs text-muted-foreground">
              Inspired by {inspiredByName}
            </p>
          )}
          {refinedFromHeadline && (
            <p className="text-xs text-muted-foreground">
              Refined from “{refinedFromHeadline}”
            </p>
          )}
          <RefineConceptForm conceptId={concept.id} />
          <GenerateCreativeImageForm
            conceptId={concept.id}
            hasImage={Boolean(imageUrl)}
            productImageUrl={concept.product_image_url}
          />
        </div>
      )}
    </DarkPanel>
  );
}
