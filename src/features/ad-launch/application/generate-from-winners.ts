"use server";

import { revalidatePath } from "next/cache";
import {
  formatById,
  resolutionById,
} from "@/features/ad-launch/domain/creative-options";
import { buildBrandContext } from "@/features/ad-concepts/domain/brand-context";
import { generateConcepts } from "@/features/ad-concepts/infrastructure/concept-generation-client";
import {
  getBrandProfile,
  insertConcepts,
  listBrandAssets,
  listEnabledApprovedMessages,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { requireUserId } from "@/features/ad-concepts/application/require-user";

/**
 * Generates concepts modelled on ads that already perform.
 *
 * Runs the existing pipeline — brand context, structured concepts, then the
 * image and QA steps that follow on the concepts page — rather than a second
 * route that skips them. The QA pass is what keeps an off-brand creative out
 * of an ad account; a shortcut around it would make that guarantee worth
 * nothing.
 *
 * Concepts are created, not launched. They land in the library to be reviewed
 * and picked, because a creative nobody has looked at should not be one click
 * from spending money.
 */
export async function generateFromWinnersAction(input: {
  count: number;
  formatId: string;
  resolutionId: string;
  adLibraryLinks: string[];
  winningAdText: string;
  productBrief: string;
}): Promise<{ message: string; error: string | null }> {
  const { userId, denied } = await requireUserId();
  if (denied) return { message: "", error: denied.message ?? "Not signed in." };

  const [brandProfile, messages, assets] = await Promise.all([
    getBrandProfile(),
    listEnabledApprovedMessages(),
    listBrandAssets(),
  ]);

  if (!brandProfile) {
    return {
      message: "",
      error: "Set up your store profile in block 0 before generating.",
    };
  }

  if (messages.length === 0) {
    // Generation refuses rather than inventing an offer: the promotional
    // wording in an ad is a claim, and claims are approved, not improvised.
    return {
      message: "",
      error:
        "No enabled promotional message. Concepts must use approved wording, so add one under Promotional Messages first.",
    };
  }

  const hasSource =
    input.adLibraryLinks.length > 0 || input.winningAdText.trim().length > 0;
  if (!hasSource) {
    return {
      message: "",
      error: "Paste some Ad Library links or the text of a winning ad.",
    };
  }

  // Links are recorded in the brief rather than fetched: reading an Ad Library
  // ad needs the Ad Library API, and pretending to have scanned a page that
  // was never opened would be worse than saying what actually happened.
  const winners = input.winningAdText.trim()
    ? `Here are ads that are performing well in other niches. Model the structure and the energy, not the words — what is written must be original and true of this store:\n"""\n${input.winningAdText.trim()}\n"""`
    : `The user supplied ${input.adLibraryLinks.length} Meta Ad Library links as references. Their content is not available here, so work from the store profile and the brief.`;

  const brief = [
    input.productBrief.trim(),
    winners,
    `Produce creatives sized ${formatById(input.formatId).label}.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const activeAssets = assets.filter((asset) => asset.is_active);
  const availableTypes = [
    ...new Set(activeAssets.map((asset) => asset.asset_type)),
  ];

  try {
    const context = buildBrandContext(brandProfile);
    const generated = await generateConcepts(
      context,
      brief,
      messages.map((message) => message.message),
      // Only active assets: a disabled one is not attached at generation time,
      // so promising it to the model would be a lie.
      {
        types: availableTypes,
        tags: [...new Set(activeAssets.flatMap((asset) => asset.tags))],
        hasOwner: availableTypes.includes("owner"),
        hasProduct: availableTypes.includes("product"),
      },
      null,
    );

    // The model returns three at a time; asking for more means asking again.
    const concepts = generated.concepts.slice(0, input.count);
    await insertConcepts(userId, brief, null, concepts);

    revalidatePath("/dashboard/ad-factory/launch/builder");
    revalidatePath("/dashboard/concepts");

    const quality = resolutionById(input.resolutionId).quality;
    return {
      message:
        `${concepts.length} concept${concepts.length === 1 ? "" : "s"} written. ` +
        `Generate their images on the Concepts page — they run through QA there, at ${quality} quality — then pick them in block 4.`,
      error: null,
    };
  } catch (error) {
    return {
      message: "",
      error: error instanceof Error ? error.message : "Generation failed.",
    };
  }
}
