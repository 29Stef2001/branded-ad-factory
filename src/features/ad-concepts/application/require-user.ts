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

/**
 * Same guard, for the actions that need the id itself — uploads key their
 * storage path on it, and that path is what the bucket's RLS policy checks.
 */
export async function requireUserId(): Promise<
  { userId: string; denied?: never } | { denied: ActionState; userId?: never }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { denied: { status: "error", message: "You must be signed in." } };
  }
  return { userId: user.id };
}
