import { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const FRIENDLY_ERROR_MESSAGES: Partial<Record<string, string>> = {
  invalid_credentials: "Invalid email or password. Please try again.",
  email_not_confirmed:
    "Please confirm your email address before signing in. Check your inbox for the confirmation link.",
  user_already_exists: "An account with this email already exists.",
  email_exists: "An account with this email already exists.",
  weak_password: "Please choose a stronger password.",
  same_password:
    "Your new password must be different from your current password.",
  over_email_send_rate_limit:
    "Too many requests. Please wait a moment before trying again.",
  email_address_invalid: "Enter a valid email address.",
};

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    if (error.code && FRIENDLY_ERROR_MESSAGES[error.code]) {
      return FRIENDLY_ERROR_MESSAGES[error.code]!;
    }
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export async function signUpWithPassword(
  email: string,
  password: string,
  emailRedirectTo: string,
) {
  const supabase = await createClient();
  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = await createClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const supabase = await createClient();
  return supabase.auth.signOut();
}

export async function sendPasswordResetEmail(
  email: string,
  redirectTo: string,
) {
  const supabase = await createClient();
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function updatePassword(password: string) {
  const supabase = await createClient();
  return supabase.auth.updateUser({ password });
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
