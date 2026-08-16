"use client";

import { useActionState } from "react";
import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/status-badge";
import {
  setDefaultAccountAction,
  toggleAdAccountAction,
} from "@/features/creative-intelligence/application/discover-accounts";
import { initialActionState } from "@/features/ad-concepts/application/types";
import { ACCOUNT_STATUS_LABELS } from "@/features/creative-intelligence/domain/account-status";

export function AccountRow({
  adAccountId,
  name,
  currency,
  accountStatus,
  isSelected,
  isDefault,
  matchReason,
}: {
  adAccountId: string;
  name: string | null;
  currency: string | null;
  accountStatus: number | null;
  isSelected: boolean;
  isDefault: boolean;
  matchReason: string | null;
}) {
  const [, toggle, isToggling] = useActionState(
    toggleAdAccountAction.bind(null, adAccountId, !isSelected),
    initialActionState,
  );
  const [, makeDefault, isSettingDefault] = useActionState(
    setDefaultAccountAction.bind(null, adAccountId),
    initialActionState,
  );

  const active = accountStatus === 1;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
      <form action={toggle}>
        <Button
          type="submit"
          size="sm"
          variant={isSelected ? "default" : "outline"}
          // A disabled account can be neither launched into nor usefully
          // synced, so selecting one would only spend API calls to learn that.
          disabled={isToggling || !active}
          title={active ? undefined : "This account cannot run ads"}
        >
          {isSelected && <Check aria-hidden className="size-3.5" />}
          {isSelected ? "Selected" : "Select"}
        </Button>
      </form>

      <div className="flex min-w-56 flex-1 flex-col gap-0.5">
        <span className="font-medium">{name ?? adAccountId}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {adAccountId}
          {currency ? ` · ${currency}` : ""}
        </span>
        {matchReason && (
          <span className="text-xs text-success">{matchReason}</span>
        )}
      </div>

      <StatusBadge
        label={ACCOUNT_STATUS_LABELS[accountStatus ?? -1] ?? "Unknown"}
        tone={active ? "success" : "danger"}
      />

      {isDefault ? (
        <StatusBadge label="Default" tone="accent" />
      ) : (
        active &&
        isSelected && (
          <form action={makeDefault}>
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              disabled={isSettingDefault}
            >
              <Star aria-hidden className="size-3.5" />
              Make default
            </Button>
          </form>
        )
      )}
    </div>
  );
}
