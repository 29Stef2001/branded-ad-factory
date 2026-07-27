import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/features/ad-performance/infrastructure/meta-oauth-client";
import { env } from "@/lib/env";

export async function GET() {
  const state = randomBytes(16).toString("hex");
  const redirectUri = `${env.NEXT_PUBLIC_SITE_URL}/api/meta/oauth/callback`;
  const authorizeUrl = buildAuthorizeUrl(redirectUri, state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
