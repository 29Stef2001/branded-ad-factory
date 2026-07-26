"use server";

import { forgotPasswordSchema } from "@/features/auth/domain/schemas";
import {
  sendPasswordResetEmail,
  getAuthErrorMessage,
} from "@/features/auth/infrastructure/auth-repository";
import type { ActionState } from "@/features/auth/application/types";
import { env } from "@/lib/env";

export async function forgotPasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const redirectTo = `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`;

  const { error } = await sendPasswordResetEmail(parsed.data.email, redirectTo);

  if (error) {
    return { status: "error", message: getAuthErrorMessage(error) };
  }

  // Same message regardless of whether the email is registered, so the
  // response never reveals which addresses have an account.
  return {
    status: "success",
    message:
      "If an account exists for that email, we've sent a password reset link.",
  };
}
