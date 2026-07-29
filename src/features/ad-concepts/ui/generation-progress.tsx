"use client";

import { useEffect, useState } from "react";

/**
 * What is happening during the ~90 seconds a generation takes.
 *
 * Before this, the only feedback was a button reading "Generating…", which is
 * indistinguishable from a hung request — and the two places that rendered it
 * disagreed about how long to expect ("up to a minute" against "up to 2 min",
 * the first of which was simply wrong).
 *
 * The phases shown are real: the pipeline writes each status transition as it
 * reaches it, so this reports progress rather than animating reassurance. The
 * elapsed counter runs locally so the display keeps moving between polls.
 *
 * Polls a route handler rather than a Server Action: Next.js runs a client's
 * Server Actions one at a time, so a poll fired during a 90 second generation
 * would not run until that generation had already finished.
 */

const PHASE_TEXT: Record<string, string> = {
  generating: "Generating the image",
  generated: "Image ready — reviewing it",
  qa_in_progress: "Reviewing against your brand assets",
  approved: "Approved",
  needs_review: "Finished — needs review",
  failed: "Failed",
};

/** Long enough not to hammer the database, short enough to feel live. */
const POLL_MS = 3000;

function ActiveProgress({ conceptId }: { conceptId: string }) {
  const [phase, setPhase] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const tick = setInterval(
      () => setElapsed(Math.round((Date.now() - startedAt) / 1000)),
      1000,
    );

    const controller = new AbortController();
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/generation-progress?conceptId=${encodeURIComponent(conceptId)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) return;
        const progress = (await response.json()) as { status: string } | null;
        if (!cancelled && progress?.status) setPhase(progress.status);
      } catch {
        // An aborted or failed poll leaves the last known phase in place; the
        // elapsed counter keeps running either way.
      }
    };

    void poll();
    const polling = setInterval(poll, POLL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(tick);
      clearInterval(polling);
    };
  }, [conceptId]);

  const label = phase ? (PHASE_TEXT[phase] ?? "Working") : "Starting";

  return (
    <div
      className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-2.5 py-1.5"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className="size-2 shrink-0 animate-pulse rounded-full bg-primary"
      />
      <span className="text-xs">{label}</span>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
        {elapsed}s
      </span>
      {elapsed < 5 && (
        <span className="text-xs text-muted-foreground">· usually 60–120s</span>
      )}
    </div>
  );
}

/**
 * Mounts the polling component only while a run is in flight, rather than
 * keeping it mounted and resetting its state. Mounting gives fresh state for
 * free and unmounting stops the timers, with no state written from an effect.
 */
export function GenerationProgress({
  conceptId,
  active,
}: {
  conceptId: string;
  active: boolean;
}) {
  if (!active) return null;
  return <ActiveProgress conceptId={conceptId} />;
}
