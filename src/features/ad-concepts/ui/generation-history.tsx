import { DarkPanel } from "@/components/layout/dark-panel";
import { StatusBadge } from "@/components/data/status-badge";
import {
  GENERATION_STATUS_LABELS,
  GENERATION_STATUS_TONES,
  ASSET_ROLE_LABELS,
  labelFor,
} from "@/features/ad-concepts/domain/labels";
import type { CreativeGenerationRow } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

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
          const producedImage = attempt.image_path !== null;

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
                  label={labelFor(GENERATION_STATUS_LABELS, attempt.status)}
                  tone={GENERATION_STATUS_TONES[attempt.status] ?? "neutral"}
                />
                {attempt.qa_passed !== null && (
                  <StatusBadge
                    label={
                      attempt.qa_score !== null
                        ? `QA ${attempt.qa_passed ? "pass" : "fail"} · ${attempt.qa_score}/10`
                        : attempt.qa_passed
                          ? "QA pass"
                          : "QA fail"
                    }
                    tone={attempt.qa_passed ? "success" : "danger"}
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
                    .map((role) => labelFor(ASSET_ROLE_LABELS, role))
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

              {attempt.detected_issues.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {attempt.detected_issues.map((issue) => (
                    <li
                      key={issue}
                      className="flex gap-1.5 text-xs text-warning"
                    >
                      <span aria-hidden>•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              )}

              {attempt.qa_suggested_prompt && (
                <details className="rounded border border-border bg-background/60 px-2 py-1.5">
                  <summary className="cursor-pointer text-xs font-medium">
                    Suggested prompt fix
                  </summary>
                  <p className="mt-1.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {attempt.qa_suggested_prompt}
                  </p>
                </details>
              )}

              {attempt.reviewed_at && (
                <p className="text-[11px] text-muted-foreground/70">
                  Reviewed {formatTime(attempt.reviewed_at)}
                </p>
              )}

              {producedImage && imageUrl && (
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
