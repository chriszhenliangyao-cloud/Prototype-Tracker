import { NextResponse } from "next/server";
import { buildLogoutUrl } from "@/lib/auth/cognito";
import { getAuthConfig } from "@/lib/auth/config";
import { clearAuthCookies } from "@/lib/auth/server";
import {
  clearSupabaseAuthCookies,
  createSupabaseRouteClient
} from "@/lib/auth/supabase";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const config = getAuthConfig();
  if (config.provider === "supabase") {
    const response = NextResponse.redirect(
      new URL("/auth/signed-out", config.appUrl)
    );
    const client = createSupabaseRouteClient(request, response, config);
    const signOut = await client.auth.signOut({ scope: "local" });
    if (signOut.error) {
      console.warn("[auth/logout] Could not revoke the local Supabase session", {
        code: signOut.error.code
      });
    }
    clearSupabaseAuthCookies(request, response, config);
    clearAuthCookies(response);
    response.headers.set("cache-control", "no-store");
    return response;
  }
  const response = NextResponse.redirect(
    config.enabled
      ? buildLogoutUrl(config)
      : new URL("/auth/signed-out", config.appUrl)
  );
  clearAuthCookies(response);
  response.headers.set("cache-control", "no-store");
  return response;
}
