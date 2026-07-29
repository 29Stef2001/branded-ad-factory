"use client";

import { useState } from "react";
import { Check, Copy, Lock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DarkPanel } from "@/components/layout/dark-panel";
import { StatusBadge } from "@/components/data/status-badge";
import {
  assemblePrompt,
  type PromptSection,
} from "@/features/ad-concepts/domain/image-prompt";

/**
 * The prompt image generation actually sends, section by section.
 *
 * The page used to show only the concept scene while five further sections
 * were appended out of sight — including the rules the user most wants to
 * verify, like English-only output and who the founder is. Labelling each
 * block and marking which one is editable makes the split visible instead of
 * something to take on trust.
 *
 * The sections arrive already assembled from the domain builder, so this shows
 * the same text generation uses rather than a second reconstruction of it.
 */
export function AssembledPrompt({ sections }: { sections: PromptSection[] }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const fullPrompt = assemblePrompt(sections);

  return (
    <DarkPanel
      title="Final assembled prompt"
      description="Everything above, combined as the image model receives it. Only the concept instructions are editable — the rest is built from your Brand Profile at generation time."
      actions={
        <div className="flex items-center gap-2">
          <StatusBadge
            label={`${fullPrompt.length.toLocaleString()} chars`}
            tone="muted"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard
                .writeText(fullPrompt)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? (
              <>
                <Check aria-hidden className="size-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy aria-hidden className="size-3.5" /> Copy all
              </>
            )}
          </Button>
        </div>
      }
      contentClassName="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-2.5">
        {sections.map((section) => (
          <section
            key={section.key}
            className="rounded-md border border-border bg-background/40 p-2.5"
          >
            <div className="mb-1.5 flex items-center gap-2">
              {section.editable ? (
                <Pencil aria-hidden className="size-3 text-primary" />
              ) : (
                <Lock aria-hidden className="size-3 text-muted-foreground" />
              )}
              <span className="text-[10px] font-semibold tracking-[0.12em] uppercase">
                {section.label}
              </span>
              <StatusBadge
                label={section.editable ? "You edit this" : "Auto-added"}
                tone={section.editable ? "accent" : "muted"}
              />
            </div>
            <p
              className={
                expanded
                  ? "font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-muted-foreground"
                  : "line-clamp-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-muted-foreground"
              }
            >
              {section.text}
            </p>
          </section>
        ))}
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Collapse sections" : "Show full text"}
      </Button>
    </DarkPanel>
  );
}
