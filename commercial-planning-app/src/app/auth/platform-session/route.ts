import { NextRequest, NextResponse } from "next/server";
import { getAuthConfig } from "@/lib/auth/config";
import { getPilotAccessCookieMaxAge } from "@/lib/auth/pilotAccess";
import { authCookieOptions } from "@/lib/auth/server";
import {
  createSessionCookie,
  sessionCookieName
} from "@/lib/auth/sessionCookie";
import {
  createSupabaseRouteClient,
  getSupabaseAppSession
} from "@/lib/auth/supabase";
import { readPlatformSessionToken } from "@/lib/auth/platformSessionTokens";

export const dynamic = "force-dynamic";

type PlatformSessionPayload = {
  accessToken?: unknown;
  refreshToken?: unknown;
};

export async function POST(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin || requestOrigin !== getPublicRequestOrigin(request)) {
    return NextResponse.json(
      { message: "仅允许同域平台建立经营规划会话。" },
      { status: 403, headers: { "cache-control": "no-store" } }
    );
  }

  const payload = (await request.json().catch(() => ({}))) as PlatformSessionPayload;
  const accessToken = readPlatformSessionToken(payload.accessToken, 20);
  const refreshToken = readPlatformSessionToken(payload.refreshToken, 1);
  if (!accessToken || !refreshToken) {
    return NextResponse.json(
      { message: "登录会话不完整，请重新登录。" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const config = getAuthConfig();
  if (!config.enabled || config.provider !== "supabase") {
    return NextResponse.json(
      { message: "统一 Supabase 登录尚未启用。" },
      { status: 409, headers: { "cache-control": "no-store" } }
    );
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } }
  );
  const client = createSupabaseRouteClient(request, response, config);
  const result = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  if (result.error) {
    return NextResponse.json(
      { message: "登录会话验证失败，请重新登录。" },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  const session = await getSupabaseAppSession(client, config.emailRoleMap);
  if (!session) {
    return NextResponse.json(
      { message: "当前账号没有经营规划模块权限。" },
      { status: 403, headers: { "cache-control": "no-store" } }
    );
  }

  response.cookies.set(
    sessionCookieName,
    createSessionCookie(session, config.sessionSecret),
    authCookieOptions(getPilotAccessCookieMaxAge(session.expiresAt))
  );

  return response;
}

function getPublicRequestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost || request.headers.get("host") || "")
    .split(",")[0]
    .trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol = (forwardedProtocol || request.nextUrl.protocol.replace(":", ""))
    .split(",")[0]
    .trim();
  if (!host || !protocol) return "";

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return "";
  }
}
