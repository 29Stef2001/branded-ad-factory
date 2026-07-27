"use client";

import { useActionState, useState } from "react";
import { ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/data/status-badge";
import {
  deleteBrandAssetAction,
  reorderBrandAssetAction,
  setBrandAssetPrimaryAction,
  toggleBrandAssetActiveAction,
  updateBrandAssetAction,
} from "@/features/ad-concepts/application/manage-brand-assets";
import { initialActionState } from "@/features/ad-concepts/application/types";
import type { BrandAssetWithUrl } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export function BrandAssetRow({ asset }: { asset: BrandAssetWithUrl }) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [deleteState, deleteAction, isDeleting] = useActionState(
    deleteBrandAssetAction.bind(null, asset.id),
    initialActionState,
  );
  const [toggleState, toggleAction, isToggling] = useActionState(
    toggleBrandAssetActiveAction.bind(null, asset.id, !asset.is_active),
    initialActionState,
  );
  const [primaryState, primaryAction, isSettingPrimary] = useActionState(
    setBrandAssetPrimaryAction.bind(null, asset.id),
    initialActionState,
  );
  const [upState, upAction, isMovingUp] = useActionState(
    reorderBrandAssetAction.bind(null, asset.id, "up"),
    initialActionState,
  );
  const [downState, downAction, isMovingDown] = useActionState(
    reorderBrandAssetAction.bind(null, asset.id, "down"),
    initialActionState,
  );
  const [updateState, updateAction, isUpdating] = useActionState(
    updateBrandAssetAction.bind(null, asset.id),
    initialActionState,
  );

  const errorMessage =
    deleteState.message ??
    toggleState.message ??
    primaryState.message ??
    upState.message ??
    downState.message ??
    updateState.message;

  const busy =
    isDeleting || isToggling || isSettingPrimary || isMovingUp || isMovingDown;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-start gap-3">
        {asset.displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL or external asset, not a static/optimizable asset
          <img
            src={asset.displayUrl}
            alt={asset.label ?? asset.asset_type}
            className="size-16 shrink-0 rounded-md object-cover ring-1 ring-foreground/10"
          />
        ) : (
          // A row whose image cannot be resolved still needs to be manageable —
          // showing nothing would leave an undeletable ghost.
          <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-foreground/10">
            <ImageOff aria-hidden className="size-5" />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">
              {asset.label ?? "Untitled"}
            </span>
            {asset.is_primary && <StatusBadge label="Primary" tone="accent" />}
            <StatusBadge
              label={asset.is_active ? "Active" : "Disabled"}
              tone={asset.is_active ? "success" : "muted"}
            />
            {asset.storage_path && (
              <StatusBadge label="Uploaded" tone="neutral" />
            )}
          </div>
          {(asset.region || asset.season) && (
            <p className="text-xs text-muted-foreground">
              {[asset.region, asset.season].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <form action={upAction}>
          <Button type="submit" size="sm" variant="ghost" disabled={busy}>
            Up
          </Button>
        </form>
        <form action={downAction}>
          <Button type="submit" size="sm" variant="ghost" disabled={busy}>
            Down
          </Button>
        </form>
        {!asset.is_primary && (
          <form action={primaryAction}>
            <Button type="submit" size="sm" variant="outline" disabled={busy}>
              {isSettingPrimary ? "Setting…" : "Set primary"}
            </Button>
          </form>
        )}
        <form action={toggleAction}>
          <Button type="submit" size="sm" variant="outline" disabled={busy}>
            {isToggling ? "…" : asset.is_active ? "Disable" : "Enable"}
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

        {/* Delete is the one irreversible action here, so it asks first. The
            confirm replaces the button in place rather than opening a dialog —
            fewer moving parts, and it cannot be dismissed by a stray click. */}
        {confirmingDelete ? (
          <form action={deleteAction} className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Delete this?</span>
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Yes, delete"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-destructive"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </Button>
        )}
      </div>

      {isEditing && (
        <form
          action={updateAction}
          className="grid gap-2 border-t border-border pt-3 sm:grid-cols-2"
        >
          <Input
            name="label"
            placeholder="Label"
            defaultValue={asset.label ?? ""}
          />
          <Input
            name="imageUrl"
            type="url"
            placeholder="Replace with image URL (optional)"
          />
          <Input
            name="region"
            placeholder="Region"
            defaultValue={asset.region ?? ""}
          />
          <Input
            name="season"
            placeholder="Season"
            defaultValue={asset.season ?? ""}
          />
          <Button
            type="submit"
            size="sm"
            disabled={isUpdating}
            className="sm:col-span-2 sm:justify-self-start"
          >
            {isUpdating ? "Saving…" : "Save changes"}
          </Button>
        </form>
      )}
    </div>
  );
}
