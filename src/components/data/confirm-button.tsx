"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * A destructive action that asks once before doing anything.
 *
 * Extracted because the same two-step pattern was written inline for brand
 * assets and missing entirely for promotional messages — one irreversible
 * action guarded, an identical one not. Confirmation replaces the button in
 * place rather than opening a dialog: fewer moving parts, nothing to dismiss
 * by accident, and it cannot be lost behind another layer.
 */
export function ConfirmButton({
  action,
  label,
  confirmLabel,
  pendingLabel,
  question = "Are you sure?",
  disabled,
  isPending,
}: {
  /** The form action to submit once confirmed. */
  action: (formData: FormData) => void;
  label: string;
  confirmLabel: string;
  pendingLabel: string;
  question?: string;
  disabled?: boolean;
  isPending?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Escape backs out, which is what people try first.
  useEffect(() => {
    if (!confirming) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirming(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirming]);

  // Focus lands on Cancel, not Confirm: the safe option should be the one a
  // stray Enter hits.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="text-destructive"
        disabled={disabled}
        onClick={() => setConfirming(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{question}</span>
      <Button
        type="submit"
        size="sm"
        variant="destructive"
        disabled={isPending}
      >
        {isPending ? pendingLabel : confirmLabel}
      </Button>
      <Button
        ref={cancelRef}
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setConfirming(false)}
      >
        Cancel
      </Button>
    </form>
  );
}
