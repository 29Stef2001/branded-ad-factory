"use client";

import { useActionState } from "react";
import { CheckCheck, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  discoverAccountsAction,
  selectAllActiveAction,
} from "@/features/creative-intelligence/application/discover-accounts";
import { initialActionState } from "@/features/ad-concepts/application/types";

export function DiscoverButtons() {
  const [fetchState, fetchAction, isFetching] = useActionState(
    discoverAccountsAction,
    initialActionState,
  );
  const [selectState, selectAction, isSelecting] = useActionState(
    selectAllActiveAction,
    initialActionState,
  );

  const message = fetchState.message ?? selectState.message;
  const failed =
    fetchState.status === "error" || selectState.status === "error";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={fetchAction}>
          <Button type="submit" size="sm" disabled={isFetching || isSelecting}>
            <RefreshCw aria-hidden className="size-3.5" />
            {isFetching ? "Fetching…" : "Fetch from Meta"}
          </Button>
        </form>
        <form action={selectAction}>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={isFetching || isSelecting}
          >
            <CheckCheck aria-hidden className="size-3.5" />
            {isSelecting ? "Selecting…" : "Select all active"}
          </Button>
        </form>
      </div>

      {message &&
        (failed ? (
          <Alert variant="destructive">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-success">{message}</p>
        ))}
    </div>
  );
}
