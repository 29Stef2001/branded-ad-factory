"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  approveSuggestedCompetitorAction,
  dismissSuggestedCompetitorAction,
} from "@/features/competitor-analysis/application/suggest-competitor";
import { initialActionState } from "@/features/competitor-analysis/application/types";
import type { SuggestedCompetitor } from "@/features/competitor-analysis/infrastructure/competitor-repository";

/**
 * The review queue. Nothing here reaches `competitors` without an explicit
 * Approve click — a suggestion is a signal, not a decision made for the user.
 */
export function SuggestedCompetitorsList({
  suggestions,
}: {
  suggestions: SuggestedCompetitor[];
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">
        Flagged, awaiting review ({suggestions.length})
      </h2>
      {suggestions.map((suggestion) => (
        <SuggestionRow key={suggestion.id} suggestion={suggestion} />
      ))}
    </div>
  );
}

function SuggestionRow({ suggestion }: { suggestion: SuggestedCompetitor }) {
  const [approveState, approveAction, approving] = useActionState(
    approveSuggestedCompetitorAction.bind(null, suggestion.id),
    initialActionState,
  );
  const [, dismissAction, dismissing] = useActionState(
    dismissSuggestedCompetitorAction.bind(null, suggestion.id),
    initialActionState,
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">{suggestion.name}</p>
            <p className="text-sm text-muted-foreground">
              {suggestion.reason}
            </p>
            {suggestion.meta_page_id && (
              <p className="text-xs text-muted-foreground">
                Page ID: {suggestion.meta_page_id}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <form action={dismissAction}>
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                disabled={dismissing || approving}
              >
                Dismiss
              </Button>
            </form>
            <form action={approveAction}>
              <Button
                type="submit"
                size="sm"
                disabled={approving || dismissing}
              >
                {approving ? "Adding…" : "Approve"}
              </Button>
            </form>
          </div>
        </div>
        {approveState.status === "error" && approveState.message && (
          <Alert variant="destructive">
            <AlertDescription>{approveState.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
