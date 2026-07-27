"use server";

import { revalidatePath } from "next/cache";
import { setGenerationPromptOverride } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { requireUser } from "@/features/ad-concepts/application/require-user";
import type { ActionState } from "@/features/ad-concepts/application/types";

const PROMPT_BUILDER_PATH = "/dashboard/creative-studio/prompt-builder";

/**
 * Minimum length is a guard against saving an empty box by accident, not a
 * quality bar — a prompt this short cannot describe a scene.
 */
const MIN_PROMPT_LENGTH = 20;

export async function saveGenerationPromptAction(
  conceptId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const prompt = formData.get("prompt");

  if (typeof prompt !== "string" || prompt.trim().length < MIN_PROMPT_LENGTH) {
    return {
      status: "error",
      fieldErrors: {
        prompt: [`Write at least ${MIN_PROMPT_LENGTH} characters.`],
      },
    };
  }

  const denied = await requireUser();
  if (denied) return denied;

  try {
    await setGenerationPromptOverride(conceptId, prompt.trim());
  } catch (error) {
    console.error("Failed to save generation prompt", { conceptId, error });
    return { status: "error", message: "Could not save the prompt." };
  }

  revalidatePath(PROMPT_BUILDER_PATH);
  return { status: "success", message: "Prompt saved." };
}

export async function resetGenerationPromptAction(
  conceptId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const denied = await requireUser();
  if (denied) return denied;

  try {
    // Clearing the override is the reset: the model's original prompt was never
    // overwritten, so there is nothing to restore from a backup.
    await setGenerationPromptOverride(conceptId, null);
  } catch (error) {
    console.error("Failed to reset generation prompt", { conceptId, error });
    return { status: "error", message: "Could not reset the prompt." };
  }

  revalidatePath(PROMPT_BUILDER_PATH);
  return { status: "success", message: "Reset to the generated prompt." };
}
