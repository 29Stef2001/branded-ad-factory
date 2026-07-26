"use server";

import { redirect } from "next/navigation";
import { loginSchema } from "@/features/auth/domain/schemas";
import {
  signInWithPassword,
  getAuthErrorMessage,
} from "@/features/auth/infrastructure/auth-repository";
import type { ActionState } from "@/features/auth/application/types";

export async function loginAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { error } = await signInWithPassword(
    parsed.data.email,
    parsed.data.password,
  );

  if (error) {
    return { status: "error", message: getAuthErrorMessage(error) };
  }

  redirect("/dashboard");
}
