"use server";

import { revalidatePath } from "next/cache";
import { brandAssetSchema } from "@/features/ad-concepts/domain/schemas";
import { validateUpload } from "@/features/ad-concepts/domain/asset-upload";
import { parseTags } from "@/features/ad-concepts/domain/asset-tags";
import { isAllowedExternalImageHost } from "@/features/ad-concepts/infrastructure/image-generation-client";
import {
  createBrandAsset,
  deleteBrandAsset,
  reorderBrandAsset,
  updateBrandAsset,
  uploadBrandAssetFile,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import {
  requireUser,
  requireUserId,
} from "@/features/ad-concepts/application/require-user";
import type { ActionState } from "@/features/ad-concepts/application/types";

const CONCEPTS_PATH = "/dashboard/concepts";
const BRAND_ASSETS_PATH = "/dashboard/creative-studio/brand-assets";

export async function createBrandAssetAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = brandAssetSchema.safeParse({
    assetType: formData.get("assetType"),
    label: formData.get("label") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
    isPrimary: formData.get("isPrimary") === "on",
    isActive: true,
    region: formData.get("region") || undefined,
    season: formData.get("season") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { userId, denied } = await requireUserId();
  if (denied) return denied;

  // An uploaded file and a pasted URL are mutually exclusive, matching the
  // table's check constraint. Upload wins when both somehow arrive, because a
  // file the user just picked is the more deliberate of the two.
  const upload = formData.get("imageFile");
  const hasUpload = upload instanceof File && upload.size > 0;

  let source: { imageUrl?: string; storagePath?: string };

  if (hasUpload) {
    const validation = validateUpload(upload);
    if (!validation.ok) {
      return {
        status: "error",
        fieldErrors: { imageFile: [validation.error] },
      };
    }
    try {
      source = {
        storagePath: await uploadBrandAssetFile(userId, validation.file),
      };
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error ? error.message : "Could not upload the file.",
      };
    }
  } else if (parsed.data.imageUrl) {
    if (!isAllowedExternalImageHost(parsed.data.imageUrl)) {
      return {
        status: "error",
        fieldErrors: {
          imageUrl: [
            "Only your configured Shopify store's asset URLs are supported — upload the file instead.",
          ],
        },
      };
    }
    source = { imageUrl: parsed.data.imageUrl };
  } else {
    return {
      status: "error",
      fieldErrors: { imageFile: ["Upload an image or paste an image URL."] },
    };
  }

  try {
    await createBrandAsset({
      ...parsed.data,
      ...source,
      tags: parseTags(formData.get("tags")),
    });
  } catch (error) {
    // Postgres errors arrive as objects, not Error instances, so `.message`
    // alone loses the code that says what actually went wrong.
    console.error("Failed to create brand asset", {
      assetType: parsed.data.assetType,
      error,
    });
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not add asset.",
    };
  }

  revalidatePath(CONCEPTS_PATH);
  revalidatePath(BRAND_ASSETS_PATH);
  return { status: "success", message: "Asset added." };
}

export async function updateBrandAssetAction(
  id: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const imageUrl = formData.get("imageUrl");
  if (typeof imageUrl === "string" && imageUrl.trim()) {
    const parsed = brandAssetSchema.shape.imageUrl.safeParse(imageUrl);
    // The schema field is optional (an asset may be an upload instead), but a
    // non-empty string always parses to a string here.
    if (!parsed.success || !parsed.data) {
      return {
        status: "error",
        fieldErrors: {
          imageUrl: [parsed.error?.issues[0].message ?? "Enter a valid URL"],
        },
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

  const rawTags = formData.get("tags");

  const denied = await requireUser();
  if (denied) return denied;

  try {
    await updateBrandAsset(id, {
      ...(typeof imageUrl === "string" && imageUrl.trim() && { imageUrl }),
      ...updates,
      // Replaced wholesale rather than merged: an empty box means "no tags",
      // which merging would make impossible to express.
      ...(typeof rawTags === "string" && { tags: parseTags(rawTags) }),
    });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not update asset.",
    };
  }

  revalidatePath(CONCEPTS_PATH);
  revalidatePath(BRAND_ASSETS_PATH);
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
  revalidatePath(BRAND_ASSETS_PATH);
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
  revalidatePath(BRAND_ASSETS_PATH);
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
  revalidatePath(BRAND_ASSETS_PATH);
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
  revalidatePath(BRAND_ASSETS_PATH);
  return { status: "success" };
}
