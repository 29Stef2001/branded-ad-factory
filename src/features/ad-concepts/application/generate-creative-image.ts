"use server";

import { revalidatePath } from "next/cache";
import {
  brandAssetTypeEnum,
  generateCreativeImageSchema,
  type BrandAssetType,
} from "@/features/ad-concepts/domain/schemas";
import { selectReferenceAssets } from "@/features/ad-concepts/domain/asset-selection";
import { toUserFacingError } from "@/features/ad-concepts/domain/generation-errors";
import { evaluateQa } from "@/features/ad-concepts/domain/qa-evaluation";
import { runImageQa } from "@/features/ad-concepts/infrastructure/qa-client";
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
  listEnabledApprovedMessages,
  setConceptImagePath,
  setConceptProductImageUrl,
  updateConceptGenerationStatus,
  updateGenerationAttempt,
  uploadConceptImage,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { requireUserId } from "@/features/ad-concepts/application/require-user";
import type { ActionState } from "@/features/ad-concepts/application/types";

const CONCEPTS_PATH = "/dashboard/concepts";
const PROMPT_BUILDER_PATH = "/dashboard/creative-studio/prompt-builder";

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

  // Selection is where a disappointing image usually starts, and it is
  // invisible from the result alone — the log is the only place the reasoning
  // survives. Scores come back from the domain function, which stays IO-free.
  console.log(
    "Reference asset selection",
    // Serialised rather than passed as an object: console.log truncates nested
    // structures to "[Object]" at depth, which hides the per-asset scores that
    // are the only reason this log exists.
    JSON.stringify(
      {
        conceptId,
        requestedRequirements: concept.brandAssetRequirements,
        usableRequirements: requirements,
        candidatesConsidered: brandAssets.length,
        scores: selection.scores,
        selected: selection.selected.map((entry) => ({
          role: entry.role,
          assetId: entry.asset?.id ?? null,
          label: entry.asset?.label ?? null,
        })),
        overflow: selection.overflowNotes,
      },
      null,
      2,
    ),
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

    // QA runs after the image is stored, never before: a review failure must
    // not cost the render. Its own errors are caught separately below for the
    // same reason.
    await updateGenerationAttempt(attemptId, { status: "qa_in_progress" });

    try {
      const approvedMessages = await listEnabledApprovedMessages();
      const qa = await runImageQa({
        brandName: brandProfile.brand_name,
        scenePrompt: concept.finalGenerationPrompt,
        approvedMessage: concept.promotionalMessage,
        allApprovedMessages: approvedMessages.map((m) => m.message),
        generatedImage: { buffer: image, contentType: "image/png" },
        references: references.map((reference) => ({
          role: reference.role,
          label: reference.label,
          buffer: reference.image.buffer,
          contentType: reference.image.contentType,
        })),
      });

      const verdict = evaluateQa(qa);

      console.log(
        "Image QA",
        JSON.stringify(
          {
            conceptId,
            attemptId,
            score: verdict.score,
            passed: verdict.passed,
            hardFailures: verdict.hardFailureKeys,
            issues: verdict.issues,
            scores: qa.scores,
          },
          null,
          2,
        ),
      );

      await updateGenerationAttempt(attemptId, {
        status: verdict.passed ? "approved" : "needs_review",
        qaScores: qa.scores,
        qaPassed: verdict.passed,
        qaScore: verdict.score,
        qaNotes: qa.notes,
        detectedIssues: verdict.issues,
        qaSuggestedPrompt: qa.suggestedPromptFix || undefined,
        reviewedAt: new Date().toISOString(),
      });
      await updateConceptGenerationStatus(
        conceptId,
        verdict.passed ? "approved" : "needs_review",
        attemptNumber - 1,
      );
    } catch (qaError) {
      // The image is already saved and usable; only the verdict is missing.
      // Recorded as generated-but-unreviewed rather than failed, so a QA outage
      // never looks like a generation outage.
      console.error("Image QA failed", { conceptId, attemptId, qaError });
      await updateGenerationAttempt(attemptId, {
        status: "generated",
        qaNotes: `QA could not run: ${toUserFacingError(qaError).message}`,
      });
      await updateConceptGenerationStatus(
        conceptId,
        "generated",
        attemptNumber - 1,
      );
    }
  } catch (error) {
    // The raw error goes to the logs and to the attempt row; the user gets a
    // translation. Provider payloads are not readable and leak internals.
    console.error("Image generation failed", { conceptId, attemptId, error });

    const technical = error instanceof Error ? error.message : String(error);
    const friendly = toUserFacingError(error);

    await updateGenerationAttempt(attemptId, {
      status: "failed",
      failureReason: technical,
    });
    await updateConceptGenerationStatus(conceptId, "failed", attemptNumber - 1);

    return { status: "error", message: friendly.message };
  }

  revalidatePath(CONCEPTS_PATH);
  revalidatePath(PROMPT_BUILDER_PATH);
  return { status: "success" };
}
