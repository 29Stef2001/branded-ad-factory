"use server";

import { revalidatePath } from "next/cache";
import { approvedMessageSchema } from "@/features/ad-concepts/domain/schemas";
import {
  createApprovedMessage,
  deleteApprovedMessage,
  reorderApprovedMessage,
  updateApprovedMessage,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { requireUser } from "@/features/ad-concepts/application/require-user";
import type { ActionState } from "@/features/ad-concepts/application/types";

const CONCEPTS_PATH = "/dashboard/concepts";

export async function createApprovedMessageAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = approvedMessageSchema.safeParse({
    message: formData.get("message"),
    isActive: true,
    category: formData.get("category") || undefined,
    usageNotes: formData.get("usageNotes") || undefined,
    region: formData.get("region") || undefined,
    campaign: formData.get("campaign") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const denied = await requireUser();
  if (denied) return denied;

  try {
    await createApprovedMessage(parsed.data);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not add message.",
    };
  }

  revalidatePath(CONCEPTS_PATH);
  return { status: "success" };
}

export async function updateApprovedMessageAction(
  id: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const message = formData.get("message");
  if (typeof message === "string" && !message.trim()) {
    return {
      status: "error",
      fieldErrors: { message: ["Message text is required"] },
    };
  }

  const denied = await requireUser();
  if (denied) return denied;

  try {
    await updateApprovedMessage(id, {
      ...(typeof message === "string" && message.trim() && { message }),
    });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not update message.",
    };
  }

  revalidatePath(CONCEPTS_PATH);
  return { status: "success" };
}

export async function deleteApprovedMessageAction(
  id: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const denied = await requireUser();
  if (denied) return denied;

  try {
    await deleteApprovedMessage(id);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not delete message.",
    };
  }

  revalidatePath(CONCEPTS_PATH);
  return { status: "success" };
}

export async function toggleApprovedMessageActiveAction(
  id: string,
  nextIsActive: boolean,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const denied = await requireUser();
  if (denied) return denied;

  try {
    await updateApprovedMessage(id, { isActive: nextIsActive });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not update message.",
    };
  }

  revalidatePath(CONCEPTS_PATH);
  return { status: "success" };
}

export async function reorderApprovedMessageAction(
  id: string,
  direction: "up" | "down",
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const denied = await requireUser();
  if (denied) return denied;

  try {
    await reorderApprovedMessage(id, direction);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not reorder message.",
    };
  }

  revalidatePath(CONCEPTS_PATH);
  return { status: "success" };
}
