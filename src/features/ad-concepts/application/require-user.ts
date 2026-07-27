import { getCurrentUser } from "@/features/auth/infrastructure/auth-repository";
import type { ActionState } from "@/features/ad-concepts/application/types";

/**
 * Guard for mutating Server Actions: returns an error state to hand straight
 * back, or null when the caller may proceed.
 *
 * RLS already makes it impossible to write another user's rows, so this is not
 * the access control — it is what stops a signed-out mutation from *looking*
 * like it worked. Supabase's `.update()` / `.delete()` do not error when the
 * policy filters every candidate row away; they succeed against zero rows. So
 * without this check, clicking Delete on an expired session returned
 * `status: "success"` and the row was still there after a refresh.
 */
export async function requireUser(): Promise<ActionState | null> {
  const user = await getCurrentUser();
  if (user) return null;
  return { status: "error", message: "You must be signed in." };
}
