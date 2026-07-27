import { DarkPanel } from "@/components/layout/dark-panel";
import { StatusBadge, type StatusTone } from "@/components/data/status-badge";
import type { CreativeGenerationRow } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

const STATUS_TONE: Record<string, StatusTone> = {
  queued: "muted",
  generating: "accent",
  generated: "success",
  qa_in_progress: "accent",
  qa_failed: "warning",
  retrying: "warning",
  needs_review: "warning",
  approved: "success",
  rejected: "danger",
  ready_for_publishing: "success",
  published: "success",
  failed: "danger",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function GenerationHistory({
  attempts,
  imageUrl,
}: {
  attempts: CreativeGenerationRow[];
  /**
   * Regeneration overwrites one object per concept, so every attempt that
   * produced an image points at the same path. There is one current image, not
   * one per attempt — the preview is labelled accordingly.
   */
  imageUrl: string | null;
}) {
  return (
    <DarkPanel
      title="Generation history"
      description={
        attempts.length === 0
          ? "No attempts yet"
          : `${attempts.length} ${attempts.length === 1 ? "attempt" : "attempts"}`
      }
      contentClassName="flex flex-col gap-2"
    >
      {attempts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing has been generated for this concept yet. Attempts appear here
          as soon as one runs, successful or not.
        </p>
      )}

      {[...attempts]
        .sort((a, b) => b.attempt_number - a.attempt_number)
        .map((attempt) => {
          const isLatestSuccess =
            attempt.status === "generated" && attempt.image_path !== null;

          return (
            <div
              key={attempt.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-background/40 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  Attempt {attempt.attempt_number}
                </span>
                <StatusBadge
                  label={attempt.status.replace(/_/g, " ")}
                  tone={STATUS_TONE[attempt.status] ?? "neutral"}
                />
                {attempt.qa_passed !== null && (
                  <StatusBadge
                    label={attempt.qa_passed ? "QA passed" : "QA failed"}
                    tone={attempt.qa_passed ? "success" : "warning"}
                  />
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatTime(attempt.created_at)}
                </span>
              </div>

              {attempt.selected_reference_roles.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  References:{" "}
                  {attempt.selected_reference_roles
                    .map((role) => role.replace(/_/g, " "))
                    .join(", ")}
                </p>
              )}

              {attempt.failure_reason && (
                <p className="rounded border border-destructive/30 bg-destructive/10 px-2 py-1 font-mono text-xs break-words text-destructive">
                  {attempt.failure_reason}
                </p>
              )}

              {attempt.qa_notes && (
                <p className="text-xs text-muted-foreground">
                  QA: {attempt.qa_notes}
                </p>
              )}

              {isLatestSuccess && imageUrl && (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL */}
                  <img
                    src={imageUrl}
                    alt={`Attempt ${attempt.attempt_number} result`}
                    className="size-20 rounded-md object-cover ring-1 ring-foreground/10"
                  />
                  <span className="text-xs text-muted-foreground">
                    Current stored image
                  </span>
                </div>
              )}
            </div>
          );
        })}
    </DarkPanel>
  );
}
