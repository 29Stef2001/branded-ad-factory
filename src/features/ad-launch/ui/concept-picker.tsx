"use client";

import { useState, useTransition } from "react";
import { Check, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/status-badge";
import { listLaunchableConceptsAction } from "@/features/ad-launch/application/launch-batch";
import type { ImageEntry } from "@/features/ad-launch/ui/image-list";

type Concept = {
  id: string;
  headline: string;
  bodyCopy: string;
  conceptCode: string | null;
  imageUrl: string;
  qaPassed: boolean;
};

/**
 * Loads generated creatives straight into the batch.
 *
 * The alternative is copy-paste between two screens, which is not just work:
 * retyped wording drifts from what QA actually approved, and the concept code
 * — the thing that links this ad's performance back to the concept — is
 * exactly what gets forgotten.
 *
 * Each concept keeps its own headline and body as a per-ad override, since
 * every concept was written for its own picture.
 */
export function ConceptPicker({
  onAdd,
}: {
  onAdd: (entries: ImageEntry[], code: string | null) => void;
}) {
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      const result = await listLaunchableConceptsAction();
      setConcepts(result.concepts);
      setError(result.error);
    });

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosen = (concepts ?? []).filter((concept) => selected.has(concept.id));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium">Use a generated creative</span>
          <span className="text-xs text-muted-foreground">
            Brings the image and its approved copy across, so nothing is
            retyped.
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={load}
        >
          <Sparkles aria-hidden className="size-3.5" />
          {pending ? "Loading…" : concepts ? "Refresh" : "Load concepts"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {concepts?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No generated creatives with an image yet. Generate some under Workflow
          → Concepts first.
        </p>
      )}

      {concepts && concepts.length > 0 && (
        <>
          <div className="flex flex-col gap-1.5">
            {concepts.map((concept) => {
              const isSelected = selected.has(concept.id);
              return (
                <button
                  key={concept.id}
                  type="button"
                  onClick={() => toggle(concept.id)}
                  className={`flex items-center gap-2 rounded-md border p-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "border-primary/50 bg-primary/10"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    {isSelected && (
                      <Check aria-hidden className="size-3.5 text-primary" />
                    )}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL */}
                  <img
                    src={concept.imageUrl}
                    alt=""
                    className="size-12 shrink-0 rounded object-cover ring-1 ring-foreground/10"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {concept.headline}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {concept.conceptCode ?? "no code"}
                    </span>
                  </span>
                  <StatusBadge
                    label={concept.qaPassed ? "QA passed" : "Needs review"}
                    tone={concept.qaPassed ? "success" : "warning"}
                  />
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            size="sm"
            disabled={chosen.length === 0}
            onClick={() => {
              onAdd(
                chosen.map((concept) => ({
                  id: crypto.randomUUID(),
                  url: concept.imageUrl,
                  // Each concept was written for its own picture, so its words
                  // travel with it rather than being flattened into one block.
                  overrideHeadline: concept.headline,
                  overridePrimaryText: concept.bodyCopy,
                })),
                chosen[0]?.conceptCode ?? null,
              );
              setSelected(new Set());
            }}
          >
            Add {chosen.length || ""} creative{chosen.length === 1 ? "" : "s"}
          </Button>
        </>
      )}
    </div>
  );
}
