"use server";

import { redirect } from "next/navigation";
import { resetPasswordSchema } from "@/features/auth/domain/schemas";
import {
  updatePassword,
  getAuthErrorMessage,
} from "@/features/auth/infrastructure/auth-repository";
import type { ActionState } from "@/features/auth/application/types";

export async function resetPasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { error } = await updatePassword(parsed.data.password);

  if (error) {
    return { status: "error", message: getAuthErrorMessage(error) };
  }

  redirect("/dashboard");
}
