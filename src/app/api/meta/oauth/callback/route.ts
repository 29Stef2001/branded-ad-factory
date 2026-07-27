import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  listAdAccounts,
} from "@/features/ad-performance/infrastructure/meta-oauth-client";
import { saveConnection } from "@/features/ad-performance/infrastructure/ad-performance-repository";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = request.cookies.get("meta_oauth_state")?.value;

  const fail = (message: string) =>
    NextResponse.redirect(
      `${origin}/dashboard/performance?error=${encodeURIComponent(message)}`,
    );

  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("Could not verify the connection request. Please try again.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("You must be signed in.");
  }

  try {
    const redirectUri = `${env.NEXT_PUBLIC_SITE_URL}/api/meta/oauth/callback`;
    const shortLived = await exchangeCodeForToken(code, redirectUri);
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    const adAccounts = await listAdAccounts(longLived.access_token);

    const firstAccount = adAccounts[0];
    if (!firstAccount) {
      return fail("No ad accounts found on this Meta account.");
    }

    const expiresAt = new Date(
      Date.now() + longLived.expires_in * 1000,
    ).toISOString();

    await saveConnection(
      user.id,
      firstAccount.id,
      longLived.access_token,
      expiresAt,
    );
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to connect Meta Ads.",
    );
  }

  const response = NextResponse.redirect(`${origin}/dashboard/performance`);
  response.cookies.delete("meta_oauth_state");
  return response;
}
