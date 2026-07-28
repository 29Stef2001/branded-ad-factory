"use server";

import { revalidatePath } from "next/cache";
import { deleteConcept } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { requireUser } from "@/features/ad-concepts/application/require-user";
import type { ActionState } from "@/features/ad-concepts/application/types";

export async function deleteConceptAction(
  conceptId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const denied = await requireUser();
  if (denied) return denied;

  try {
    await deleteConcept(conceptId);
  } catch (error) {
    console.error("Failed to delete concept", { conceptId, error });
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not delete the concept.",
    };
  }

  // Every surface that lists concepts, since one just disappeared from all of
  // them.
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/concepts");
  revalidatePath("/dashboard/creative-studio/prompt-builder");
  revalidatePath("/dashboard/creative-studio/image-qa");
  return { status: "success", message: "Concept deleted." };
}
