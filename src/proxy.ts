import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_ONLY_ROUTES = ["/login", "/register", "/forgot-password"];
const PROTECTED_ROUTES = ["/dashboard", "/reset-password"];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublicOnlyRoute = PUBLIC_ONLY_ROUTES.some((route) =>
    pathname.startsWith(route),
  );
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isPublicOnlyRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // api/mcp is bearer-token-authenticated (see src/app/api/mcp/route.ts),
    // never cookie/session-based — running Supabase's session refresh on
    // every Hermes tool call is both wasted work and, per its own
    // NextResponse.next({ request }) reconstruction, an unnecessary extra
    // hop the Authorization header has no reason to pass through.
    "/((?!_next/static|_next/image|favicon.ico|api/mcp|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
