"use server";

import { revalidatePath } from "next/cache";
import {
  brandAssetTypeEnum,
  generateCreativeImageSchema,
  type BrandAssetType,
} from "@/features/ad-concepts/domain/schemas";
import { selectReferenceAssets } from "@/features/ad-concepts/domain/asset-selection";
import {
  fetchExternalImage,
  generateConceptImage,
  isAllowedExternalImageHost,
  type NamedReference,
  type ReferenceImage,
} from "@/features/ad-concepts/infrastructure/image-generation-client";
import {
  countGenerationAttempts,
  downloadBrandAssetFile,
  getBrandProfile,
  getConceptForGeneration,
  insertGenerationAttempt,
  listBrandAssets,
  setConceptImagePath,
  setConceptProductImageUrl,
  updateConceptGenerationStatus,
  updateGenerationAttempt,
  uploadConceptImage,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { requireUserId } from "@/features/ad-concepts/application/require-user";
import type { ActionState } from "@/features/ad-concepts/application/types";

const CONCEPTS_PATH = "/dashboard/concepts";

/**
 * Loads the bytes for one selected reference, from wherever that asset lives.
 *
 * Uploaded assets come straight out of the private bucket; linked ones go
 * through the host allowlist, because those URLs are user-supplied and fetching
 * them is the SSRF-shaped part of this flow.
 */
async function loadAssetImage(asset: {
  image_url: string | null;
  storage_path: string | null;
}): Promise<ReferenceImage | null> {
  if (asset.storage_path) {
    return downloadBrandAssetFile(asset.storage_path);
  }
  if (asset.image_url && isAllowedExternalImageHost(asset.image_url)) {
    return fetchExternalImage(asset.image_url);
  }
  return null;
}

export async function generateCreativeImageAction(
  conceptId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = generateCreativeImageSchema.safeParse({
    productImageUrl: formData.get("productImageUrl") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { productImageUrl } = parsed.data;
  if (productImageUrl && !isAllowedExternalImageHost(productImageUrl)) {
    return {
      status: "error",
      fieldErrors: {
        productImageUrl: [
          "Only your configured Shopify store's photo URLs are supported",
        ],
      },
    };
  }

  const { userId, denied } = await requireUserId();
  if (denied) return denied;

  const [concept, brandProfile, brandAssets] = await Promise.all([
    getConceptForGeneration(conceptId),
    getBrandProfile(),
    listBrandAssets(),
  ]);

  if (!concept) {
    return { status: "error", message: "Concept not found." };
  }
  if (!brandProfile) {
    return {
      status: "error",
      message: "Set up your brand profile before generating images.",
    };
  }

  // The logo is resolved from the brand asset library first, falling back to
  // the brand profile's original Logo URL field so brands that never migrated
  // to the asset manager keep working exactly as before.
  const primaryLogo =
    brandAssets.find(
      (asset) =>
        asset.asset_type === "logo" && asset.is_active && asset.is_primary,
    ) ??
    brandAssets.find(
      (asset) => asset.asset_type === "logo" && asset.is_active,
    ) ??
    null;

  const hasLogo = Boolean(primaryLogo ?? brandProfile.logo_image_url);

  // brand_asset_requirements is a text[] filled from the model's output, so it
  // can contain anything the model decided to name. Unknown values are dropped
  // rather than trusted — they would otherwise match no asset and silently
  // consume a reference slot.
  const requirements = concept.brandAssetRequirements.filter(
    (value): value is BrandAssetType =>
      brandAssetTypeEnum.safeParse(value).success,
  );

  const selection = selectReferenceAssets(
    requirements,
    brandAssets,
    Boolean(productImageUrl),
    hasLogo,
  );

  const attemptNumber = (await countGenerationAttempts(conceptId)) + 1;
  const attemptId = await insertGenerationAttempt({
    conceptId,
    attemptNumber,
    status: "generating",
    selectedReferenceRoles: selection.selected.map((entry) => entry.role),
  });

  try {
    await updateConceptGenerationStatus(
      conceptId,
      "generating",
      attemptNumber - 1,
    );

    // Resolved in selection order so the prompt's "reference image N" wording
    // lines up with the files actually sent.
    const references: NamedReference[] = [];

    for (const entry of selection.selected) {
      if (entry.role === "product") {
        if (!productImageUrl) continue;
        references.push({
          role: "product",
          image: await fetchExternalImage(productImageUrl),
        });
        continue;
      }

      if (entry.role === "logo") {
        const image = primaryLogo
          ? await loadAssetImage(primaryLogo)
          : brandProfile.logo_image_url &&
              isAllowedExternalImageHost(brandProfile.logo_image_url)
            ? await fetchExternalImage(brandProfile.logo_image_url)
            : null;
        if (image) references.push({ role: "logo", image });
        continue;
      }

      if (!entry.asset) continue;
      const image = await loadAssetImage(entry.asset);
      if (image) {
        references.push({
          role: entry.role,
          label: entry.asset.label,
          image,
        });
      }
    }

    const image = await generateConceptImage(
      {
        brandName: brandProfile.brand_name,
        industry: brandProfile.industry,
        tone: brandProfile.tone,
        scenePrompt: concept.finalGenerationPrompt,
        promotionalMessage: concept.promotionalMessage,
        messagePlacement: concept.messagePlacement,
        textStyle: concept.textStyle,
        overflowNotes: selection.overflowNotes,
      },
      references,
    );

    const path = `${userId}/${conceptId}.png`;
    await uploadConceptImage(path, image);
    await setConceptImagePath(conceptId, path);
    if (productImageUrl) {
      await setConceptProductImageUrl(conceptId, productImageUrl);
    }

    await updateGenerationAttempt(attemptId, {
      status: "generated",
      imagePath: path,
    });
    await updateConceptGenerationStatus(
      conceptId,
      "generated",
      attemptNumber - 1,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Image generation failed.";

    // Recorded before returning: a failed generation that leaves no trace is
    // indistinguishable from one that never ran.
    await updateGenerationAttempt(attemptId, {
      status: "failed",
      failureReason: message,
    });
    await updateConceptGenerationStatus(conceptId, "failed", attemptNumber - 1);

    return { status: "error", message };
  }

  revalidatePath(CONCEPTS_PATH);
  return { status: "success" };
}
