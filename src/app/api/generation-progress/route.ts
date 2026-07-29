import { NextResponse, type NextRequest } from "next/server";
import { getLatestGenerationProgress } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { getCurrentUser } from "@/features/auth/infrastructure/auth-repository";

/**
 * Progress polling for an in-flight generation.
 *
 * A route handler rather than a Server Action, which is the exception this
 * codebase reserves for cases needing their own HTTP contract. Next.js queues
 * Server Actions from the same client one after another, so a poll issued while
 * a ~90 second generation is running does not execute until that generation
 * finishes — by which time there is nothing left to report. Route handlers are
 * not serialised behind actions, so this can actually answer mid-run.
 *
 * Reads only, and RLS still scopes the query to the caller's own rows.
 */
export async function GET(request: NextRequest) {
  const conceptId = request.nextUrl.searchParams.get("conceptId");
  if (!conceptId) {
    return NextResponse.json({ error: "conceptId required" }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const progress = await getLatestGenerationProgress(conceptId);
    return NextResponse.json(progress ?? null, {
      // Polled every few seconds; a cached answer would defeat the point.
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Failed to read generation progress", { conceptId, error });
    // Progress is decoration on top of the real action, so a failed read must
    // not surface as an error on the page the user is waiting on.
    return NextResponse.json(null, { status: 200 });
  }
}
