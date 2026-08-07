import { NextRequest, NextResponse } from "next/server";
import {
  createAppSession,
  exchangeAuthorizationCode,
  verifyCognitoIdToken
} from "@/lib/auth/cognito";
import { getAuthConfig } from "@/lib/auth/config";
import {
  authFlowCookieName,
  readAuthFlowCookie
} from "@/lib/auth/flowCookie";
import {
  authCookieOptions,
  authReturnToCookieName,
  authStateCookieName,
  authVerifierCookieName,
  makeSessionCookie
} from "@/lib/auth/server";
import { normalizeAuthReturnTo } from "@/lib/auth/returnTo";
import { sessionCookieName } from "@/lib/auth/sessionCookie";
import {
  createSupabaseRouteClient,
  getSupabaseAppSession
} from "@/lib/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const config = getAuthConfig();
  if (!config.enabled) {
    return NextResponse.redirect(new URL("/", config.appUrl));
  }

  if (config.provider === "supabase") {
    const returnTo = normalizeAuthReturnTo(
      request.nextUrl.searchParams.get("returnTo")
    );
    const response = NextResponse.redirect(new URL(returnTo, config.appUrl));
    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
      response.headers.set(
        "location",
        new URL("/auth/login", config.appUrl).toString()
      );
      return response;
    }

    const client = createSupabaseRouteClient(request, response, config);
    const exchange = await client.auth.exchangeCodeForSession(code);
    if (exchange.error) throw exchange.error;
    const session = await getSupabaseAppSession(client, config.emailRoleMap);
    if (!session) {
      await client.auth.signOut();
      response.headers.set(
        "location",
        new URL("/auth/forbidden?reason=not-authorized", config.appUrl).toString()
      );
    }
    response.headers.set("cache-control", "no-store");
    return response;
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const flow = state
    ? readAuthFlowCookie(
        request.cookies.get(authFlowCookieName(state))?.value,
        state
      )
    : null;
  const legacyState = request.cookies.get(authStateCookieName)?.value;
  const legacyVerifier = request.cookies.get(authVerifierCookieName)?.value;
  const verifier =
    flow?.verifier ||
    (state && legacyState === state ? legacyVerifier : undefined);
  const returnTo = flow
    ? flow.returnTo
    : normalizeAuthReturnTo(
        request.cookies.get(authReturnToCookieName)?.value
      );

  if (!code || !state || !verifier) {
    return NextResponse.redirect(new URL("/auth/login", config.appUrl));
  }

  const tokenResponse = await exchangeAuthorizationCode(config, code, verifier);
  if (!tokenResponse.id_token) {
    throw new Error("Cognito token response did not include an ID token.");
  }

  const identitySession = await verifyCognitoIdToken(
    tokenResponse.id_token,
    config
  );
  const session = createAppSession(
    identitySession,
    config.sessionMaxAgeSeconds
  );
  const response = NextResponse.redirect(new URL(returnTo, config.appUrl));
  response.cookies.set(
    sessionCookieName,
    makeSessionCookie(session),
    authCookieOptions(config.sessionMaxAgeSeconds)
  );
  response.cookies.set(authStateCookieName, "", authCookieOptions(0));
  response.cookies.set(authVerifierCookieName, "", authCookieOptions(0));
  response.cookies.set(authReturnToCookieName, "", authCookieOptions(0));
  response.cookies.set(authFlowCookieName(state), "", authCookieOptions(0));
  response.headers.set("cache-control", "no-store");

  return response;
}
