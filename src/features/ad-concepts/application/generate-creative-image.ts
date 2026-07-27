"use server";

import { revalidatePath } from "next/cache";
import { generateCreativeImageSchema } from "@/features/ad-concepts/domain/schemas";
import {
  fetchExternalImage,
  generateConceptImage,
  isAllowedExternalImageHost,
  type ConceptImageReferences,
} from "@/features/ad-concepts/infrastructure/image-generation-client";
import {
  getBrandProfile,
  getConcept,
  setConceptImagePath,
  setConceptProductImageUrl,
  uploadConceptImage,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { getCurrentUser } from "@/features/auth/infrastructure/auth-repository";
import type { ActionState } from "@/features/ad-concepts/application/types";

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

  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "You must be signed in." };
  }

  const [concept, brandProfile] = await Promise.all([
    getConcept(conceptId),
    getBrandProfile(),
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

  const promptInput = {
    brandName: brandProfile.brand_name,
    industry: brandProfile.industry,
    tone: brandProfile.tone,
    visualDirection: concept.visualDirection,
  };

  try {
    const references: ConceptImageReferences = {};
    if (productImageUrl) {
      references.product = await fetchExternalImage(productImageUrl);
    }
    if (brandProfile.logo_image_url) {
      references.logo = await fetchExternalImage(brandProfile.logo_image_url);
    }

    const image = await generateConceptImage(promptInput, references);

    const path = `${user.id}/${conceptId}.png`;
    await uploadConceptImage(path, image);
    await setConceptImagePath(conceptId, path);
    if (productImageUrl) {
      await setConceptProductImageUrl(conceptId, productImageUrl);
    }
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Image generation failed.",
    };
  }

  revalidatePath("/dashboard/concepts");
  return { status: "success" };
}
