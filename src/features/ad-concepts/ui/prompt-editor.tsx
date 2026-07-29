"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/data/status-badge";
import { DarkPanel } from "@/components/layout/dark-panel";
import {
  resetGenerationPromptAction,
  saveGenerationPromptAction,
} from "@/features/ad-concepts/application/save-generation-prompt";
import { generateCreativeImageAction } from "@/features/ad-concepts/application/generate-creative-image";
import { initialActionState } from "@/features/ad-concepts/application/types";
import { GenerationProgress } from "@/features/ad-concepts/ui/generation-progress";

export function PromptEditor({
  conceptId,
  prompt,
  isEdited,
}: {
  conceptId: string;
  /** The prompt generation will actually use: the edit if there is one. */
  prompt: string;
  isEdited: boolean;
}) {
  const [saveState, saveAction, isSaving] = useActionState(
    saveGenerationPromptAction.bind(null, conceptId),
    initialActionState,
  );
  const [resetState, resetAction, isResetting] = useActionState(
    resetGenerationPromptAction.bind(null, conceptId),
    initialActionState,
  );
  const [generateState, generateAction, isGenerating] = useActionState(
    generateCreativeImageAction.bind(null, conceptId),
    initialActionState,
  );

  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The server is the source of truth after a save or reset, so the box is
  // re-synced from props rather than holding its own edited copy.
  useEffect(() => {
    if (textareaRef.current) textareaRef.current.value = prompt;
  }, [prompt]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const busy = isSaving || isResetting || isGenerating;

  const errorMessage =
    (saveState.status === "error" && saveState.message) ||
    (resetState.status === "error" && resetState.message) ||
    (generateState.status === "error" && generateState.message) ||
    null;

  const successMessage =
    (saveState.status === "success" && saveState.message) ||
    (resetState.status === "success" && resetState.message) ||
    null;

  return (
    <DarkPanel
      title="Scene description"
      // Says what this text is, and what it is not. It is one section of the
      // final prompt: the brand context, the English-only rule and the
      // promotional message wording are appended at generation time and are
      // not editable here, so calling this "the prompt" overstated it.
      description={
        isEdited
          ? "Edited by hand — generation uses this text, plus your brand rules."
          : "As written by the concept generator, plus your brand rules at generation time."
      }
      actions={
        isEdited ? (
          <StatusBadge label="Edited" tone="accent" />
        ) : (
          <StatusBadge label="Original" tone="muted" />
        )
      }
      contentClassName="flex flex-col gap-3"
    >
      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <p className="text-sm text-success">{successMessage}</p>
      )}
      {generateState.status === "success" && (
        <p className="text-sm text-success">
          Image generated. It appears under Latest image.
        </p>
      )}

      <form action={saveAction} className="flex flex-col gap-3">
        <Textarea
          ref={textareaRef}
          name="prompt"
          defaultValue={prompt}
          rows={14}
          spellCheck={false}
          disabled={busy}
          className="font-mono text-[13px] leading-relaxed"
          aria-invalid={Boolean(saveState.fieldErrors?.prompt)}
        />
        {saveState.fieldErrors?.prompt && (
          <p className="text-sm text-destructive">
            {saveState.fieldErrors.prompt[0]}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={busy}>
            {isSaving ? "Saving…" : "Save prompt"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              navigator.clipboard
                .writeText(textareaRef.current?.value ?? prompt)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            {copied ? (
              <>
                <Check aria-hidden className="size-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy aria-hidden className="size-3.5" /> Copy
              </>
            )}
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {/* Separate forms: reset and generate are their own actions, and
            nesting forms is invalid HTML. */}
        {isEdited && (
          <form action={resetAction}>
            <Button type="submit" size="sm" variant="outline" disabled={busy}>
              {isResetting ? "Resetting…" : "Reset to original"}
            </Button>
          </form>
        )}

        <form action={generateAction}>
          <Button type="submit" size="sm" disabled={busy}>
            {isGenerating ? "Generating…" : "Generate image"}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground">
          Generates from the saved prompt — save first if you have unsaved
          edits.
        </p>
      </div>

      <GenerationProgress conceptId={conceptId} active={isGenerating} />
    </DarkPanel>
  );
}
