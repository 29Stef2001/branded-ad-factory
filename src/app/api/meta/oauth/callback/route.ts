import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  listAdAccounts,
} from "@/features/ad-performance/infrastructure/meta-oauth-client";
import { saveConnection } from "@/features/ad-performance/infrastructure/ad-performance-repository";
import { getBrandProfile } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import {
  rankAccounts,
  suggestedAccount,
} from "@/features/creative-intelligence/domain/account-matching";
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

  // Read before the exchange: reconnecting must not silently move the
  // workspace to a different account than the one it was already using.
  const { data: existing } = await supabase
    .from("meta_ad_account_connections")
    .select("ad_account_id")
    .maybeSingle();
  const existingAccountId = existing?.ad_account_id ?? null;

  try {
    const redirectUri = `${env.NEXT_PUBLIC_SITE_URL}/api/meta/oauth/callback`;
    const shortLived = await exchangeCodeForToken(code, redirectUri);
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    const adAccounts = await listAdAccounts(longLived.access_token);

    if (adAccounts.length === 0) {
      return fail("No ad accounts found on this Meta account.");
    }

    // Not adAccounts[0]. Meta returns them in no useful order, and taking the
    // first is how this workspace spent weeks syncing "1250 - 70007 - 025922 -
    // ceylorin" while Copper & Soul sat further down the same list. Matching
    // the brand name picks the likely one; where it cannot tell, the previous
    // choice is kept rather than swapped for a guess.
    const brandProfile = await getBrandProfile();
    const ranked = rankAccounts(
      adAccounts.map((account) => ({
        adAccountId: account.id,
        name: account.name ?? null,
      })),
      brandProfile?.brand_name,
    );
    const suggestion = suggestedAccount(ranked);
    const chosenAccountId =
      suggestion?.adAccountId ?? existingAccountId ?? adAccounts[0].id;

    const expiresAt = new Date(
      Date.now() + longLived.expires_in * 1000,
    ).toISOString();

    await saveConnection(
      user.id,
      chosenAccountId,
      longLived.access_token,
      expiresAt,
    );
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to connect Meta Ads.",
    );
  }

  // `connected=1` lets the page report which permissions actually arrived,
  // rather than implying success just because the redirect completed.
  const response = NextResponse.redirect(
    `${origin}/dashboard/performance?connected=1`,
  );
  response.cookies.delete("meta_oauth_state");
  return response;
}
