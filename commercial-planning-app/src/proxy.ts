import { NextRequest, NextResponse } from "next/server";
import { getAuthConfig } from "@/lib/auth/config";
import { setPlatformSessionCookie } from "@/lib/auth/platformSessionCookie";
import {
  sessionCookieName,
  verifySessionCookie
} from "@/lib/auth/sessionCookie";
import {
  createSupabaseRouteClient,
  getSupabaseAppSession
} from "@/lib/auth/supabase";

export async function proxy(request: NextRequest) {
  const config = getAuthConfig();
  if (!config.enabled) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  let session = verifySessionCookie(
    request.cookies.get(sessionCookieName)?.value,
    config.sessionSecret
  );

  // Existing Supabase SSR sessions can predate the platform's signed session
  // cookie. Recover once at the static boundary, then mint the fast-path cookie.
  if (!session && config.provider === "supabase") {
    const client = createSupabaseRouteClient(request, response, config);
    session = await getSupabaseAppSession(client, config.emailRoleMap);
    if (session) {
      setPlatformSessionCookie(response, session, config);
    }
  }

  if (!session) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("platformEmbed", "1");
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
