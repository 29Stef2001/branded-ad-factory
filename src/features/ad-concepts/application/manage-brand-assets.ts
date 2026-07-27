"use server";

import { revalidatePath } from "next/cache";
import { brandAssetSchema } from "@/features/ad-concepts/domain/schemas";
import { isAllowedExternalImageHost } from "@/features/ad-concepts/infrastructure/image-generation-client";
import {
  createBrandAsset,
  deleteBrandAsset,
  reorderBrandAsset,
  updateBrandAsset,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { requireUser } from "@/features/ad-concepts/application/require-user";
import type { ActionState } from "@/features/ad-concepts/application/types";

const CONCEPTS_PATH = "/dashboard/concepts";

export async function createBrandAssetAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = brandAssetSchema.safeParse({
    assetType: formData.get("assetType"),
    label: formData.get("label") || undefined,
    imageUrl: formData.get("imageUrl"),
    isPrimary: formData.get("isPrimary") === "on",
    isActive: true,
    region: formData.get("region") || undefined,
    season: formData.get("season") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!isAllowedExternalImageHost(parsed.data.imageUrl)) {
    return {
      status: "error",
      fieldErrors: {
        imageUrl: [
          "Only your configured Shopify store's asset URLs are supported",
        ],
      },
    };
  }

  const denied = await requireUser();
  if (denied) return denied;

  try {
    await createBrandAsset(parsed.data);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not add asset.",
    };
  }

  revalidatePath(CONCEPTS_PATH);
  return { status: "success" };
}

export async function updateBrandAssetAction(
  id: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const imageUrl = formData.get("imageUrl");
  if (typeof imageUrl === "string" && imageUrl.trim()) {
    const parsed = brandAssetSchema.shape.imageUrl.safeParse(imageUrl);
    if (!parsed.success) {
      return {
        status: "error",
        fieldErrors: { imageUrl: [parsed.error.issues[0].message] },
      };
    }
    if (!isAllowedExternalImageHost(parsed.data)) {
      return {
        status: "error",
        fieldErrors: {
          imageUrl: [
            "Only your configured Shopify store's asset URLs are supported",
          ],
        },
      };
    }
  }

  // Validated through the same schema fields the create path uses, rather than
  // passed through raw — otherwise an edit could write values that adding the
  // asset in the first place would have rejected.
  const optionalText = brandAssetSchema.shape.label;
  const textFields: Array<"label" | "region" | "season"> = [
    "label",
    "region",
    "season",
  ];
  const updates: { label?: string; region?: string; season?: string } = {};

  for (const field of textFields) {
    const raw = formData.get(field);
    if (typeof raw !== "string") continue;

    // An empty string means "clear this field", which the create-time schema
    // has no way to express, so it is allowed through without parsing.
    if (!raw.trim()) {
      updates[field] = "";
      continue;
    }

    const parsed = optionalText.safeParse(raw);
    if (!parsed.success) {
      return {
        status: "error",
        fieldErrors: { [field]: [parsed.error.issues[0].message] },
      };
    }
    updates[field] = parsed.data;
  }

  const denied = await requireUser();
  if (denied) return denied;

  try {
    await updateBrandAsset(id, {
      ...(typeof imageUrl === "string" && imageUrl.trim() && { imageUrl }),
      ...updates,
    });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not update asset.",
    };
  }

  revalidatePath(CONCEPTS_PATH);
  return { status: "success" };
}

export async function deleteBrandAssetAction(
  id: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const denied = await requireUser();
  if (denied) return denied;

  try {
    await deleteBrandAsset(id);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not delete asset.",
    };
  }

  revalidatePath(CONCEPTS_PATH);
  return { status: "success" };
}

export async function toggleBrandAssetActiveAction(
  id: string,
  nextIsActive: boolean,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const denied = await requireUser();
  if (denied) return denied;

  try {
    await updateBrandAsset(id, { isActive: nextIsActive });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not update asset.",
    };
  }

  revalidatePath(CONCEPTS_PATH);
  return { status: "success" };
}

export async function setBrandAssetPrimaryAction(
  id: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const denied = await requireUser();
  if (denied) return denied;

  try {
    await updateBrandAsset(id, { isPrimary: true });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not set as primary.",
    };
  }

  revalidatePath(CONCEPTS_PATH);
  return { status: "success" };
}

export async function reorderBrandAssetAction(
  id: string,
  direction: "up" | "down",
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const denied = await requireUser();
  if (denied) return denied;

  try {
    await reorderBrandAsset(id, direction);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not reorder asset.",
    };
  }

  revalidatePath(CONCEPTS_PATH);
  return { status: "success" };
}
