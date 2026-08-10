import { NextRequest, NextResponse } from "next/server";
import { getAuthConfig } from "@/lib/auth/config";
import { sessionCookieName, verifySessionCookie } from "@/lib/auth/sessionCookie";

export async function proxy(request: NextRequest) {
  const config = getAuthConfig();
  if (!config.enabled) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const session = verifySessionCookie(
    request.cookies.get(sessionCookieName)?.value,
    config.sessionSecret
  );

  if (!session) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set(
      "returnTo",
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    );
    return NextResponse.redirect(loginUrl);
  }

  response.headers.set("cache-control", "private, no-store");
  response.headers.set("x-content-type-options", "nosniff");
  return response;
}

export const config = {
  matcher: [
    "/platform/index.html",
    "/platform-native/index.html",
    "/platform-native/assets/data.js",
    "/platform-native/settlement-ledger.html"
  ]
};
