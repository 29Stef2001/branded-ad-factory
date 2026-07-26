"use server";

import { redirect } from "next/navigation";
import { registerSchema } from "@/features/auth/domain/schemas";
import {
  signUpWithPassword,
  getAuthErrorMessage,
} from "@/features/auth/infrastructure/auth-repository";
import type { ActionState } from "@/features/auth/application/types";
import { env } from "@/lib/env";

export async function registerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, password } = parsed.data;
  const emailRedirectTo = `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/dashboard`;

  const { data, error } = await signUpWithPassword(
    email,
    password,
    emailRedirectTo,
  );

  if (error) {
    return { status: "error", message: getAuthErrorMessage(error) };
  }

  if (data.session) {
    redirect("/dashboard");
  }

  return {
    status: "success",
    message: "Check your email to confirm your account before signing in.",
  };
}
