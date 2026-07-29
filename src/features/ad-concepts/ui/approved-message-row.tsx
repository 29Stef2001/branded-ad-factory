"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/status-badge";
import { Input } from "@/components/ui/input";
import {
  deleteApprovedMessageAction,
  reorderApprovedMessageAction,
  toggleApprovedMessageActiveAction,
  updateApprovedMessageAction,
} from "@/features/ad-concepts/application/manage-approved-messages";
import { ConfirmButton } from "@/components/data/confirm-button";
import { initialActionState } from "@/features/ad-concepts/application/types";
import type { ApprovedMessageRow as ApprovedMessageRowData } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export function ApprovedMessageRow({
  message,
}: {
  message: ApprovedMessageRowData;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const [deleteState, deleteAction, isDeleting] = useActionState(
    deleteApprovedMessageAction.bind(null, message.id),
    initialActionState,
  );
  const [toggleState, toggleAction, isToggling] = useActionState(
    toggleApprovedMessageActiveAction.bind(
      null,
      message.id,
      !message.is_active,
    ),
    initialActionState,
  );
  const [upState, upAction, isMovingUp] = useActionState(
    reorderApprovedMessageAction.bind(null, message.id, "up"),
    initialActionState,
  );
  const [downState, downAction, isMovingDown] = useActionState(
    reorderApprovedMessageAction.bind(null, message.id, "down"),
    initialActionState,
  );
  const [updateState, updateAction, isUpdating] = useActionState(
    updateApprovedMessageAction.bind(null, message.id),
    initialActionState,
  );

  const errorMessage =
    deleteState.message ??
    toggleState.message ??
    upState.message ??
    downState.message ??
    updateState.message;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{message.message}</span>
        {/* StatusBadge like every other status in the app. A solid primary
            Badge made "enabled" — the ordinary state of every row — the
            loudest thing on the page. */}
        <StatusBadge
          label={message.is_active ? "Enabled" : "Disabled"}
          tone={message.is_active ? "success" : "muted"}
        />
      </div>

      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Reordering is one control, so the two arrows sit together and read
            as a pair. As ghost text buttons they did not look clickable at
            all, and "Up"/"Down" took more room than the arrows they describe. */}
        <div className="flex items-center gap-1">
          <form action={upAction}>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={isMovingUp}
              aria-label="Move up"
              title="Move up"
            >
              <ArrowUp aria-hidden className="size-3.5" />
            </Button>
          </form>
          <form action={downAction}>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={isMovingDown}
              aria-label="Move down"
              title="Move down"
            >
              <ArrowDown aria-hidden className="size-3.5" />
            </Button>
          </form>
        </div>
        <form action={toggleAction}>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={isToggling}
          >
            {isToggling
              ? message.is_active
                ? "Disabling…"
                : "Enabling…"
              : message.is_active
                ? "Disable"
                : "Enable"}
          </Button>
        </form>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setIsEditing((prev) => !prev)}
        >
          {isEditing ? "Cancel" : "Edit"}
        </Button>
        <ConfirmButton
          action={deleteAction}
          label="Delete"
          question="Delete this message?"
          confirmLabel="Yes, delete"
          pendingLabel="Deleting…"
          isPending={isDeleting}
        />
      </div>

      {isEditing && (
        <form
          action={updateAction}
          className="flex flex-wrap gap-2 border-t pt-2"
        >
          <Input
            name="message"
            defaultValue={message.message}
            className="min-w-64 flex-1"
          />
          <Button type="submit" size="sm" disabled={isUpdating}>
            {isUpdating ? "Saving…" : "Save"}
          </Button>
        </form>
      )}
    </div>
  );
}
