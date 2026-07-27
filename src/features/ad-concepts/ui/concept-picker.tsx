"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import type { ConceptSummary } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

/**
 * Selection lives in the URL rather than component state, so a chosen concept
 * survives reload, can be linked to, and lets the page stay server-rendered.
 */
export function ConceptPicker({ concepts }: { concepts: ConceptSummary[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("concept") ?? "";

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="concept-picker" className="text-xs">
        Concept
      </Label>
      <select
        id="concept-picker"
        value={selected}
        onChange={(event) => {
          const id = event.target.value;
          router.push(
            id
              ? `/dashboard/creative-studio/prompt-builder?concept=${id}`
              : "/dashboard/creative-studio/prompt-builder",
          );
        }}
        className="w-full max-w-xl rounded-md border border-input bg-card px-2.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <option value="">Select a concept…</option>
        {concepts.map((concept) => (
          <option key={concept.id} value={concept.id}>
            {concept.headline}
            {concept.strategy_type ? ` — ${concept.strategy_type}` : ""}
            {concept.generation_status ? ` (${concept.generation_status})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
