"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteBrandAssetAction,
  reorderBrandAssetAction,
  setBrandAssetPrimaryAction,
  toggleBrandAssetActiveAction,
  updateBrandAssetAction,
} from "@/features/ad-concepts/application/manage-brand-assets";
import { initialActionState } from "@/features/ad-concepts/application/types";
import type { BrandAssetRow as BrandAssetRowData } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export function BrandAssetRow({ asset }: { asset: BrandAssetRowData }) {
  const [isEditing, setIsEditing] = useState(false);

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

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- external asset URL, not a static/optimizable asset */}
        <img
          src={asset.image_url}
          alt={asset.label ?? asset.asset_type}
          className="h-16 w-16 shrink-0 rounded-md object-cover ring-1 ring-foreground/10"
        />
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {asset.label ?? "Untitled"}
            </span>
            {asset.is_primary && <Badge>Primary</Badge>}
            <Badge variant={asset.is_active ? "default" : "secondary"}>
              {asset.is_active ? "Active" : "Disabled"}
            </Badge>
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

      <div className="flex flex-wrap gap-2">
        <form action={upAction}>
          <Button type="submit" size="sm" variant="ghost" disabled={isMovingUp}>
            Up
          </Button>
        </form>
        <form action={downAction}>
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            disabled={isMovingDown}
          >
            Down
          </Button>
        </form>
        {!asset.is_primary && (
          <form action={primaryAction}>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={isSettingPrimary}
            >
              {isSettingPrimary ? "Setting..." : "Set primary"}
            </Button>
          </form>
        )}
        <form action={toggleAction}>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={isToggling}
          >
            {isToggling ? "..." : asset.is_active ? "Disable" : "Enable"}
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
        <form action={deleteAction}>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={isDeleting}
            className="text-destructive"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </form>
      </div>

      {isEditing && (
        <form
          action={updateAction}
          className="flex flex-wrap gap-2 border-t pt-2"
        >
          <Input
            name="label"
            placeholder="Label"
            defaultValue={asset.label ?? ""}
            className="w-40"
          />
          <Input
            name="imageUrl"
            type="url"
            placeholder="New image URL (leave blank to keep current)"
            className="min-w-64 flex-1"
          />
          <Input
            name="region"
            placeholder="Region (optional)"
            defaultValue={asset.region ?? ""}
            className="w-32"
          />
          <Input
            name="season"
            placeholder="Season (optional)"
            defaultValue={asset.season ?? ""}
            className="w-32"
          />
          <Button type="submit" size="sm" disabled={isUpdating}>
            {isUpdating ? "Saving..." : "Save"}
          </Button>
        </form>
      )}
    </div>
  );
}
