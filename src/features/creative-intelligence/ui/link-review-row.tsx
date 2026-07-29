"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/status-badge";
import {
  confirmLinkAction,
  rejectLinkAction,
} from "@/features/creative-intelligence/application/attribute-creatives";
import { initialActionState } from "@/features/ad-concepts/application/types";

/**
 * One proposed link, with both sides shown so the decision is a glance rather
 * than a guess. Confirming is what lets this creative's numbers reach scoring.
 */
export function LinkReviewRow({
  linkId,
  adName,
  conceptHeadline,
  matchMethod,
  confidence,
  thumbnailUrl,
}: {
  linkId: string;
  adName: string;
  conceptHeadline: string;
  matchMethod: string;
  confidence: number;
  thumbnailUrl: string | null;
}) {
  const [confirmState, confirm, isConfirming] = useActionState(
    confirmLinkAction.bind(null, linkId),
    initialActionState,
  );
  const [rejectState, reject, isRejecting] = useActionState(
    rejectLinkAction.bind(null, linkId),
    initialActionState,
  );

  const busy = isConfirming || isRejecting;
  const message = confirmState.message ?? rejectState.message;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
      {thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- external Meta CDN
        <img
          src={thumbnailUrl}
          alt=""
          className="size-14 shrink-0 rounded-md object-cover ring-1 ring-foreground/10"
        />
      )}

      <div className="flex min-w-48 flex-1 flex-col gap-0.5 text-sm">
        <span className="font-medium">{adName}</span>
        <span className="text-muted-foreground">→ {conceptHeadline}</span>
      </div>

      <StatusBadge
        label={
          matchMethod === "perceptual_hash"
            ? `Image match · ${Math.round(confidence * 100)}%`
            : matchMethod
        }
        tone="warning"
      />

      <div className="flex items-center gap-2">
        <form action={confirm}>
          <Button type="submit" size="sm" disabled={busy}>
            <Check aria-hidden className="size-3.5" />
            {isConfirming ? "Linking…" : "Confirm"}
          </Button>
        </form>
        <form action={reject}>
          <Button type="submit" size="sm" variant="outline" disabled={busy}>
            <X aria-hidden className="size-3.5" />
            {isRejecting ? "Rejecting…" : "Reject"}
          </Button>
        </form>
      </div>

      {message && <p className="w-full text-xs text-success">{message}</p>}
    </div>
  );
}
